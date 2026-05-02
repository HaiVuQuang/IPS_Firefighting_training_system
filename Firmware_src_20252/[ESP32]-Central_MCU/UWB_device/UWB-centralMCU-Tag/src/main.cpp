#include "config.h"
#include "data_handle.h"
#include "ili9341_obj.h"
#include "ili9341_ui.h"
#include "mqtt_handle.h"
#include "peripheral_handle.h"



void setup() {

    // --- Set up Serial Monitor ---
    Serial.begin(BAUD_RATE_SERIAL);

    // --- Initialize GPIO pins for buttons and analog inputs ---
    init_button_and_valve();

    // --- Initialize on-device BNO055 --- 
    init_on_device_bno055();

    // --- Initialize TFT display ---
    TFT_setup(tft);
    tft_setup_intro(tft);
    tft_setup_static_ui(tft);

    // --- Set up WiFi and MQTT connection ---
    init_connection_with_mqtt_broker();

}

void loop() {

    if (!mqtt_client.connected()) {
        reconnect_mqtt();
    }
    mqtt_client.loop();

    read_IMU_data();

    read_valve_open_status();

    packing_mqtt_payload_device_data();
    publish_mqtt_payload_device_data();

    tft_main_loop_handler(tft, user, flames, exercise_map, imu_data, valve_data);
}

