from pydantic import BaseModel
from typing import List

class UserSchema(BaseModel):
    id: int | None = None
    username: str
    password: str

class MapInfoSchema(BaseModel):
    map_info_id: int | None = None
    total_units: int
    area_of_one_unit: float
    walkable_area: int
    router_number: int
    router_location: List[str]
    rows: int
    cols: int
    blocked_cells: List[str]

class UwbMapInfoSchema(BaseModel):
    map_info_id: int | None = None
    total_units: int
    area_of_one_unit: float
    walkable_area: int
    beacon_number: int
    beacon_location: dict
    rows: int
    cols: int
    blocked_cells: List[str]

class DeviceInfoSchema(BaseModel):
    device_info_id: int | None = None
    rssi_wifi_1: float
    rssi_wifi_2: float
    rssi_wifi_3: float
    rssi_wifi_4: float
    rssi_ble_1: float
    rssi_ble_2: float  
    rssi_ble_3: float
    rssi_ble_4: float
    accx: float
    accy: float
    accz: float
    magx: float
    magy: float
    magz: float
    gyrox: float
    gyroy: float
    gyroz: float
    eulerx: float
    eulery: float
    eulerz: float

class RSSIForTrainingSchema(BaseModel):
    rssi_for_training_id: int | None = None
    map_info_id: int = 0
    coord_x: float = 0.0
    coord_y: float = 0.0
    rssi_wifi_1: float
    rssi_wifi_2: float
    rssi_wifi_3: float
    rssi_wifi_4: float
    rssi_ble_1: float
    rssi_ble_2: float
    rssi_ble_3: float
    rssi_ble_4: float
    magnetic_field_y: float
    magnetic_field_z: float
    samples: int = 1

class CollectDataRequestSchema(BaseModel):
    map_info_id: int
    coord_x: float
    coord_y: float
    samples: int = 1