import paho.mqtt.client as mqtt
import asyncio
import json
from random import randrange

from models import RSSIForTrainingSchema
from pydantic import ValidationError

broker = '127.0.0.1'
port = 1883
client_id = f'python-mqtt-{randrange(0, 100)}'

# Biến toàn cục để lưu trữ event loop và hàm callback gọi khi có sự kiện MQTT
_loop = None
_on_message_callback = None

# Hàm khởi tạo cầu nối giữa MQTT và async (được gọi từ main.py khi khởi động FastAPI)
def init_async_bridge(loop: asyncio.AbstractEventLoop, callback):
    global _loop, _on_message_callback
    _loop = loop
    _on_message_callback = callback

#  Callback tự gọi khi kết nối thành công đến broker
def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print("✅ Connected to MQTT Broker!")
        client.subscribe("device_info")
        client.subscribe("2/uwb_ranging/#")
    else:
        print(f"Failed to connect MQTT, return code {reason_code}")

# Callback trung gian chuyển cho callback chính
def safe_callback(item):
    if _on_message_callback:
        _on_message_callback(item)

# Callback gọi khi nhận được tin nhắn từ topic mà client đã sub
def on_message(client, userdata, msg):
    global _loop
    if _loop is None:
        return
    
    topic = msg.topic
    payload = msg.payload.decode()  #chuyển tin nhắn từ bytes -> string

# Xử lý tin nhắn với topic "device_info"
    if topic == "device_info":

        try:
            payload_dict = json.loads(payload)  
            validated = RSSIForTrainingSchema(**payload_dict)
            msg_dict = validated.model_dump()
            msg_dict["data_type"] = "rssi"      # Thêm nhãn data_type
            _loop.call_soon_threadsafe(safe_callback, msg_dict)
            print(f"Received MQTT message {msg_dict}")     
            
        except ValidationError as e:
            print(f"Invalid MQTT payload structure: {e}")
        except json.JSONDecodeError:
            print("Payload is not valid JSON")

# Xử lý tin nhắn với topic bắt đầu bằng "2/uwb_ranging/" 
    elif topic.startswith("2/uwb_ranging/"):
        try:
            topic_parts = topic.split('/')
            if len(topic_parts) >= 4:
                beacon_id = topic_parts[3] 
                data_parts = payload.split(',')
                
                measurements = {}
                
                for i in range(0, len(data_parts) - 1, 2):
                    tag_id = data_parts[i].strip()
                    dist_str = data_parts[i+1].strip()
                    
                    if tag_id and dist_str: 
                        try:
                            measurements[tag_id] = float(dist_str) / 100.0
                        except ValueError:
                            print(f"[UWB] Skip invalid value of {tag_id}: {dist_str}")
                
                # Chỉ gửi bản tin lên Main xử lý nếu có ít nhất 1 Tag hợp lệ
                if measurements:
                    uwb_msg = {
                        "data_type": "uwb",
                        "beacon_id": beacon_id,
                        "measurements": measurements
                    }
                    _loop.call_soon_threadsafe(safe_callback, uwb_msg)
                    print(f"Received MQTT message: {uwb_msg}")
                    
        except Exception as e:
            print(f"[UWB] Error parsing message: {e}")

# Tạo kết nối MQTT client
def connect_mqtt() -> mqtt.Client:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect_async(broker, port)
    client.loop_start()
    return client

