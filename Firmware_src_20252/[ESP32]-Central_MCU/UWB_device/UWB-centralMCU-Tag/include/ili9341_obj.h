#ifndef ILI9341_OBJ_H
#define ILI9341_OBJ_H

#include "config.h"

/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
class UserDisplay
{
private:
    typedef struct 
    {
        float coor_x, coor_y;           // User absolute coordinate
        int pixel_x, pixel_y;           // User pixel coordinate (mapping for TFT drawing)
    } user_position_t;

    user_position_t prev_pos;           // Previous position 
    user_position_t curr_pos;           // Current position

    int vision_range;                   // User vision range (Fire's impact range)
    int user_score;                     // User score
    int user_speed;                     // User speed
    bool is_user_updated;               // Updated flag 

    void coordinate_to_pixel_position(float coor_x, float coor_y, int &pixel_x, int &pixel_y);
public:
    // Constructor 
    UserDisplay();

    // Flag handle
    bool hasNewData() {is_user_updated = true;};
    void clearFlag() {is_user_updated = false;};

    // Update User data
    void updateData(float coor_x, float coor_y, int score);

    // TFT Display handle
    void clearUser(Adafruit_ILI9341 &tft);
    void drawUser(Adafruit_ILI9341 &tft);

};



/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
class FlamesDisplay  
{
private:
    // Flame properties
    typedef struct 
    {
        int flame_id;
        int flame_lvl;

    } flame_properties_t;
    
    // Flames data (max 100 flames simultaneously on a 10x10 map )
    typedef struct 
    {
        flame_properties_t data[100];
    } flames_t;

    // Flame lvl colors
    const uint16_t flames_lvl_color[6] = {
    BLACK,  // lv0
    0xF800, // lv1
    0xFFF0, // lv2
    0xFD04, // lv3
    0xA984, // lv4
    0xA804  // lv5
    };

    // Flames updated flag
    bool is_flames_updated;

    // Flames handle struct
    flames_t prev_flames;
    flames_t curr_flames;

public:
    FlamesDisplay();

    // Flag handle
    bool hasNewData() {is_flames_updated = true;};
    void clearFlag() {is_flames_updated = false;};

    // Update Flames data
    void updateData(const char *payload);

    // TFT Display handle
    void clearFlames(Adafruit_ILI9341 &tft);
    void drawFlames(Adafruit_ILI9341 &tft);

};


/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
class MapDisplay
{
private:
    int north_offset;
    bool is_map_updated;

    // Marker array for 10x10 map 
    bool is_passable_grid_id[101];

    // Convert from grid ID to grid's central pixel coordinate
    void grid_id_to_coordinate(int id, int &pixel_x, int &pixel_y);

public:
    MapDisplay();
    // Flag handle
    bool hasNewData() {is_map_updated = true;};
    void clearFlag() {is_map_updated = false;};

    // Update map data
    void updateData(const char *payload);

    // TFT Display handle
    void clearMap(Adafruit_ILI9341 &tft);
    void drawMap(Adafruit_ILI9341 &tft);
};


/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
extern UserDisplay user;
extern FlamesDisplay flames;
extern MapDisplay map;

#endif