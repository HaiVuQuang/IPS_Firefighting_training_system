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
    user_speed = 0;
    is_user_updated = false;
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
    // Save user's the previous position
    prev_pos = curr_pos;

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
    
    const int num_segments = 6; 
    float total_view_angle_rad = view_cone_angle * (PI / 180.0f);
    float angle_step = total_view_angle_rad / num_segments;
    
    
    float start_angle = prev_yaw_angle - (total_view_angle_rad / 2.0f);

    int prev_x = cx + round(vision_range * sinf(start_angle));
    int prev_y = cy - round(vision_range * cosf(start_angle));

    for (int i = 1; i <= num_segments; i++) 
    {
        float current_angle = start_angle + (i * angle_step);
        
        int next_x = cx + round(vision_range * sinf(current_angle));
        int next_y = cy - round(vision_range * cosf(current_angle));

        tft.fillTriangle(cx, cy, prev_x, prev_y, next_x, next_y, BACKGROUND_COLOR);

        prev_x = next_x;
        prev_y = next_y;
    }

    // Delete user
    tft.fillCircle(cx, cy, 3, BACKGROUND_COLOR);

}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void UserDisplay::drawUser(Adafruit_ILI9341 &tft, MapDisplay &map_instance)
{

    // float half_view_cone_angle = view_cone_angle * (PI / 180);
    // float user_yaw_angle = (imu_data.euler.x - map_instance.north_offset) * (PI / 180.0f);

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

    curr_yaw_angle = (imu_data.euler.x - map_instance.north_offset) * (PI / 180.0f);
    
    // User pixel coordinate
    int cx = curr_pos.pixel_x;
    int cy = curr_pos.pixel_y;

    // Number of triangle segments
    const int num_segments = 6; 
    
    // View angle & angle step
    float total_view_angle_rad = view_cone_angle * (PI / 180.0f);
    float angle_step = total_view_angle_rad / num_segments;
    
    // Start angle 
    float start_angle = curr_yaw_angle - (total_view_angle_rad / 2.0f);

    int prev_x = cx + round(vision_range * sin(start_angle));
    int prev_y = cy - round(vision_range * cos(start_angle));

    // Draw num_segments triangle
    for (int i = 1; i <= num_segments; i++) 
    {
        float current_angle = start_angle + (i * angle_step);
        
        int next_x = cx + round(vision_range * sinf(current_angle));
        int next_y = cy - round(vision_range * cosf(current_angle));

        tft.fillTriangle(cx, cy, prev_x, prev_y, next_x, next_y, USER_VIEW_CONE_COLOR);

        prev_x = next_x;
        prev_y = next_y;
    }

    // Draw user
    tft.fillCircle(cx, cy, 3, USER_DOT_COLOR);
    prev_yaw_angle = curr_yaw_angle;
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
const unsigned char FlamesDisplay::icon_flame[] PROGMEM = {
    0x00, 0x7e, 0xfe, 0x3e, 0xfe, 0x1e, 0xf4, 0x0e, 
    0xf0, 0x0e, 0xe0, 0x06, 0xe1, 0x86, 0xf3, 0xce, 
    0xf1, 0x8e, 0x78, 0x1e, 0x0e, 0x70, 0xe1, 0x86, 
    0xf8, 0x1e, 0xf0, 0x0e, 0x87, 0xe0
};


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
FlamesDisplay::FlamesDisplay()
{
    is_flames_updated = false;
    
    // Browse through & Reset all Flames 
    for(int i = 0; i <= 100; i++) {
        curr_flames.data[i].flame_id = i;
        curr_flames.data[i].flame_lvl = 0;
        
        prev_flames.data[i].flame_id = i;
        prev_flames.data[i].flame_lvl = 0;
    }
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void FlamesDisplay::updateData(const char *payload)
{
    prev_flames = curr_flames;

    // Reset flames data buffer
    for(int i = 0; i < 100; i++) {
        curr_flames.data[i].flame_id = 0;
        curr_flames.data[i].flame_lvl = 0; 
    }

    char buffer[strlen(payload) + 1];
    strcpy(buffer, payload);

    char* token = strtok(buffer, ",");

    // Browse through the payload 
    while (token != NULL) {
        // Get ID
        int id = atoi(token);

        // Get lvl
        token = strtok(NULL,",");
        if (token == NULL) break;
        int lvl = atoi(token);

        // Save flames data
        if (id >= 1 && id <= 100) {
            if (lvl > 5) lvl = 5;
            if (lvl < 0) lvl = 0;
            
            curr_flames.data[id].flame_lvl = lvl;
        }

        // Move to next <id>,<lvl>
        token = strtok(NULL, ",");
    }

    // Set flames's updated flag
    is_flames_updated = true;
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void FlamesDisplay::grid_id_to_central_coordinate(int id, int &pixel_x, int &pixel_y)
{
    // Descartes coordinate mapping
    int coor_x, coor_y;
    if (id % 10 != 0) {
        coor_x = id % 10;
        coor_y = (id / 10) + 1;
    }
    else {
        coor_x = 10;
        coor_y = id / 10;
    }

    // Normalize outlier
    if (coor_x < 0) coor_x = 0;
    if (coor_x > 10) coor_x = 10;
    if (coor_y < 0) coor_y = 0;
    if (coor_y > 10) coor_y = 10;

    // Convert to grid's central pixel coordinate
    // pixel_x = (10 + (coor_x - 1 ) * 20);
    // pixel_y = (221 - coor_y * 20);
    pixel_x = (20 + (coor_x - 1 ) * 20);
    pixel_y = (211 - coor_y * 20);
}

/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void FlamesDisplay::clearFlames(Adafruit_ILI9341 &tft)
{
    for(int i = 1; i <= 100; i++){
        int curr_lvl = curr_flames.data[i].flame_lvl;
        int prev_lvl = prev_flames.data[i].flame_lvl;

        // If unchanged, keep it
        if (curr_lvl == prev_lvl){
            continue;
        }
        else if(prev_lvl > 0){
            int pixel_x, pixel_y;
            grid_id_to_central_coordinate(i, pixel_x, pixel_y);
            int draw_x = pixel_x - (ICON_WIDTH / 2);
            int draw_y = pixel_y - (ICON_HEIGHT / 2);
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
    for(int i = 1; i <= 100; i++){
        // Get flames lvl
        int curr_lvl = curr_flames.data[i].flame_lvl;
        int prev_lvl = prev_flames.data[i].flame_lvl;

        if (curr_lvl > 0) {
            int pixel_x, pixel_y;
            // Convert from grid id to central pixel coordinate 
            grid_id_to_central_coordinate(i, pixel_x, pixel_y);
            // Align flame icon in the middle of grid
            int draw_x = pixel_x - (ICON_WIDTH / 2);
            int draw_y = pixel_y - (ICON_HEIGHT / 2);
            uint16_t color = flames_lvl_color[curr_lvl];
            //Draw bitmap for flame icon
            tft.drawBitmap(draw_x, draw_y, icon_flame, ICON_WIDTH, ICON_HEIGHT, color);
        }
    }
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
MapDisplay::MapDisplay()
{
    north_offset = 0;
    is_map_updated = false;
    
    // Defaut true
    for(int i = 0; i <= 100; i++) {
        is_passable_grid_id[i] = true;
    }
}

/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void MapDisplay::grid_id_to_topleft_coordinate(int id, int &pixel_x, int &pixel_y)
{
    // Descartes coordinate mapping
    int coor_x, coor_y;
    if (id % 10 != 0) {
        coor_x = id % 10;
        coor_y = (id / 10) + 1;
    }
    else {
        coor_x = 10;
        coor_y = id / 10;
    }

    // Normalize outlier
    if (coor_x < 0) coor_x = 0;
    if (coor_x > 10) coor_x = 10;
    if (coor_y < 0) coor_y = 0;
    if (coor_y > 10) coor_y = 10;

    // Convert to grid's top left pixel coordinate
    pixel_x = (10 + (coor_x - 1 ) * 20);
    pixel_y = (221 - coor_y * 20);
}

/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void MapDisplay::updateData(const char *payload)
{
    // Reset map marker array 
    for(int i = 1; i <= 100; i++) {
        is_passable_grid_id[i] = true;
    }

    // Payload buffer
    char buffer[512];
    strncpy(buffer, payload, sizeof(buffer) - 1);
    buffer[sizeof(buffer) - 1] = '\0';

    // The first element is map's north offset angle
    char* token = strtok(buffer, ",");
    if(token != NULL) {
        north_offset = atoi(token);
    }

    // Mark not passable grid
    while (token != NULL) {
        token = strtok(NULL, ",");
        if(token == NULL) break;

        int id = atoi(token);
        if(id >= 1 && id <= 100){
            is_passable_grid_id[id] = false;            
        }
    }
    is_map_updated = true;
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void MapDisplay::clearMap(Adafruit_ILI9341 &tft)
{
    // Draw fuking huge big black box :))
    tft.drawRect(10, 21, 200, 200, BACKGROUND_COLOR);
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void MapDisplay::drawMap(Adafruit_ILI9341 &tft)
{
    int pixel_x, pixel_y;
    for (int i = 1; i <= 100; i++){
        // Draw passable map grid
        if(is_passable_grid_id[i]){
            grid_id_to_topleft_coordinate(i, pixel_x, pixel_y);
            tft.drawRect(pixel_x, pixel_y, 20, 20, MAP_GRID_COLOR);
        }
        // Draw unpassable map grid
        else{
            grid_id_to_topleft_coordinate(i, pixel_x, pixel_y);
            tft.drawLine(pixel_x + 10, pixel_y, pixel_x, pixel_y + 10, NOT_MAP_GRID_COLOR);
            // tft.drawLine(x_coord + 20, y_coord, x_coord, y_coord + 20, WHITE);
            tft.drawLine(pixel_x + 20, pixel_y + 10, pixel_x + 10, pixel_y + 20, NOT_MAP_GRID_COLOR);
        }
    }
}