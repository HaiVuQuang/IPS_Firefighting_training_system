#include "data_handle.h"

/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
void handle_mqtt_topic_user_pos(UserDisplay &user_instance, const char* payload)
{
    String data = String(payload);
    int commaIndex1 = data.indexOf(',');
    int commaIndex2 = data.indexOf(',', commaIndex1 + 1);

    if (commaIndex1 != -1 && commaIndex2 != -1) {
        String x = data.substring(0, commaIndex1);
        String y = data.substring(commaIndex1 + 1, commaIndex2);
        String score = data.substring(commaIndex2 + 1);

        user_instance.hasNewData();
        user_instance.updateData(x.toFloat(), y.toFloat(), score.toInt());
        // Serial.println("User position updated!"\r\n);
    }
}


/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
void handle_mqtt_topic_flames_data(FlamesDisplay &flames_instance, const char* payload)
{
    flames_instance.hasNewData();
    flames_instance.updateData(payload);
    // Serial.println("Flames updated!\r\n");
}


/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
void handle_mqtt_topic_map_data(MapDisplay &map_instance, const char* payload)
{
    map_instance.hasNewData();
    map_instance.updateData(payload);
    // Serial.println("Map updated!\r\n");
}

/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
void packing_mqtt_payload_device_data(){

}