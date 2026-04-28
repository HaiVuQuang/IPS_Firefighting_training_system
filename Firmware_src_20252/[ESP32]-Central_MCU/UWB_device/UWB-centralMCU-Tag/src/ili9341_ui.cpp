#include "ili9341_ui.h"

/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void draw_progress_bar(Adafruit_ILI9341 &tft, int x, int y, int width, int height, int percentage)
{
    if (percentage < 0)
        percentage = 0;
    if (percentage > 100)
        percentage = 100;
    // Đổi màu theo progress
    uint16_t color;
    if (percentage <= 33)
    {
        color = RED; // Đỏ
    }
    else if (percentage <= 66)
    {
        color = YELLOW; // Vàng
    }
    else
    {
        color = GREEN; // Xanh lá
    }
    //
    int filled_width = round((percentage * width) / 100);
    // Cập nhật thanh progress
    tft.drawRect(x, y, width, height, WHITE);
    tft.fillRect(x + 1, y + 1, width - 2, height - 2, BLACK);
    tft.fillRect(x + 1, y + 1, filled_width - 2, height - 2, color);
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void tft_setup_intro(Adafruit_ILI9341 &tft)
{

}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void tft_setup_map_axes_outline(Adafruit_ILI9341 &tft)
{
    tft.setTextColor(WHITE);
    tft.setTextSize(1);
    tft.setCursor(26, 5);
    tft.println("Map layout - Reality mode");
    tft.println("- Firefighting Map layout -");
    
    // Vẽ các trục của map
    tft.drawFastVLine(9, 19, 202, WHITE);
    tft.drawFastHLine(9, 221, 202, WHITE);
    tft.drawFastVLine(217, 0, 240, WHITE);

    // Trục Y - Hướng north của map
    tft.setCursor(0, 16);
    tft.println("10");
    tft.setCursor(1, 36);
    tft.println("9");
    tft.setCursor(1, 56);
    tft.println("8");
    tft.setCursor(1, 76);
    tft.println("7");
    tft.setCursor(1, 96);
    tft.println("6");
    tft.setCursor(1, 116);
    tft.println("5");
    tft.setCursor(1, 136);
    tft.println("4");
    tft.setCursor(1, 156);
    tft.println("3");
    tft.setCursor(1, 176);
    tft.println("2");
    tft.setCursor(1, 196);
    tft.println("1");

    // Trục x
    tft.setCursor(27, 226);
    tft.println("1");
    tft.setCursor(47, 226);
    tft.println("2");
    tft.setCursor(67, 226);
    tft.println("3");
    tft.setCursor(87, 226);
    tft.println("4");
    tft.setCursor(107, 226);
    tft.println("5");
    tft.setCursor(127, 226);
    tft.println("6");
    tft.setCursor(147, 226);
    tft.println("7");
    tft.setCursor(167, 226);
    tft.println("8");
    tft.setCursor(187, 226);
    tft.println("9");
    tft.setCursor(207, 226);
    tft.println("10");
    tft.setCursor(1, 226);
    tft.println("0");
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void tft_setup_static_text_outline(Adafruit_ILI9341 &tft)
{
    tft.setTextColor(WHITE);
    tft.setTextSize(1);
    // Setup text tĩnh
    tft.setCursor(220, 5);
    tft.println("Device Id:");
    tft.setCursor(286, 5);
    tft.println(MY_DEVICE_ID);
    tft.setCursor(240, 24);
    tft.println("User score");
    tft.setCursor(220, 75);
    tft.println("Valve Opening:");
    tft.setCursor(220, 123);
    tft.println("User position:");
    tft.setCursor(220, 136);
    tft.println("X:");
    tft.setCursor(220, 149);
    tft.println("Y:");
    // Bảng User score
    tft.drawFastVLine(220, 21, 49, WHITE);
    tft.drawFastVLine(319, 21, 49, WHITE);
    tft.drawFastHLine(220, 21, 99, WHITE);
    tft.drawFastHLine(220, 35, 99, WHITE);
    tft.drawFastHLine(220, 70, 99, WHITE);
}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void tft_update_user_info_text(Adafruit_ILI9341 &tft)
{

}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void tft_render_new_frame(Adafruit_ILI9341 &tft)
{

}


/*--------------------------------------------------------------------------------------------------------*/
/**
 * @brief
 */
/*--------------------------------------------------------------------------------------------------------*/
void tft_main_loop_handler(Adafruit_ILI9341 &tft)
{

}