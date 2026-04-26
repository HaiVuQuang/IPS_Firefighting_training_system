#include "mqtt_handle.h"

/*#############################################################################################################*/
// Global variables 
/*#############################################################################################################*/
WiFiClient wifi_client;
PubSubClient mqtt_client(wifi_client);

static char mqtt_user_pos_topic[50];           // Server -> Device: Device coordinates data (localization) 
static char mqtt_fire_data_topic[50];          // Server -> Device: Fire data & status for firefighting 
static char mqtt_map_data_topic[50];           // Server -> Device: Firefighting training map configuration
static char mqtt_user_data_topic[50];          // Device -> Server: Device data (IMU, Valve,...)


/*#############################################################################################################*/
/**
 * @brief Connect to WiFi network
 * @return Connection status
 */
/*#############################################################################################################*/
bool connect_wifi() 
{
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long start_time = millis();
    
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start_time > WIFI_TIMEOUT) {
            return false;
        }
        delay(100);
    }
    return true;
}

/*#############################################################################################################*/
/**
 * @brief Connect to MQTT broker
 * @return Connection status
 */
/*#############################################################################################################*/

bool connect_mqtt() 
{
    mqtt_client.setServer(MQTT_BROKER, MQTT_PORT);
    
    if (!mqtt_client.connected()) {
        return mqtt_client.connect(MQTT_CLIENT_ID);
    }
    return true;
}


/*#############################################################################################################*/
/**
 * @brief Initialise WiFi, connection with MQTT broker and subcribe to MQTT topics 
 */
/*#############################################################################################################*/
void init_connection_with_mqtt_broker() 
{
    if (!connect_wifi())
    {
        Serial.println("WiFi connection -> Failed!");
        return;
    }

    if (!connect_mqtt())
    {
        Serial.println("Connect to MQTT broker -> Failed!");
        return;
    }
    snprintf(mqtt_user_pos_topic, sizeof(mqtt_user_pos_topic), "%d/user_pos/%02X", MY_IPS_ALGO_CODE, MY_DEVICE_ID);
    snprintf(mqtt_fire_data_topic, sizeof(mqtt_fire_data_topic), "%d/firefighting_data", MY_IPS_ALGO_CODE);
    snprintf(mqtt_map_data_topic, sizeof(mqtt_map_data_topic), "%d/map_data", MY_IPS_ALGO_CODE);
    snprintf(mqtt_user_data_topic, sizeof(mqtt_user_data_topic), "%d/user_data/%02X", MY_IPS_ALGO_CODE, MY_DEVICE_ID);

    mqtt_client.subscribe(mqtt_user_pos_topic);
    mqtt_client.subscribe(mqtt_fire_data_topic);
    mqtt_client.subscribe(mqtt_map_data_topic);
    mqtt_client.setCallback(mqtt_callback);
    Serial.println("Connect to MQTT broker -> OK");
}


/*#############################################################################################################*/
/**
 * @brief Reconnect to MQTT broker
 * @return Connection status
 */
/*#############################################################################################################*/
void reconnect_mqtt() {
    while (!mqtt_client.connected()) {
        Serial.print("Attempting MQTT connection...");
        if (mqtt_client.connect("STM32_Device_C0")) {
            Serial.println("connected");
            mqtt_client.subscribe(mqtt_user_pos_topic);
            mqtt_client.subscribe(mqtt_fire_data_topic);
            mqtt_client.subscribe(mqtt_map_data_topic);
        } else {
            Serial.print("failed, rc=");
            Serial.print(mqtt_client.state());
            Serial.println(" Try again in 5 seconds");
            delay(5000);
        }
    }
}


/*#############################################################################################################*/
/**
 * @brief Publish MQTT message
 * @param topic Target MQTT topic
 * @param message Message content
 * @return Publish status
 */
/*#############################################################################################################*/

bool publish_message(String topic, String message) 
{
    if (!mqtt_client.connected()) {
        if (!connect_mqtt()) {
            return false;
        }
    }
    return mqtt_client.publish(topic.c_str(), message.c_str());
}

/*#############################################################################################################*/
/**
 * @brief MQTT callback for message from subscribed topic
 * @param topic Target MQTT topic
 * @param payload MQTT payload
 * @param length MQTT payload length
 */
/*#############################################################################################################*/
void mqtt_callback(char* topic, byte* payload, unsigned int length)
{
    // Normalize message
    char message[length + 1];
    memcpy(message, payload, length);
    message[length] = '\0';

    // Redirect callback handle based on topic
    if (strcmp(topic, mqtt_user_pos_topic) == 0) {
        handle_mqtt_topic_user_pos(message);
    }
    else if(strcmp(topic, mqtt_fire_data_topic) == 0){
       handle_mqtt_topic_fire_data(message);
    }
    else if(strcmp(topic, mqtt_map_data_topic) == 0){
        handle_mqtt_topic_map_data(message);
    }
}


