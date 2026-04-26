#ifndef DATA_HANDLE_H
#define DATA_HANDLE_H

#include "config.h"


void handle_mqtt_topic_user_pos(const char* payload);

void handle_mqtt_topic_fire_data(const char* payload);

void handle_mqtt_topic_map_data(const char* payload);


#endif