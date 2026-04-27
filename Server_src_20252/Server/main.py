import asyncio, os
import pandas as pd
import numpy as np
from fastapi import WebSocket, WebSocketDisconnect
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from contextlib import asynccontextmanager
from collections import deque

import mqtt
import database_models
from database import SessionLocal, engine
from models import MapInfoSchema, CollectDataRequestSchema, UwbMapInfoSchema, UserSchema
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
# Buffer tối đa 10 phần tử RSSI real-time cho AI dự đoán
realtime_buffer = deque(maxlen=10)  
# Buffer gom khoảng cách từ các beacon cho từng Tag theo chiều dọc tin nhắn MQTT
uwb_distance_buffer = {}

UWB_BEACONS_CONFIG = {
    "0x01": {"x": 2.5, "y": 0.5},    
    "0x02": {"x": 5.5, "y": 0.5},
    "0x03": {"x": 5.5, "y": 10.5},
    "0x04": {"x": 2.5, "y": 10.5}
}

# Theo dõi từng tag
uwb_trackers = {}

kalman_filter = LinearKalmanFilter()

# HÀM ĐƯỢC GỌI KHI CÓ TIN NHẮN MQTT
def handle_incoming_mqtt_data(msg_dict):

    global data_queue, ai_predictor, mqtt_client
    data_type = msg_dict.get("data_type")

    # /------------------------- XỬ LÝ DỮ LIỆU UWB RANGING ----------------------------/
    if data_type == "uwb":
        if not active_websockets: return 
        
        beacon_id = msg_dict["beacon_id"]
        measurements = msg_dict["measurements"] 
        
        for tag_id, distance in measurements.items():
            # Khởi tạo buffer cho Tag này nếu chưa có
            if tag_id not in uwb_distance_buffer:
                uwb_distance_buffer[tag_id] = {}
                
            uwb_distance_buffer[tag_id][beacon_id] = distance
            
            if len(uwb_distance_buffer[tag_id]) >= 3:
                if tag_id not in uwb_trackers:
                    uwb_trackers[tag_id] = ToFPositioning(min_beacons=3, use_kalman=True)
                
                result = uwb_trackers[tag_id].compute_position(UWB_BEACONS_CONFIG, uwb_distance_buffer[tag_id])
                
                if result:

                    x_val = round(result['x'], 1)
                    y_val = round(result['y'], 1)
                    # Gửi lên Web
                    payload = {
                        "type": "uwb",
                        "tag_id": tag_id, 
                        "x": x_val,
                        "y": y_val,
                        "accuracy": round(result['accuracy'], 1)
                    }
                    for ws in active_websockets:
                        asyncio.create_task(ws.send_json(payload))

                    # Gửi lên MQTT
                    if mqtt_client:
                        topic = f"user_pos/{tag_id}"
                        message = f"{x_val},{y_val}"
                        mqtt_client.publish(topic, message)
                    
                    # Sau khi tính xong, xóa buffer này để tính tiếp
                    uwb_distance_buffer[tag_id].clear()
        return
    # /---------------------------------------------------------------------------------/
    
    # /-------------------------- XỬ LÝ DỮ LIỆU RSSI -----------------------------------/
    if data_type == "rssi":
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
        
        realtime_buffer.append(features)

        if len(realtime_buffer) == 10:
                window_data = np.array(realtime_buffer)
                try:
                    raw_x, raw_y, accuracy = ai_predictor.predict_realtime(window_data)
                    raw_x_smooth, raw_y_smooth = kalman_filter.update(raw_x, raw_y)
                    payload = {
                        "x": round(raw_x_smooth, 1),
                        "y": round(raw_y_smooth, 1),
                        "accuracy": round(accuracy * 100, 1)
                    }
                    
                    for ws in active_websockets:
                        asyncio.create_task(ws.send_json(payload))
                        
                except Exception as e:
                    print(f"Real-time prediction error: {e}")
    # /---------------------------------------------------------------------------------/

# HÀM KHỞI ĐỘNG SERVER (LIFESPAN)
@asynccontextmanager
async def lifespan(app: FastAPI):
    global data_queue, ai_predictor, mqtt_client
    data_queue = asyncio.Queue(maxsize=500)
    loop = asyncio.get_running_loop()

    # Nạp Model AI vào RAM
    ai_predictor = MLModel(csv_path="")
    try:
        ai_predictor.load_saved_model()
    except Exception as e:
        print(f"⚠️ Warning: Unable to load AI model. Error: {e}")
    
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

# /----------------------------- API ENDPOINTS ----------------------------------/
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

@app.get("/maps")
def get_all_maps(db: Session = Depends(get_db)):
    db_maps = db.query(database_models.MapInfo).all()
    return db_maps

@app.post("/maps")
def create_map(map_info: MapInfoSchema, db: Session = Depends(get_db)):
    db_map = database_models.MapInfo(**map_info.model_dump())
    db.add(db_map)
    db.commit()
    db.refresh(db_map)
    return db_map

@app.get("/maps/{id}")
def get_map_by_id(id: int, db: Session = Depends(get_db)):
    db_map = db.query(database_models.MapInfo).filter(database_models.MapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    return db_map

@app.put("/maps/{id}")
def update_map(id: int, map_info: MapInfoSchema, db: Session = Depends(get_db)):
    db_map = db.query(database_models.MapInfo).filter(database_models.MapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")
    else:
        db_map.total_units = map_info.total_units
        db_map.area_of_one_unit = map_info.area_of_one_unit
        db_map.walkable_area = map_info.walkable_area    
        db_map.router_location = map_info.router_location
        db_map.router_number = map_info.router_number
        db_map.cols = map_info.cols
        db_map.rows = map_info.rows
        db_map.blocked_cells = map_info.blocked_cells
    db.commit()
    db.refresh(db_map)
    return db_map

@app.delete("/maps/{id}")
def delete_map(id: int, db: Session = Depends(get_db)):
    db_map = db.query(database_models.MapInfo).filter(database_models.MapInfo.map_info_id == id).first()
    if not db_map:
        raise HTTPException(status_code=404, detail="Map not found")

    db.delete(db_map)
    db.commit()

    if db.query(database_models.MapInfo).count() == 0:
        db.execute(text("ALTER TABLE map_info AUTO_INCREMENT = 1"))
        db.commit()

    return {"status": "deleted"}

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
                print("Timeout: Device stopped sending data.")
                break

    db.commit()
    return {"message": f"Successfully collected {collected}/{request.samples} samples."}

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
    processor = Preprocessor(data_df=df)
    filtered_path, raw_path = processor.preprocess()

    return {
        "message": "Data filtered successfully!", 
        "filtered_file": filtered_path,
        "raw_file": raw_path
    }

@app.post("/train_model/{map_info_id}")
async def train_model(map_info_id: int):
    try:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        csv_file_path = os.path.join(BASE_DIR, 'rssi_data', 'rssi_preprocess.csv')
        
        cnn_model = MLModel(csv_path=csv_file_path) 
        
        cnn_model.train_model()
        
        return {
            "status": "success",
            "message": f"Trained successfully!"
        }
    except Exception as e:
        print(f"Training Error: {e}")
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")
    
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
        print("A Client disconnected from Real-time Location")

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