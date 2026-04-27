#ifndef DATA_HANDLE_H
#define DATA_HANDLE_H

#include "config.h"
#include "ili9341_obj.h"


void handle_mqtt_topic_user_pos(UserDisplay &user_instance, const char* payload);

void handle_mqtt_topic_flames_data(FlamesDisplay &flames_instance, const char* payload);

void handle_mqtt_topic_map_data(MapDisplay &map_instance, char* payload);


#endif