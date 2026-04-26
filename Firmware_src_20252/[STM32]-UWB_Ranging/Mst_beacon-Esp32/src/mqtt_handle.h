#ifndef MQTT_HANDLE_H
#define MQTT_HANDLE_H

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

// --- Configuration ---
#define WIFI_SSID       "RSSI3"
#define WIFI_PASSWORD   "11111111"
#define MQTT_SERVER     "192.168.0.102"
#define MQTT_PORT       1883
#define MASTER_ID       "0xF0"

// --- Extern Variables ---
extern PubSubClient mqttClient;

// --- Function Prototypes ---
void initWiFi();
void initMQTT();
void maintainMQTT();
void processAndPublish(char* data);

#endif // MQTT_HANDLE_H