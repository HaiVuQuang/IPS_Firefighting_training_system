## 1. Topic: MQTT_USER_POS_TOPIC

**Topic** user_pos/0xC0

**MQTT cmd** mosquitto_pub -h "192.168.1.247" -p 1883 -t "user_pos/0xC0" -m ""

**Test_1**
{
  "x": 2.5,
  "y": 4.8,
  "score": 150
}

mosquitto_pub -h "192.168.1.247" -p 1883 -t "user_pos/0xC0" -m "{"x": 2.5,"y": 4.8,"score": 150}"
**Test_2**
{
  "x": 3.7,
  "y": 6.1,
  "score": 250
}

mosquitto_pub -h "192.168.1.247" -p 1883 -t "user_pos/0xC0" -m "{"x": 3.7,"y": 6.1,"score": 250}
## 2. Topic: MQTT_MAP_DATA_TOPIC

**Topic** map_data

**MQTT cmd** mosquitto_pub -h "192.268.1.247" -p 1883 -t "map_data" -m ""

**Test_1**
{
  "info": {
    "x": 8,
    "y": 9,
    "north_offset": 0.0
  },
  "cells": [
    [0, 0], [1, 0], [2, 0], [3, 0], 
    [0, 1], [0, 2], [0, 3], [8, 6],
    [5, 5], [5, 6], [6, 5], [6, 6],
    [3, 6], [2, 4], [7, 8], [8, 7],
    [1, 2], [1, 3], [1, 4], [1, 5],
    [2, 2], [2, 3], [2, 7], [2, 5],
    [3, 3], [3, 3], [3, 4], [3, 5]
  ]
}

mosquitto_pub -h "192.168.1.247" -p 1883 -t "map_data" -m "{"info": {"x": 8,"y": 9,"north_offset": 0.0},"cells": [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [0, 2], [0, 3], [8, 6],[5, 5], [5, 6], [6, 5], [6, 6],[3, 6], [2, 4], [7, 8], [8, 7],[1, 2], [1, 3], [1, 4], [1, 5],[2, 2], [2, 3], [2, 7], [2, 5],[3, 3], [3, 3], [3, 4], [3, 5]]}"

## 2. Topic: MQTT_FLAMES_DATA_TOPIC
**Topic** fire_data

**MQTT cmd** mosquitto_pub -h "192.168.1.247" -p 1883 -t "fire_data" -m ""

**Test_1**
{
  "fires_num": 3,
  "fires": [
    { "x": 1, "y": 1, "level": 1 },
    { "x": 5, "y": 5, "level": 3 },
    { "x": 8, "y": 8, "level": 5 }
  ]
}

**Test_2**
{
  "fires_num": 3,
  "fires": [
    { "x": 1, "y": 1, "level": 0 },
    { "x": 5, "y": 5, "level": 0 },
    { "x": 8, "y": 8, "level": 0 }
  ]
}

**Test_2**
{
  "fires_num": 5,
  "fires": [
    { "x": 3, "y": 4, "level": 1 },
    { "x": 5, "y": 6, "level": 2 },
    { "x": 1, "y": 2, "level": 3 },
    { "x": 7, "y": 8, "level": 4 },
    { "x": 9, "y": 10, "level": 5 }
  ]
}