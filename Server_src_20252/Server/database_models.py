from sqlalchemy import Column, Integer, String, Float, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    password = Column(String(100))

class MapInfo(Base):
    __tablename__ = "map_info"

    map_info_id = Column(Integer, primary_key=True)
    total_units = Column(Integer)
    area_of_one_unit = Column(Float)
    walkable_area = Column(Integer)
    router_number = Column(Integer)
    router_location = Column(JSON, default=[])
    rows = Column(Integer)
    cols = Column(Integer)
    blocked_cells = Column(JSON, default=[])

class UwbMapInfo(Base):
    __tablename__ = "uwb_map_info"

    map_info_id = Column(Integer, primary_key=True)
    total_units = Column(Integer)
    area_of_one_unit = Column(Float)
    walkable_area = Column(Integer)
    rows = Column(Integer)
    cols = Column(Integer)
    blocked_cells = Column(JSON, default=[])
  
class DeviceInfo(Base):
    __tablename__ = "device_info"

    device_info_id = Column(Integer, primary_key=True)
    rssi_wifi_1 = Column(Float)
    rssi_wifi_2 = Column(Float)
    rssi_wifi_3 = Column(Float)
    rssi_wifi_4 = Column(Float)
    rssi_ble_1 = Column(Float)
    rssi_ble_2 = Column(Float)  
    rssi_ble_3 = Column(Float)
    rssi_ble_4 = Column(Float)
    accx = Column(Float)
    accy = Column(Float)
    accz = Column(Float)
    magx = Column(Float)
    magy = Column(Float)
    magz = Column(Float)
    gyrox = Column(Float)
    gyroy = Column(Float)
    gyroz = Column(Float)
    eulerx = Column(Float)
    eulery = Column(Float)
    eulerz = Column(Float)

class RSSIForTraining(Base):
    __tablename__ = "rssi_for_training"

    rssi_for_training_id = Column(Integer, primary_key=True)
    map_info_id = Column(Integer, ForeignKey("map_info.map_info_id"))
    coord_x = Column(Float)
    coord_y = Column(Float)
    rssi_wifi_1 = Column(Float)
    rssi_wifi_2 = Column(Float)
    rssi_wifi_3 = Column(Float)
    rssi_wifi_4 = Column(Float)
    rssi_ble_1 = Column(Float)
    rssi_ble_2 = Column(Float)
    rssi_ble_3 = Column(Float)
    rssi_ble_4 = Column(Float)
    magnetic_field_y = Column(Float)
    magnetic_field_z = Column(Float)
    samples = Column(Integer, default=1)