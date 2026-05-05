import asyncio, os
import pandas as pd
import numpy as np
from fastapi import WebSocket, WebSocketDisconnect
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from contextlib import asynccontextmanager
from collections import deque

import mqtt
import database_models
from database import SessionLocal, engine
from models import RSSIMapInfoSchema, CollectDataRequestSchema, UwbMapInfoSchema, UserSchema, DeviceRenameSchema, ScenarioSchema, TrainingHistorySchema
from wbo_filter import Preprocessor
from ml_model import MLModel
from kalmanFilter import LinearKalmanFilter
from positioning import ToFPositioning




# Queue lưu dữ liệu RSSI từ MQTT để phục vụ API collect data
data_queue = None
# Object Model AI load vào RAM
ai_predictor = None
# Đối tượng mqtt client
mqtt_client = None
# List các client (ReactJS) đang kết nối Websocket
active_websockets = []
device_manager_websockets = []
# Buffer tối đa 10 phần tử RSSI real-time cho AI dự đoán
rssi_buffers = {}  
# Buffer gom khoảng cách từ các beacon cho từng Tag theo chiều dọc tin nhắn MQTT
uwb_distance_buffer = {}
# Biến Cache lưu tọa độ Beacon
BEACONS_CONFIG = {}
# Theo dõi từng tag
uwb_trackers = {}
# Set theo dõi xem thiết bị đã được lưu vào DB chưa
KNOWN_RSSI_DEVICES = set()
KNOWN_UWB_DEVICES = set()

kalman_filters = {}

# HÀM ĐƯỢC GỌI KHI CÓ TIN NHẮN MQTT
def handle_incoming_mqtt_data(msg_dict):

    global data_queue, ai_predictor, mqtt_client, KNOWN_RSSI_DEVICES, KNOWN_UWB_DEVICES
    data_type = msg_dict.get("data_type")

    # /------------------------- XỬ LÝ DỮ LIỆU UWB RANGING ----------------------------/
    if data_type == "uwb":
        
        beacon_id = msg_dict["beacon_id"]
        measurements = msg_dict["measurements"] 
        
        for tag_id, distance in measurements.items():
            # Lưu UWB Device
            if tag_id not in KNOWN_UWB_DEVICES:
                db = SessionLocal()
                try:
                    new_dev = database_models.DeviceUWB(device_name=f"{tag_id}", device_hex_id=tag_id)
                    db.add(new_dev)
                    db.commit()
                    KNOWN_UWB_DEVICES.add(tag_id)
                    print(f"[Noti] 🌟 Found new UWB Device: {tag_id}")
                    # Bắn thông báo qua Websocket cho Frontend biết có thiết bị mới
                    for ws in device_manager_websockets:
                        asyncio.create_task(ws.send_json({"type": "new_device"}))
                except Exception as e:
                    pass
                finally:
                    db.close()
            # Khởi tạo buffer cho Tag này nếu chưa có
            if tag_id not in uwb_distance_buffer:
                uwb_distance_buffer[tag_id] = {}
                
            uwb_distance_buffer[tag_id][beacon_id] = distance

            if not active_websockets: continue 
            
            if len(uwb_distance_buffer[tag_id]) >= 3:
                if tag_id not in uwb_trackers:
                    uwb_trackers[tag_id] = ToFPositioning(min_beacons=3, use_kalman=True)
                
                if not BEACONS_CONFIG:
                    print("[Warning] ⚠️ No founds UWB locations on RAM")
                    uwb_distance_buffer[tag_id].clear()
                    return
                
                result = uwb_trackers[tag_id].compute_position(BEACONS_CONFIG, uwb_distance_buffer[tag_id])
                
                if result:

                    x_val = round(result['x'], 1)
                    y_val = round(result['y'], 1)
                    err_val = result.get('error', result.get('accuracy', 0.0))
                    # Gửi lên Web
                    payload = {
                        "type": "uwb",
                        "tag_id": tag_id, 
                        "x": x_val,
                        "y": y_val,
                        "error": round(err_val, 1)
                    }
                    for ws in active_websockets:
                        asyncio.create_task(ws.send_json(payload))

                    # Gửi lên MQTT
                    if mqtt_client:
                        topic = f"user_pos/{tag_id}"
                        message = f"{x_val},{y_val}"
                        mqtt_client.publish(topic, message)
                        print(f'[MQTT] 👤 Sent User Position message: {message} to topic: {topic}')
                    
                    # Sau khi tính xong, xóa buffer này để tính tiếp
                    uwb_distance_buffer[tag_id].clear()
        return
    # /---------------------------------------------------------------------------------/
    
    # /-------------------------- XỬ LÝ DỮ LIỆU RSSI -----------------------------------/
    if data_type == "rssi":
        # Lưu RSSI Device
        hex_id = msg_dict.get("hex_id")
        if hex_id and hex_id not in KNOWN_RSSI_DEVICES:
            db = SessionLocal()
            try:
                new_dev = database_models.DeviceRSSI(device_name=f"{hex_id}", device_hex_id=hex_id)
                db.add(new_dev)
                db.commit()
                KNOWN_RSSI_DEVICES.add(hex_id)
                print(f"[Noti] 🌟 Found new RSSI Device: {hex_id}")
                # Bắn thông báo qua Websocket cho Frontend biết có thiết bị mới
                for ws in device_manager_websockets:
                    asyncio.create_task(ws.send_json({"type": "new_device"}))
            except Exception as e:
                pass
            finally:
                db.close()

        # Đẩy data vào queue cho API collect data
        # Logic: Nếu queue đầy đẩy phần tử cũ nhất ra thêm dữ liệu mới
        if data_queue is not None:
            if data_queue.full():
                try:
                    data_queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            data_queue.put_nowait(msg_dict)

        # AI dự đoán vị trí
        if not active_websockets or ai_predictor is None or ai_predictor.model is None:
            return  
            
        features = [
            msg_dict["rssi_wifi_1"], msg_dict["rssi_wifi_2"],
            msg_dict["rssi_wifi_3"], msg_dict["rssi_wifi_4"],
            msg_dict["rssi_ble_1"], msg_dict["rssi_ble_2"],
            msg_dict["rssi_ble_3"], msg_dict["rssi_ble_4"],
            msg_dict["magnetic_field_y"], msg_dict["magnetic_field_z"]
        ]
        if hex_id not in rssi_buffers:
            rssi_buffers[hex_id] = deque(maxlen=10)
        if hex_id not in kalman_filters:
            kalman_filters[hex_id] = LinearKalmanFilter()
        rssi_buffers[hex_id].append(features)

        if len(rssi_buffers[hex_id]) == 10:
                window_data = np.array(rssi_buffers[hex_id])
                try:
                    raw_x, raw_y, accuracy = ai_predictor.predict_realtime(window_data)
                    raw_x_smooth, raw_y_smooth = kalman_filters[hex_id].update(raw_x, raw_y)
                    payload = {
                        "type": "rssi",
                        "tag_id": hex_id,
                        "x": round(raw_x_smooth, 1),
                        "y": round(raw_y_smooth, 1),
                        "accuracy": round(accuracy * 100, 1)
                    }
                    
                    for ws in active_websockets:
                        asyncio.create_task(ws.send_json(payload))

                    # Gửi lên MQTT
                    if mqtt_client:
                        topic = f"user_pos/{hex_id}"
                        message = f"{raw_x_smooth},{raw_y_smooth}"
                        mqtt_client.publish(topic, message)
                        print(f'[MQTT] 👤 Sent User Position message: {message} to topic: {topic}')
                        
                except Exception as e:
                    print(f"[Err] ❌ Real-time prediction error: {e}")
    # /---------------------------------------------------------------------------------/

# HÀM KHỞI ĐỘNG SERVER (LIFESPAN)
@asynccontextmanager
async def lifespan(app: FastAPI):
    global data_queue, mqtt_client, BEACONS_CONFIG
    # Load DB lên RAM 1 lần để lấy tọa độ
    db = SessionLocal()
    try:
        # Load danh sách thiết bị đã biết lên RAM
        for d in db.query(database_models.DeviceRSSI).all():
            KNOWN_RSSI_DEVICES.add(d.device_hex_id)
        for d in db.query(database_models.DeviceUWB).all():
            KNOWN_UWB_DEVICES.add(d.device_hex_id)
        uwb_latest_map = db.query(database_models.UwbMapInfo).order_by(database_models.UwbMapInfo.map_info_id.desc()).first()
        if uwb_latest_map and uwb_latest_map.beacon_location:
            BEACONS_CONFIG = uwb_latest_map.beacon_location
            print("[Noti] ✅ UWB locations have been loaded from the database into RAM cache!")
    finally:
        db.close()

    data_queue = asyncio.Queue(maxsize=500)
    loop = asyncio.get_running_loop()
    
    # Khởi động kết nối MQTT
    mqtt.init_async_bridge(loop, handle_incoming_mqtt_data)
    mqtt_client = mqtt.connect_mqtt()
    
    yield 
    
    # Đóng kết nối khi tắt server
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

# Khởi tạp app Fast API
app = FastAPI(lifespan=lifespan)

# Cấu hình CORS
app.add_middleware( 
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tạo bảng trong DB nếu chưa tồn tại
database_models.Base.metadata.create_all(bind = engine)

# HÀM DEPENDENCY LẤY DB SESSION CHO CÁC API
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# /----------------------------- API ENDPOINTS -------------------------------------/

# =====================================================================
# API ĐĂNG KÝ VÀ ĐĂNG NHẬP TÀI KHOẢN
# =====================================================================
@app.post("/register")
def register(user: UserSchema, db: Session = Depends(get_db)):
    existing_user = db.query(database_models.User).filter(database_models.User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = database_models.User(username=user.username, password=user.password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

@app.post("/login")
def login(user: UserSchema, db: Session = Depends(get_db)):
    db_user = db.query(database_models.User).filter(
        database_models.User.username == user.username,
        database_models.User.password == user.password
    ).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"message": "Login successful"}
# =====================================================================
# API QUẢN LÝ THIẾT BỊ 
# =====================================================================
@app.get("/devices/rssi")
def get_rssi_devices(db: Session = Depends(get_db)):
    return db.query(database_models.DeviceRSSI).all()

@app.put("/devices/rssi/{device_id}")
def rename_rssi_device(device_id: int, payload: DeviceRenameSchema, db: Session = Depends(get_db)):
    dev = db.query(database_models.DeviceRSSI).filter_by(device_id=device_id).first()
    if not dev: raise HTTPException(status_code=404)
    dev.device_name = payload.device_name
    db.commit()
    return dev

@app.delete("/devices/rssi/{device_id}")
def delete_rssi_device(device_id: int, db: Session = Depends(get_db)):
    global KNOWN_RSSI_DEVICES
    dev = db.query(database_models.DeviceRSSI).filter_by(device_id=device_id).first()
    if not dev: 
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Xóa khỏi Cache RAM
    if dev.device_hex_id in KNOWN_RSSI_DEVICES:
        KNOWN_RSSI_DEVICES.remove(dev.device_hex_id)
        
    db.delete(dev)
    db.commit()
    if db.query(database_models.DeviceRSSI).count() == 0:
        db.execute(text("ALTER TABLE device_rssi AUTO_INCREMENT = 1"))
        db.commit()

    return {"message": "RSSI device deleted successfully"}

@app.get("/devices/uwb")
def get_uwb_devices(db: Session = Depends(get_db)):
    return db.query(database_models.DeviceUWB).all()

@app.put("/devices/uwb/{device_id}")
def rename_uwb_device(device_id: int, payload: DeviceRenameSchema, db: Session = Depends(get_db)):
    dev = db.query(database_models.DeviceUWB).filter_by(device_id=device_id).first()
    if not dev: raise HTTPException(status_code=404)
    dev.device_name = payload.device_name
    db.commit()
    return dev

@app.delete("/devices/uwb/{device_id}")
def delete_uwb_device(device_id: int, db: Session = Depends(get_db)):
    global KNOWN_UWB_DEVICES
    dev = db.query(database_models.DeviceUWB).filter_by(device_id=device_id).first()
    if not dev: 
        raise HTTPException(status_code=404, detail="Device not found")
        
    # Xóa khỏi Cache RAM
    if dev.device_hex_id in KNOWN_UWB_DEVICES:
        KNOWN_UWB_DEVICES.remove(dev.device_hex_id)
        
    db.delete(dev)
    db.commit()
    if db.query(database_models.DeviceUWB).count() == 0:
        db.execute(text("ALTER TABLE device_uwb AUTO_INCREMENT = 1"))
        db.commit()
    return {"message": "UWB device deleted successfully"}
# =====================================================================
# API KẾT NỐI WS ĐỂ BACKEND ĐẨY DỮ LIỆU DEVICES CHO FRONTEND
# =====================================================================
@app.websocket("/ws/devices")
async def websocket_devices_endpoint(websocket: WebSocket):
    await websocket.accept()
    device_manager_websockets.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        device_manager_websockets.remove(websocket)
# =====================================================================
# API QUẢN LÝ MAP RSSI
# =====================================================================
@app.get("/rssi_maps")
def get_all_maps(db: Session = Depends(get_db)):
    db_maps = db.query(database_models.RSSIMapInfo).all()
    return db_maps

@app.post("/rssi_maps")
def create_map(map_info: RSSIMapInfoSchema, db: Session = Depends(get_db)):
    db_map = database_models.RSSIMapInfo(**map_info.model_dump())
    db.add(db_map)
    db.commit()
    db.refresh(db_map)
    return db_map

@app.get("/rssi_maps/{id}")
def get_map_by_id(id: int, db: Session = Depends(get_db)):
    db_map = db.query(database_models.RSSIMapInfo).filter(database_models.RSSIMapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    return db_map

@app.put("/rssi_maps/{id}")
def update_map(id: int, map_info: RSSIMapInfoSchema, db: Session = Depends(get_db)):
    db_map = db.query(database_models.RSSIMapInfo).filter(database_models.RSSIMapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    else:
        db_map.total_units = map_info.total_units
        db_map.area_of_one_unit = map_info.area_of_one_unit
        db_map.walkable_area = map_info.walkable_area    
        db_map.north_offset = map_info.north_offset
        db_map.router_location = map_info.router_location
        db_map.router_number = map_info.router_number
        db_map.cols = map_info.cols
        db_map.rows = map_info.rows
        db_map.blocked_cells = map_info.blocked_cells
    db.commit()
    db.refresh(db_map)
    return db_map

@app.delete("/rssi_maps/{id}")
def delete_map(id: int, db: Session = Depends(get_db)):
    db_map = db.query(database_models.RSSIMapInfo).filter(database_models.RSSIMapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")

    db.delete(db_map)
    db.commit()

    if db.query(database_models.RSSIMapInfo).count() == 0:
        db.execute(text("ALTER TABLE rssi_map_info AUTO_INCREMENT = 1"))
        db.commit()

    return {"status": "deleted"}
# =====================================================================
# API THU THẬP DỮ LIỆU CHO FINGERPRINTING
# =====================================================================
@app.post("/collect_data")
async def collect_data(request: CollectDataRequestSchema, db: Session = Depends(get_db)):

    # Xóa data cũ trong DB của ô đó để tránh trùng
    db.query(database_models.RSSIForTraining).filter(
        database_models.RSSIForTraining.map_info_id == request.map_info_id,
        database_models.RSSIForTraining.coord_x == request.coord_x,
        database_models.RSSIForTraining.coord_y == request.coord_y).delete(synchronize_session=False)
    db.commit()

    # Xóa data cũ trong queue để tránh trùng lặp khi thu thập dữ liệu mới
    while not data_queue.empty():
        try:
            data_queue.get_nowait()
        except asyncio.QueueEmpty:
            break

    collected = 0
    while collected < request.samples:
            try:
                msg_dict = await asyncio.wait_for(data_queue.get(), timeout=10.0) # Chờ lấy data từ MQTT max 10s

                new_record = database_models.RSSIForTraining(
                    map_info_id=request.map_info_id,
                    coord_x=request.coord_x,
                    coord_y=request.coord_y,
                    rssi_wifi_1=msg_dict["rssi_wifi_1"],
                    rssi_wifi_2=msg_dict["rssi_wifi_2"],
                    rssi_wifi_3=msg_dict["rssi_wifi_3"],
                    rssi_wifi_4=msg_dict["rssi_wifi_4"],
                    rssi_ble_1=msg_dict["rssi_ble_1"],
                    rssi_ble_2=msg_dict["rssi_ble_2"],
                    rssi_ble_3=msg_dict["rssi_ble_3"],
                    rssi_ble_4=msg_dict["rssi_ble_4"],
                    magnetic_field_y=msg_dict["magnetic_field_y"],
                    magnetic_field_z=msg_dict["magnetic_field_z"]
                )
                db.add(new_record)
                collected += 1

            except asyncio.TimeoutError:
                print("[Noti] ❌ Device stopped sending data.")
                break

    db.commit()
    return {"message": f"Successfully collected {collected}/{request.samples} samples."}
# =====================================================================
# API TIỀN XỬ LÝ DATA TRƯỚC KHI TRAIN MODEL
# =====================================================================
@app.post("/preprocess_map/{map_info_id}")
def preprocess_map_data(map_info_id: int, db: Session = Depends(get_db)):
    # Lấy dữ liệu từ DB của đúng Map đó
    records = db.query(database_models.RSSIForTraining).filter(
        database_models.RSSIForTraining.map_info_id == map_info_id
    ).all()

    if not records:
        raise HTTPException(status_code=404, detail="No data found for this map.")

    # Chuyển đổi Object sang Pandas DataFrame
    data_dicts = []
    for r in records:
        data_dicts.append({
            'coord_x': r.coord_x,
            'coord_y': r.coord_y,
            'rssi_wifi_1': r.rssi_wifi_1, 'rssi_wifi_2': r.rssi_wifi_2,
            'rssi_wifi_3': r.rssi_wifi_3, 'rssi_wifi_4': r.rssi_wifi_4,
            'rssi_ble_1': r.rssi_ble_1, 'rssi_ble_2': r.rssi_ble_2,
            'rssi_ble_3': r.rssi_ble_3, 'rssi_ble_4': r.rssi_ble_4,
            'magnetic_field_y': r.magnetic_field_y, 'magnetic_field_z': r.magnetic_field_z
        })
    df = pd.DataFrame(data_dicts)

    # Đưa vào bộ lọc WBO
    processor = Preprocessor(data_df=df, map_id=map_info_id)
    filtered_path, raw_path = processor.preprocess()

    return {
        "message": "Data filtered successfully!", 
        "filtered_file": filtered_path,
        "raw_file": raw_path
    }
# =====================================================================
# API CHỌN MAP ĐỂ LOAD MODEL AI VÀ GỬI THÔNG TIN MAP (North Offset, Ô bị cản) XUỐNG DEVICE QUA MQTT
# =====================================================================
@app.post("/set_active_rssi_map/{id}")
def set_active_rssi_map(id: int, db: Session = Depends(get_db)):
    global ai_predictor, rssi_buffers, kalman_filters, mqtt_client
    
    db_map = db.query(database_models.RSSIMapInfo).filter(database_models.RSSIMapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
        
    try:
        print(f"[Noti] 🔄 Switching AI Model path to Map ID: {id}...")
        # Xóa sạch cũ (Ngoại trừ danh sách thiết bị KNOWN_RSSI_DEVICES)
        rssi_buffers.clear()
        kalman_filters.clear()
        
        # Load model mới
        ai_predictor = MLModel(csv_path="", map_id=id)
        ai_predictor.load_saved_model()

        # Gửi Map xuống Device
        if mqtt_client:
            cols = 10
            offset = db_map.north_offset if db_map.north_offset else 0
            blocked_ids = []
            
            if db_map.blocked_cells:
                for cell in db_map.blocked_cells:
                    try:
                        x_str, y_str = cell.split(':')
                        x_idx = int(float(x_str))
                        y_idx = int(float(y_str))
                        cell_id = y_idx * cols + x_idx + 1
                        blocked_ids.append(str(cell_id))
                    except Exception:
                        pass
            
            payload = f"{offset}"
            if blocked_ids:
                payload += "," + ",".join(blocked_ids)
                
            mqtt_client.publish("map_data", payload)
            print(f"[MQTT] 🗺️  Sent RSSI Map Data message: {payload}")
        
        return {"message": f"Successfully loaded AI Model for Map {id}"}
    except Exception as e:
        print(f"[Err] ❌ Failed to load model for Map {id}: {e}")
        raise HTTPException(status_code=400, detail=f"AI Model for Map {id} not found. Please train it first!")
# =====================================================================
# API TRAIN MODEL AI CHO MAP ĐÃ CHỌN
# =====================================================================
@app.post("/train_model/{map_info_id}")
async def train_model(map_info_id: int):
    try:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        csv_file_path = os.path.join(BASE_DIR, 'rssi_data', f'rssi_preprocess_map_{map_info_id}.csv')
        cnn_model = MLModel(csv_path=csv_file_path, map_id=map_info_id) 
        cnn_model.train_model()
        
        return {
            "status": "success",
            "message": f"Trained successfully for Map {map_info_id}!"
        }
    except Exception as e:
        print(f"[Err] ❌ Training Error: {e}")
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")
# =====================================================================
# API KẾT NÔI WS ĐỂ BACKEND ĐẨY DỮ LIỆU VỊ TRÍ REAL-TIME CHO FRONTEND
# =====================================================================
@app.websocket("/ws/realtime_location")
async def websocket_realtime_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        while True:
            # Giữ kết nối mở và nhận tín hiệu ping/pong 
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        active_websockets.remove(websocket)
        print("[Noti] ⚠️ A Client disconnected from Real-time Location")
# =====================================================================
# API QUẢN LÝ MAP UWB
# =====================================================================
@app.get("/uwb_maps")
def get_all_uwb_maps(db: Session = Depends(get_db)):
    db_maps = db.query(database_models.UwbMapInfo).all()
    return db_maps

@app.post("/uwb_maps")
def create_uwb_map(map_info: UwbMapInfoSchema, db: Session = Depends(get_db)):
    db_map = database_models.UwbMapInfo(**map_info.model_dump())
    db.add(db_map)
    db.commit()
    db.refresh(db_map)
    return db_map

@app.get("/uwb_maps/{id}")
def get_uwb_map_by_id(id: int, db: Session = Depends(get_db)):
    db_map = db.query(database_models.UwbMapInfo).filter(database_models.UwbMapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    return db_map

@app.put("/uwb_maps/{id}")
def update_uwb_map(id: int, map_info: UwbMapInfoSchema, db: Session = Depends(get_db)):
    db_map = db.query(database_models.UwbMapInfo).filter(database_models.UwbMapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    else:
        db_map.total_units = map_info.total_units
        db_map.area_of_one_unit = map_info.area_of_one_unit
        db_map.walkable_area = map_info.walkable_area    
        db_map.north_offset = map_info.north_offset
        db_map.beacon_number = map_info.beacon_number
        db_map.beacon_location = map_info.beacon_location
        db_map.cols = map_info.cols
        db_map.rows = map_info.rows
        db_map.blocked_cells = map_info.blocked_cells
    db.commit()
    db.refresh(db_map)

    return db_map

@app.delete("/uwb_maps/{id}")
def delete_uwb_map(id: int, db: Session = Depends(get_db)):
    db_map = db.query(database_models.UwbMapInfo).filter(database_models.UwbMapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")

    db.delete(db_map)
    db.commit()

    if db.query(database_models.UwbMapInfo).count() == 0:
        db.execute(text("ALTER TABLE uwb_map_info AUTO_INCREMENT = 1"))
        db.commit()

    return {"status": "deleted"}
# =====================================================================
# API CHỌN MAP UWB ĐỂ GỬI THÔNG TIN MAP (North Offset, Ô bị cản) XUỐNG DEVICE QUA MQTT
# =====================================================================
@app.post("/set_active_uwb_map/{id}")
def set_active_uwb_map(id: int, db: Session = Depends(get_db)):
    global BEACONS_CONFIG, mqtt_client
    
    db_map = db.query(database_models.UwbMapInfo).filter(database_models.UwbMapInfo.map_info_id == id).first()
    
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
        
    if db_map.beacon_location:
        BEACONS_CONFIG = db_map.beacon_location
    else:
        BEACONS_CONFIG = {}
    
    # Gửi Map xuống Device
    if mqtt_client:
        cols = 10
        offset = db_map.north_offset if db_map.north_offset else 0
        blocked_ids = []
        
        # Chuyển đổi tọa độ thành danh sách ID
        if db_map.blocked_cells:
            for cell in db_map.blocked_cells:
                try:
                    x_str, y_str = cell.split(':')
                    x_idx = int(float(x_str))
                    y_idx = int(float(y_str))
                    cell_id = y_idx * cols + x_idx + 1
                    blocked_ids.append(str(cell_id))
                except Exception:
                    pass
        
        payload = f"{offset}"
        if blocked_ids:
            payload += "," + ",".join(blocked_ids)
            
        mqtt_client.publish("map_data", payload)
        print(f"[MQTT] 🗺️  Sent UWB Map Data message: {payload}")
        
    return {"message": f"Switched uwb map to ID {id}", "active_beacons": BEACONS_CONFIG}
# =====================================================================
# API QUẢN LÝ KỊCH BẢN HUẤN LUYỆN (SCENARIOS & FIRES)
# =====================================================================
@app.post("/scenarios")
def create_scenario(payload: ScenarioSchema, db: Session = Depends(get_db)):

    # Tạo kịch bản mới
    new_scenario = database_models.Scenario(
        map_info_id=payload.map_info_id,
        map_type=payload.map_type,
        scenario_name=payload.scenario_name
    )
    db.add(new_scenario)
    db.commit()
    db.refresh(new_scenario)

    # Tạo danh sách ngọn lửa
    for fire in payload.fires:
        new_fire = database_models.ScenarioFire(
            scenario_id=new_scenario.scenario_id,
            coord_x=fire.coord_x,
            coord_y=fire.coord_y,
            level=fire.level,
            delay_time=fire.delay_time
        )
        db.add(new_fire)
    
    db.commit()
    return {"message": "Scenario created successfully", "scenario_id": new_scenario.scenario_id}

@app.get("/scenarios/{map_type}/{map_id}")
def get_scenarios(map_type: str, map_id: int, db: Session = Depends(get_db)):
    # Lấy kịch bản kèm theo toàn bộ ngọn lửa
    scenarios = db.query(database_models.Scenario).filter(
        database_models.Scenario.map_type == map_type,
        database_models.Scenario.map_info_id == map_id
    ).all()
    
    result = []
    for sc in scenarios:
        result.append({
            "scenario_id": sc.scenario_id,
            "scenario_name": sc.scenario_name,
            "fires": [
                {
                    "fire_id": f.fire_id,
                    "coord_x": f.coord_x,
                    "coord_y": f.coord_y,
                    "level": f.level,
                    "delay_time": f.delay_time
                } for f in sc.fires
            ]
        })
    return result

@app.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    sc = db.query(database_models.Scenario).filter_by(scenario_id=scenario_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    db.delete(sc)
    db.commit()

    if db.query(database_models.Scenario).count() == 0:
        db.execute(text("ALTER TABLE scenarios AUTO_INCREMENT = 1"))
        db.execute(text("ALTER TABLE scenario_fires AUTO_INCREMENT = 1"))
        db.commit()

    return {"message": "Scenario deleted successfully"}

# =====================================================================
# API QUẢN LÝ LỊCH SỬ HUẤN LUYỆN (TRAINING HISTORY)
# =====================================================================
@app.post("/training_history")
def save_training_history(payload: TrainingHistorySchema, db: Session = Depends(get_db)):
    history = database_models.TrainingHistory(
        username=payload.username,
        scenario_id=payload.scenario_id,
        device_hex_id=payload.device_hex_id,
        score=payload.score
    )
    db.add(history)
    db.commit()
    return {"message": "Training session saved successfully!"}

@app.get("/training_history")
def get_training_history(db: Session = Depends(get_db)):
    records = db.query(
        database_models.TrainingHistory.history_id,
        database_models.TrainingHistory.scenario_id,
        database_models.TrainingHistory.device_hex_id,
        database_models.TrainingHistory.score,
        database_models.TrainingHistory.start_time,
        database_models.Scenario.scenario_name
    ).join(
        database_models.Scenario, 
        database_models.TrainingHistory.scenario_id == database_models.Scenario.scenario_id
    ).order_by(
        desc(database_models.TrainingHistory.start_time)
    ).all()

    return [
        {
            "history_id": r.history_id,
            "scenario_id": r.scenario_id,
            "scenario_name": r.scenario_name,
            "device_hex_id": r.device_hex_id,
            "score": r.score,
            "start_time": r.start_time
        }
        for r in records
    ]
# =====================================================================
# API GỬI TRẠNG THÁI NGỌN LỬA XUỐNG HARDWARE (TFT) QUA MQTT
# =====================================================================
@app.post("/fire_update")
def update_fire_mqtt(payload_data: dict):
    global mqtt_client
    data_str = payload_data.get("payload", "")
    
    if mqtt_client:
        mqtt_client.publish("firefighting_data", data_str)
        print(f"[MQTT] 🔥 Sent Fire Data message: {data_str}")
        return {"status": "success"}
        
    return {"status": "error", "message": "MQTT not connected"}
