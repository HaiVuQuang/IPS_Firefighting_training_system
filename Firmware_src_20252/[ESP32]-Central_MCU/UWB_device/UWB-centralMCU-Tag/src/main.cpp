#include "config.h"
#include "data_handle.h"
#include "ili9341_obj.h"
#include "ili9341_ui.h"
#include "mqtt_handle.h"
#include "peripheral_handle.h"

// Initialize Adafruit ILI9341 TFT display
Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_RST);

void setup() {

    // --- Set up Serial Monitor ---
    Serial.begin(BAUD_RATE_SERIAL);

    // --- Initialize GPIO pins for buttons and analog inputs ---
    init_button_and_valve();

    // --- Initialize on-device BNO055 --- 
    init_on_device_bno055();

    // --- Initialize TFT display ---
    tft.begin();
    tft.setRotation(LCD_ROTATION);

    // --- Set up WiFi and MQTT connection ---
    init_connection_with_mqtt_broker();

}

void loop() {

    if (!mqtt_client.connected()) {
        reconnect_mqtt();
    }
    mqtt_client.loop();

    
}

