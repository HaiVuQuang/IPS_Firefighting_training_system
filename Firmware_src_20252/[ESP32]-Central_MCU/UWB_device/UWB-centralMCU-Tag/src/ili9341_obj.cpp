#include "ili9341_obj.h"

//==========================================================================================================
//
//==========================================================================================================
UserDisplay user;
FlamesDisplay flames;
MapDisplay map;


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
UserDisplay::UserDisplay()
{
    
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
    curr_pos.coor_x = coor_x;
    curr_pos.coor_y = coor_y;
    user_score = score;

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
    
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void UserDisplay::drawUser(Adafruit_ILI9341 &tft)
{
    
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
    // Draw huge fuking big black box :))
    tft.drawRect(10, 21, 200, 200, BLACK);
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
            tft.drawRect(pixel_x, pixel_y, 20, 20, WHITE);
        }
        // Draw unpassable map grid
        else{
            grid_id_to_topleft_coordinate(i, pixel_x, pixel_y);
            tft.drawLine(pixel_x + 10, pixel_y, pixel_x, pixel_y + 10, BLUE);
            // tft.drawLine(x_coord + 20, y_coord, x_coord, y_coord + 20, WHITE);
            tft.drawLine(pixel_x + 20, pixel_y + 10, pixel_x + 10, pixel_y + 20, BLUE);
        }
    }
}