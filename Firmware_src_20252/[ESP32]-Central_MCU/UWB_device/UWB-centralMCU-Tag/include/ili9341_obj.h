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
    bool hasNewData() const { return is_user_updated; };
    void clearFlag() { is_user_updated = false; };

    // Update User data
    void updateData();

    // TFT Display handle
    void clearUser(Adafruit_ILI9341 &tft);
    void drawUser(Adafruit_ILI9341 &tft);

};



/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
class FireDisplay  
{
private:
    typedef struct 
    {

    } fire_properties_t;
    
  
public:
    FireDisplay();

};


/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
class MapDisplay
{
private:
    
public:
    MapDisplay();

};


/*#############################################################################################################*/
/**
 * @brief 
 */
/*#############################################################################################################*/
extern UserDisplay user;
extern FireDisplay fire;
extern MapDisplay map;

#endif