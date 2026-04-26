#include <Arduino.h>
#include "mqtt_handle.h"

#define RXD2 16
#define TXD2 17

void setup() {
    Serial.begin(115200);
    
    // CRITICAL: Expand the hardware RX buffer BEFORE calling begin()
    // Default is 256 bytes. 1024 bytes guarantees we won't drop bursts.
    Serial2.setRxBufferSize(1024);
    Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);
    
    initWiFi();
    initMQTT();
}

void loop() {
    // 1. Maintain Network (Non-blocking)
    maintainMQTT();

    // 2. High-speed UART drain
    static char rx_buf[128];
    static int rx_idx = 0;

    // Drain the hardware buffer as fast as possible
    while (Serial2.available() > 0) {
        char c = Serial2.read();

        if (c == '\n') {
            rx_buf[rx_idx] = '\0';
            
            // Clean up carriage return (\r)
            if (rx_idx > 0 && rx_buf[rx_idx - 1] == '\r') {
                rx_buf[rx_idx - 1] = '\0';
            }

            // Process and publish immediately
            if (rx_idx > 0) {
                processAndPublish(rx_buf);
            }
            rx_idx = 0; 
        } 
        else if (rx_idx < sizeof(rx_buf) - 1) {
            rx_buf[rx_idx++] = c;
        }
    }
}