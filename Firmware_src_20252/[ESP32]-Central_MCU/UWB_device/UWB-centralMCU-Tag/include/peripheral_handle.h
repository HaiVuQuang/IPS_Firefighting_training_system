#ifndef PERIPHERAL_HANDLE_H
#define PERIPHERAL_HANDLE_H

#include "config.h"
/*#############################################################################################################*/
// IMU Data structure defines
/*#############################################################################################################*/

// Quarternion struct
typedef struct {
    int16_t w, x, y, z;
} Raw_quaternion;

typedef struct {
    float w, x, y, z;
} Real_quaternion;

// Vector 3D struct
typedef struct {
    int16_t x, y, z;
} Raw_vector3;

typedef struct {
    float x, y, z;
} Real_vector3;

// IMU raw data defines
typedef struct {
    Raw_vector3 acc_raw;
    Raw_vector3 mag_raw;
    Raw_vector3 gyro_raw;
    Raw_vector3 euler_raw;
    Raw_quaternion quaternion_raw;
} IMU_Raw_Data;

// IMU real local data defines
typedef struct {
    Real_vector3 acc_local_real;
    Real_vector3 mag_local_real;
    Real_vector3 gyro_local_real;
    Real_vector3 euler_real;
    Real_quaternion quaternion_real;
} IMU_Real_local_Data;

// IMU real global data defines
typedef struct {
    Real_vector3 gyro;
    Real_vector3 mag;
    Real_vector3 acc;
    Real_vector3 euler;
} IMU_Data;


/*#############################################################################################################*/
// Valve status data structure defines 
/*#############################################################################################################*/
typedef struct {
    int valve_open_status;  // 0-100%
    bool mode_status;       // ON-OFF
} Valve_Data;


/*#############################################################################################################*/
// Global defines 
/*#############################################################################################################*/
extern IMU_Data imu_data;
extern IMU_Raw_Data imu_raw_data;
extern IMU_Real_local_Data imu_real_local_data;
extern Valve_Data valve_data;

/*#############################################################################################################*/
// Global function define 
/*#############################################################################################################*/
void init_button_and_valve();

void init_on_device_bno055();

void read_IMU_data();

void read_valve_open_status();

#endif