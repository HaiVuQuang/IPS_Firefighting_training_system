#include "mqtt_handle.h"

WiFiClient espClient;
PubSubClient mqttClient(espClient);

static unsigned long lastReconnectAttempt = 0;

void initWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected!");
}

void initMQTT() {
    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
}

// Non-blocking reconnect to prevent UART buffer overflow if network drops
void maintainMQTT() {
    if (!mqttClient.connected()) {
        unsigned long now = millis();
        // Try to reconnect every 2 seconds without trapping the CPU in a while loop
        if (now - lastReconnectAttempt > 2000) {
            lastReconnectAttempt = now;
            Serial.print("Attempting MQTT connection...");
            
            String clientId = "ESP32-Master-" + String(random(0xffff), HEX);
            
            if (mqttClient.connect(clientId.c_str())) {
                Serial.println("connected");
            } else {
                Serial.println("failed, will try again...");
            }
        }
    } else {
        // Keep the MQTT connection alive
        mqttClient.loop();
    }
}

// Directly format and publish the parsed string
void processAndPublish(char* data) {
    // Drop the packet immediately if we have no network to prevent lockups
    if (!mqttClient.connected()) {
        return; 
    }

    char topic[64];
    
    // Find the first comma in "0x01,0xD0,120,0xC0,500"
    char* comma_ptr = strchr(data, ',');
    
    if (comma_ptr != NULL) {
        *comma_ptr = '\0'; // Replace comma with string terminator
        
        char* slave_id_str = data;           // "0x01"
        char* payload_str = comma_ptr + 1;   // "0xD0,120,0xC0,500"

        // Format the topic: /uwb_ranging/0xF0/0x01
        snprintf(topic, sizeof(topic), "2/uwb_ranging/%s/%s", MASTER_ID, slave_id_str);
        
        // Publish to broker
        mqttClient.publish(topic, payload_str);
        
        // Debug (Comment out in production to save micro-seconds)
        Serial.printf("Msg: %s\n", topic, payload_str);
    }
}