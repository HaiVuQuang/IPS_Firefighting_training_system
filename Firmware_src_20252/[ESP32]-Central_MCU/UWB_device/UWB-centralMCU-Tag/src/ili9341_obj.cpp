#include "ili9341_obj.h"

//==========================================================================================================
//
//==========================================================================================================
UserDisplay user;
FlamesDisplay flames;
MapDisplay exercise_map;


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
UserDisplay::UserDisplay()
{
    curr_pos = {0.0f, 0.0f, 0, 0};
    prev_pos = {0.0f, 0.0f, 0, 0};
    curr_yaw_angle = 0.0f;
    prev_yaw_angle = 0.0f;
    user_score = 0;
    current_vx = 0.0f;
    current_vy = 0.0f;
    last_speed_cal_time = 0;
    user_speed = 0.0f;
    is_user_updated = false;

    curr_vision_range = 0.0f;
    prev_vision_range = 0.0f;
    curr_view_cone_angle = 15.0f;
    prev_view_cone_angle = 15.0f;
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void UserDisplay::coordinate_to_pixel_position(float coor_x, float coor_y, int &pixel_x, int &pixel_y)
{
    // Normalize outlier
    if (coor_x < 0) coor_x = 0;
    if (coor_x > 10) coor_x = 10;
    if (coor_y < 0) coor_y = 0;
    if (coor_y > 10) coor_y = 10;

    // X: Mapping from 0–10 (descartes) to 9–211 (pixel)
    pixel_x = round(9 + (coor_x / 10.0f) * (211 - 9));
    // Y: Mapping from 0–10 (descartes) to 221–19 (pixel) (reverse y axis with ILI9341)
    pixel_y = round(221 - (coor_y / 10.0f) * (221 - 19));
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void UserDisplay::updateData(float coor_x, float coor_y, int score)
{
    // Update the user's lastest data
    if (coor_x <= 0 && coor_y <= 0) return;
    curr_pos.coor_x = coor_x;
    curr_pos.coor_y = coor_y;
    user_score = score;

    // Convert absolute coordinate to pixel coordinate
    coordinate_to_pixel_position(curr_pos.coor_x, curr_pos.coor_y, curr_pos.pixel_x, curr_pos.pixel_y);

    // Updated flag
    is_user_updated = true;
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void UserDisplay::clearUser(Adafruit_ILI9341 &tft)
{
    // tft.fillCircle(prev_pos.pixel_x, prev_pos.pixel_y, vision_range + 1, BLACK);
    int cx = prev_pos.pixel_x;
    int cy = prev_pos.pixel_y;
    
    // const int num_segments = 6; 
    // float total_view_angle_rad = view_cone_angle * (PI / 180.0f);
    // float angle_step = total_view_angle_rad / num_segments;
    
    
    // float start_angle = prev_yaw_angle - (total_view_angle_rad / 2.0f);

    // int prev_x = cx + round(vision_range * sinf(start_angle));
    // int prev_y = cy - round(vision_range * cosf(start_angle));

    // for (int i = 1; i <= num_segments; i++) 
    // {
    //     float current_angle = start_angle + (i * angle_step);
        
    //     int next_x = cx + round(vision_range * sinf(current_angle));
    //     int next_y = cy - round(vision_range * cosf(current_angle));

    //     tft.fillTriangle(cx, cy, prev_x, prev_y, next_x, next_y, BACKGROUND_COLOR);

    //     prev_x = next_x;
    //     prev_y = next_y;
    // }

    if (prev_vision_range > 0) {
        const int num_segments = 6; 
        float total_view_angle_rad = prev_view_cone_angle * (PI / 180.0f);
        float angle_step = total_view_angle_rad / num_segments;
        
        float start_angle = prev_yaw_angle - (total_view_angle_rad / 2.0f);

        int prev_x = cx + round(prev_vision_range * sin(start_angle));
        int prev_y = cy - round(prev_vision_range * cos(start_angle));

        for (int i = 1; i <= num_segments; i++) {
            float current_angle = start_angle + (i * angle_step);
            int next_x = cx + round(prev_vision_range * sin(current_angle));
            int next_y = cy - round(prev_vision_range * cos(current_angle));

            tft.fillTriangle(cx, cy, prev_x, prev_y, next_x, next_y, BACKGROUND_COLOR);

            prev_x = next_x;
            prev_y = next_y;
        }
    }

    // Delete user
    tft.fillCircle(cx, cy, 5, BACKGROUND_COLOR);

}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void UserDisplay::drawUser(Adafruit_ILI9341 &tft, MapDisplay &map_instance, IMU_Data &imu_data, Valve_Data &valve_data)
{

    // float half_view_cone_angle = view_cone_angle * (PI / 180);
    // float user_yaw_angle = (imu_data.euler.z - map_instance.north_offset) * (PI / 180.0f);

    // // Draw User dot
    // tft.fillCircle(curr_pos.pixel_x, curr_pos.pixel_y, 3, BLUE);

    // // Draw view 
    // for (float a = - half_view_cone_angle; a <= half_view_cone_angle; a += (1.5 * PI / 180.0f))
    // {
    //     float angle = user_yaw_angle + a;
    //     int x_edge = curr_pos.pixel_x + round(vision_range * sin(angle));
    //     int y_edge = curr_pos.pixel_y - round(vision_range * cos(angle));
    //     tft.drawLine(curr_pos.pixel_x, curr_pos.pixel_y, x_edge, y_edge, GREEN);
    // }

    curr_yaw_angle = (imu_data.euler.z - map_instance.north_offset) * (PI / 180.0f);
    
    // User pixel coordinate
    int cx = curr_pos.pixel_x;
    int cy = curr_pos.pixel_y;

    // // Number of triangle segments
    // const int num_segments = 6; 
    
    // // View angle & angle step
    // float total_view_angle_rad = view_cone_angle * (PI / 180.0f);
    // float angle_step = total_view_angle_rad / num_segments;
    
    // // Start angle 
    // float start_angle = curr_yaw_angle - (total_view_angle_rad / 2.0f);

    // int prev_x = cx + round(vision_range * sin(start_angle));
    // int prev_y = cy - round(vision_range * cos(start_angle));

    // // Draw num_segments triangle
    // for (int i = 1; i <= num_segments; i++) 
    // {
    //     float current_angle = start_angle + (i * angle_step);
        
    //     int next_x = cx + round(vision_range * sinf(current_angle));
    //     int next_y = cy - round(vision_range * cosf(current_angle));

    //     tft.fillTriangle(cx, cy, prev_x, prev_y, next_x, next_y, USER_VIEW_CONE_COLOR);

    //     prev_x = next_x;
    //     prev_y = next_y;
    // }

    // Calculate user vison_range based on valve_open_status and mode_status
    if (valve_data.mode_status < 50) {
        // Jet Mode
        curr_view_cone_angle = 20.0f;
        // 2.5 grid * 20 pixel/grid = 50 pixel (max). Cal vison_range based on %valve_open_status
        curr_vision_range = (50.0f * valve_data.valve_open_status) / 100.0f; 
    } else {
        // Spray Mode
        curr_view_cone_angle = 60.0f;
        // 1.5 grid * 20 pixel/grid = 30 pixel (max). Cal vison_range based on %valve_open_status
        curr_vision_range = (30.0f * valve_data.valve_open_status) / 100.0f; 
    }

    if (curr_vision_range > 0) {
        const int num_segments = 6; 
        float total_view_angle_rad = curr_view_cone_angle * (PI / 180.0f);
        float angle_step = total_view_angle_rad / num_segments;
        float start_angle = curr_yaw_angle - (total_view_angle_rad / 2.0f);

        int prev_x = cx + round(curr_vision_range * sin(start_angle));
        int prev_y = cy - round(curr_vision_range * cos(start_angle));

        // Draw num_segments triangle
        for (int i = 1; i <= num_segments; i++) 
        {
            float current_angle = start_angle + (i * angle_step);
            
            int next_x = cx + round(curr_vision_range * sin(current_angle));
            int next_y = cy - round(curr_vision_range * cos(current_angle));

            tft.fillTriangle(cx, cy, prev_x, prev_y, next_x, next_y, USER_VIEW_CONE_COLOR);

            prev_x = next_x;
            prev_y = next_y;
        }
    }

    // Draw user
    tft.fillCircle(cx, cy, 5, USER_DOT_COLOR);
    
    // Save previous position and heading state
    prev_pos = curr_pos;
    prev_yaw_angle = curr_yaw_angle;
    prev_vision_range = curr_vision_range;
    prev_view_cone_angle = curr_view_cone_angle;
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void UserDisplay::calculateSpeed(const IMU_Data &imu_data)
{
    unsigned long current_time = millis();
    
    // Bỏ qua lần tính đầu tiên để lấy mốc thời gian
    if (last_speed_cal_time == 0) {
        last_speed_cal_time = current_time;
        return;
    }

    // Tính delta time (giây)
    float dt = (current_time - last_speed_cal_time) / 1000.0f;
    last_speed_cal_time = current_time;

    // Lấy gia tốc thực tế (m/s^2) từ BNO055
    float ax = imu_data.acc.x;
    float ay = imu_data.acc.y;

    // --- TUNING PARAMETERS ---
    const float DEADBAND = 0.25f; 
    const float FRICTION = 0.85f; 

    // --- TRỤC X ---
    if (abs(ax) < DEADBAND) {
        current_vx *= FRICTION; 
    } else {
        current_vx += ax * dt; 
    }

    // --- TRỤC Y ---
    if (abs(ay) < DEADBAND) {
        current_vy *= FRICTION; 
    } else {
        current_vy += ay * dt;  
    }

    // --- TỔNG HỢP VECTƠ VẬN TỐC ---
    user_speed = sqrt((current_vx * current_vx) + (current_vy * current_vy));
    if (user_speed < 0.05f) {
        user_speed = 0.0f;
        current_vx = 0.0f;
        current_vy = 0.0f;
    }
}

/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
const unsigned char FlamesDisplay::icon_flame[] PROGMEM = 
{
	0xff, 0xff, 0xfe, 0xff, 0xfc, 0xff, 0xfc, 0xff, 0xfc, 0x5f, 0xfc, 0x0f, 0xec, 0x0f, 0xce, 0x0f, 
	0xc4, 0x13, 0xc0, 0x03, 0xc0, 0x03, 0xe0, 0x03, 0xe0, 0x07, 0xf0, 0x0f, 0xf8, 0x1f, 0xfe, 0x7f
};


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
FlamesDisplay::FlamesDisplay()
{
    is_flames_updated = false;
    prev_fires_num = 0;
    curr_fires_num = 0;
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void FlamesDisplay::coordinate_to_pixel_position(float coor_x, float coor_y, int &pixel_x, int &pixel_y)
{
    // Normalize outlier
    if (coor_x < 0) coor_x = 0;
    if (coor_x > 10) coor_x = 10;
    if (coor_y < 0) coor_y = 0;
    if (coor_y > 10) coor_y = 10;

    // X: Mapping from 0–10 (descartes) to 9–211 (pixel)
    pixel_x = round(9 + (coor_x / 10.0f) * (211 - 9));
    // Y: Mapping from 0–10 (descartes) to 221–19 (pixel) (reverse y axis with ILI9341)
    pixel_y = round(221 - (coor_y / 10.0f) * (221 - 19));
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void FlamesDisplay::updateData(const char *payload)
{
    // Store previous data
    prev_fires_num = curr_fires_num;
    for (int i = 0; i < MAX_FLAMES_ON_SCREEN; i++) {
        prev_flames[i] = curr_flames[i];
    }

    // De-serialise payload
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    // Error debug
    if (error) {
        Serial.print("[firefighting_data]: Invalid JSON format\r\n");        
        return; 
    }

    // Get number of fires
    curr_fires_num = doc["fires_num"];
    if (curr_fires_num > MAX_FLAMES_ON_SCREEN) {
        curr_fires_num = MAX_FLAMES_ON_SCREEN;
    }

    // Get fires data array
    JsonArray fires_array = doc["fires"];
    for (int i = 0; i < curr_fires_num; i++) {
        // Fires's: x, y (in Descartes coordinate) & Level
        int fire_x, fire_y;
        fire_x = fires_array[i]["x"];
        fire_y = fires_array[i]["y"];
        curr_flames[i].level = fires_array[i]["level"];
        // Limit edge cases
        if (curr_flames[i].level > 5) curr_flames[i].level = 5;
        if (curr_flames[i].level < 0) curr_flames[i].level = 0;

        // Convert to tft pixel coordinate 
        coordinate_to_pixel_position((float)fire_x, (float)fire_y, curr_flames[i].x, curr_flames[i].y);
    }

    // Fires updated flag
    is_flames_updated = true;
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void FlamesDisplay::clearFlames(Adafruit_ILI9341 &tft)
{
    for (int i = 0; i < prev_fires_num; i++) {

        // Browse through current flames list & check if it was changed
        bool keep_flame = false;
        for(int c = 0; c < curr_fires_num; c++) {
            if (prev_flames[i].x == curr_flames[c].x &&
                prev_flames[i].y == curr_flames[c].y &&
                prev_flames[i].level == curr_flames[c].level) 
                {
                    keep_flame = true;
                    break;
                } 
        }
        // Clear flame
        if(!keep_flame && prev_flames[i].level > 0) {
            int draw_x = prev_flames[i].x;
            int draw_y = prev_flames[i].y - ICON_HEIGHT;
            tft.fillRect(draw_x, draw_y, ICON_WIDTH, ICON_HEIGHT, BACKGROUND_COLOR);
        }
    }
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void FlamesDisplay::drawFlames(Adafruit_ILI9341 &tft)
{
    for (int i = 0; i < curr_fires_num; i++) {

        if(curr_flames[i].level <= 0) continue;

        bool already_drawn = false;

        // Browse through current flames list & check if it was đrawn
        // for (int p = 0; p < prev_fires_num; p++){
        //     if (prev_flames[p].x == curr_flames[i].x &&
        //         prev_flames[p].y == curr_flames[i].y &&
        //         prev_flames[p].level == curr_flames[i].level) 
        //         {
        //             already_drawn = true;
        //             break;
        //         } 
        // }

        // If not drawn -> draw
        if(!already_drawn) {
            int draw_x = curr_flames[i].x + 2;
            int draw_y = curr_flames[i].y - ICON_HEIGHT - 2; // Bottom left to top left
            uint16_t color = flames_lvl_color[curr_flames[i].level];
            tft.drawBitmap(draw_x, draw_y, icon_flame, ICON_WIDTH, ICON_HEIGHT, color);
        }

    }
}

// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// FlamesDisplay::FlamesDisplay()
// {
//     is_flames_updated = false;
    
//     // Browse through & Reset all Flames 
//     for(int i = 0; i <= 100; i++) {
//         curr_flames.data[i].flame_id = i;
//         curr_flames.data[i].flame_lvl = 0;
        
//         prev_flames.data[i].flame_id = i;
//         prev_flames.data[i].flame_lvl = 0;
//     }
// }


// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// void FlamesDisplay::updateData(const char *payload)
// {
//     prev_flames = curr_flames;

//     // Reset flames data buffer
//     for(int i = 0; i < 100; i++) {
//         curr_flames.data[i].flame_id = 0;
//         curr_flames.data[i].flame_lvl = 0; 
//     }

//     char buffer[strlen(payload) + 1];
//     strcpy(buffer, payload);

//     char* token = strtok(buffer, ",");

//     // Browse through the payload 
//     while (token != NULL) {
//         // Get ID
//         int id = atoi(token);

//         // Get lvl
//         token = strtok(NULL, ",");
//         if (token == NULL) break;
//         int lvl = atoi(token);

//         // Save flames data
//         if (id >= 1 && id <= 100) {
//             if (lvl > 5) lvl = 5;
//             if (lvl < 0) lvl = 0;
            
//             curr_flames.data[id].flame_lvl = lvl;
//         }

//         // Move to next <id>,<lvl>
//         token = strtok(NULL, ",");
//     }

//     // Set flames's updated flag
//     is_flames_updated = true;
// }


// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// void FlamesDisplay::grid_id_to_central_coordinate(int id, int &pixel_x, int &pixel_y)
// {
//     // Descartes coordinate mapping
//     int coor_x, coor_y;
//     if (id % 10 != 0) {
//         coor_x = id % 10;
//         coor_y = (id / 10) + 1;
//     }
//     else {
//         coor_x = 10;
//         coor_y = id / 10;
//     }

//     // Normalize outlier
//     if (coor_x < 0) coor_x = 0;
//     if (coor_x > 10) coor_x = 10;
//     if (coor_y < 0) coor_y = 0;
//     if (coor_y > 10) coor_y = 10;

//     // Convert to grid's central pixel coordinate
//     pixel_x = (20 + (coor_x - 1 ) * 20);
//     // pixel_y = (211 - coor_y * 20);
//     pixel_y = (230 - coor_y * 20);
// }

// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// void FlamesDisplay::clearFlames(Adafruit_ILI9341 &tft)
// {
//     for(int i = 1; i <= 100; i++){
//         int curr_lvl = curr_flames.data[i].flame_lvl;
//         int prev_lvl = prev_flames.data[i].flame_lvl;

//         // If unchanged, keep it
//         if (curr_lvl == prev_lvl){
//             continue;
//         }
//         else if(prev_lvl > 0){
//             int pixel_x, pixel_y;
//             grid_id_to_central_coordinate(i, pixel_x, pixel_y);
//             int draw_x = pixel_x - (ICON_WIDTH / 2);
//             int draw_y = pixel_y - (ICON_HEIGHT / 2);
//             tft.fillRect(draw_x, draw_y, ICON_WIDTH, ICON_HEIGHT, BACKGROUND_COLOR);
//         }
//     }
// }


// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// void FlamesDisplay::drawFlames(Adafruit_ILI9341 &tft)
// {
//     for(int i = 1; i <= 100; i++){
//         // Get flames lvl
//         int curr_lvl = curr_flames.data[i].flame_lvl;
//         int prev_lvl = prev_flames.data[i].flame_lvl;

//         if (curr_lvl > 0) {
//             int pixel_x, pixel_y;
//             // Convert from grid id to central pixel coordinate 
//             grid_id_to_central_coordinate(i, pixel_x, pixel_y);
//             // Align flame icon in the middle of grid
//             int draw_x = pixel_x - (ICON_WIDTH / 2);
//             int draw_y = pixel_y - (ICON_HEIGHT / 2);
//             uint16_t color = flames_lvl_color[curr_lvl];
//             //Draw bitmap for flame icon
//             tft.drawBitmap(draw_x, draw_y, icon_flame, ICON_WIDTH, ICON_HEIGHT, color);
//         }
//     }
// }



// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// MapDisplay::MapDisplay()
// {
//     north_offset = 0;
//     is_map_updated = false;
    
//     // Defaut true
//     for(int i = 0; i <= 100; i++) {
//         is_passable_grid_id[i] = true;
//     }
// }

// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// void MapDisplay::grid_id_to_topleft_coordinate(int id, int &pixel_x, int &pixel_y)
// {
//     // Descartes coordinate mapping
//     int coor_x, coor_y;
//     if (id % 10 != 0) {
//         coor_x = id % 10;
//         coor_y = (id / 10) + 1;
//     }
//     else {
//         coor_x = 10;
//         coor_y = id / 10;
//     }

//     // Normalize outlier
//     if (coor_x < 0) coor_x = 0;
//     if (coor_x > 10) coor_x = 10;
//     if (coor_y < 0) coor_y = 0;
//     if (coor_y > 10) coor_y = 10;

//     // Convert to grid's top left pixel coordinate
//     pixel_x = (10 + (coor_x - 1 ) * 20);
//     pixel_y = (221 - coor_y * 20);
// }

// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// void MapDisplay::updateData(const char *payload)
// {
//     // Reset map marker array 
//     for(int i = 1; i <= 100; i++) {
//         is_passable_grid_id[i] = true;
//     }

//     // Payload buffer
//     char buffer[512];
//     strncpy(buffer, payload, sizeof(buffer) - 1);
//     buffer[sizeof(buffer) - 1] = '\0';

//     // The first element is map's north offset angle
//     char* token = strtok(buffer, ",");
//     if(token != NULL) {
//         north_offset = atoi(token);
//     }

//     // Mark not passable grid
//     while (token != NULL) {
//         token = strtok(NULL, ",");
//         if(token == NULL) break;

//         int id = atoi(token);
//         if(id >= 1 && id <= 100){
//             is_passable_grid_id[id] = false;            
//         }
//     }
//     is_map_updated = true;
// }


// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// void MapDisplay::clearMap(Adafruit_ILI9341 &tft)
// {
//     // Draw fuking huge big black box :))
//     tft.fillRect(10, 21, 200, 200, BACKGROUND_COLOR);
// }


// /*--------------------------------------------------------------------------------------------------------*/
// /**
//  * @brief
//  */
// /*--------------------------------------------------------------------------------------------------------*/
// void MapDisplay::drawMap(Adafruit_ILI9341 &tft)
// {
//     int pixel_x, pixel_y;
//     for (int i = 1; i <= 100; i++){
//         // Draw passable map grid
//         if(is_passable_grid_id[i]){
//             grid_id_to_topleft_coordinate(i, pixel_x, pixel_y);
//             tft.drawRect(pixel_x, pixel_y, 20, 20, MAP_GRID_COLOR);
//         }
//         // Draw unpassable map grid
//         else{
//             grid_id_to_topleft_coordinate(i, pixel_x, pixel_y);
//             tft.drawLine(pixel_x + 10, pixel_y, pixel_x, pixel_y + 10, NOT_MAP_GRID_COLOR);
//             // tft.drawLine(x_coord + 20, y_coord, x_coord, y_coord + 20, WHITE);
//             tft.drawLine(pixel_x + 20, pixel_y + 10, pixel_x + 10, pixel_y + 20, NOT_MAP_GRID_COLOR);
//         }
//     }
// }


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
MapDisplay::MapDisplay()
{
    north_offset = 0.0f;
    is_map_updated = false;
    max_map_x = 10;
    max_map_y = 10;

    for (int x = 0; x < 10; x++) {
        for(int y = 0; y < 10; y++) {
            is_passable[x][y] = false;
        }
    }
}

/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void MapDisplay::coordinate_to_topleft_pixel(int x, int y, int &pixel_x, int &pixel_y)
{
    if (x < 0) x = 0; if (x > 9) x = 9;
    if (y < 0) y = 0; if (y > 9) y = 9;

    pixel_x = 10 + (x * 20);
    pixel_y = 221 - ((y + 1) * 20);
}

/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void MapDisplay::updateData(const char *payload)
{
    // De-serialise payload
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    // Debug
    if (error) {
        Serial.println("[map_data]: Invalid JSON format");
        return; 
    }

    // Get map info
    north_offset = doc["info"]["north_offset"];
    max_map_x = doc["info"]["x"];
    max_map_y = doc["info"]["y"];

    // Reset map
    for(int x = 0; x < 10; x++) {
        for(int y = 0; y < 10; y++) {
            is_passable[x][y] = false;
        }
    }

    // Get the passable cell/grid coordinate array
    JsonArray cells_array = doc["cells"];
    for (JsonArray cell : cells_array) {

        int x = cell[0];
        int y = cell[1];

        // Marked as passable grid
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
            is_passable[x][y] = true;
        }
        is_map_updated = true;
    }
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void MapDisplay::clearMap(Adafruit_ILI9341 &tft)
{
    // Draw fuking huge big black box :))
    tft.fillRect(10, 21, 200, 200, BACKGROUND_COLOR);
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void MapDisplay::drawMap(Adafruit_ILI9341 &tft)
{
    int pixel_x, pixel_y;

    // Browse through all 10x10 grid
    for (int x = 0; x < 10; x++) {
        for (int y = 0; y < 10; y++) {
            
            // Lấy tọa độ góc trên bên trái của ô lưới để vẽ
            coordinate_to_topleft_pixel(x, y, pixel_x, pixel_y);

            if (is_passable[x][y]) {
                // Draw passable grid
                tft.drawRect(pixel_x, pixel_y, 20, 20, MAP_GRID_COLOR);
            } 
            else {
                // Draw unpassable grid
                tft.drawLine(pixel_x + 10, pixel_y, pixel_x, pixel_y + 10, NOT_MAP_GRID_COLOR);
                tft.drawLine(pixel_x + 20, pixel_y + 10, pixel_x + 10, pixel_y + 20, NOT_MAP_GRID_COLOR);
            }
        }
    }
}