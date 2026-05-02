#ifndef DATA_HANDLE_H
#define DATA_HANDLE_H

#include "config.h"
#include "ili9341_obj.h"
#include "peripheral_handle.h"


void handle_mqtt_topic_user_pos(UserDisplay &user_instance, const char* payload);

void handle_mqtt_topic_flames_data(FlamesDisplay &flames_instance, const char* payload);

void handle_mqtt_topic_map_data(MapDisplay &map_instance, const char* payload);

void packing_mqtt_payload_device_data();

void publish_mqtt_payload_device_data();

#endif