/*
 * uwb_app.h
 *
 *  Created on: Mar 7, 2026
 *      Author: ADMIN
 */

#ifndef INC_UWB_APP_H_
#define INC_UWB_APP_H_

#include "main.h"
#include "deca_device_api.h"
#include "deca_param_types.h"
#include "deca_regs.h"
#include "deca_version.h"
#include "uwb_shared_def.h"

#include <stdint.h>
#include "stm32f1xx_hal.h"

#define NODE_ID 0x36

/* ================= THÔNG SỐ HỆ THỐNG ================= */

#define MAX_TAGS            5				//Số lượng Tag tối đa hỗ trợ
#define MAX_SLAVES          7				//Số lượng Slv_Beacon tối đa hỗ trợ
#define CYCLE_PERIOD_MS     30				//Chu kỳ tổng mỗi pha Ranging (30ms ~ 33fps)

// Function Codes
#define FUNC_ADV          0xA1				//[TAG] Bản tin quảng bá ADV
#define FUNC_MASTER_POLL  0xA2				//[MST_BEACON] Bản tin Master beacon POLL
#define FUNC_SLAVE_POLL   0xA3				//[SLV_BEACON] Bản tin Slave beacon POLL
#define FUNC_TAG_RESP     0xA4				//[TAG] Bản tin Response

/* TDMA Timing (Microseconds tính từ lúc nhận Master Poll)
* 	|----------------------------------30ms----------------------------------|
*	|--2--|------------14--------------|--1--|-----------11------------|--2--|
*	(MST_Poll)		(SLV_Poll)		   (BACKUP)		  (TAG_RES)       (DIST_CAL)
*/
#define MASTER_POLL_TIMEOUT		2000
#define SLAVE_POLL_TIMEOUT		15000			// 14ms: (Max tải) + 1ms Backup
//#define BACKUP_TIMEOUT			1000
#define TAG_RESPONSE_TIMEOUT	11000			// 10ms: (Max tải) + 1ms Backup
#define DIST_CAL_TIMEOUT		2000			// 2ms:	Slv_Beacon tính toán k/c pha hiện tại

//#define SLAVE_SLOT_BASE_US  	2000  			// Slv_Beacon đầu tiên bắt đầu sau 2ms
#define SLAVE_SLOT_TDMA_US  	2000  			// Mỗi Slv_Beacon cách nhau 2ms
//#define TAG_SLOT_BASE_US    	17000 			// Tag đầu tiên bắt đầu sau 17ms
#define TAG_SLOT_TDMA_US    	2000  			// Mỗi Tag cách nhau 2ms


/* ================= CẤU TRÚC BẢN TIN  ================= */
#pragma pack(push, 1)


//	Cấu trúc bản tin chuẩn IEEE 802.15.4 (12 bytes MAC header + Payload + 2 bytes FCS)
typedef struct {

    // IEEE 802.15.4 Header (MHR)
    uint16_t frame_ctrl;
    uint8_t  seq_num;
    uint16_t pan_id;
    uint16_t dest_addr;
    uint16_t src_addr;

    // UWB Payload + FCS
    uint8_t	payload[64];
} uwb_msg_frame_t;


//	Tag ADV Payload
//	[ Header | Func | TagID ]
typedef struct {
    uint8_t func_code;    			// FUNC_ADV: 0xA1
    uint8_t tag_id;       			// Tag ID
} pkt_adv_t;


//	Mst_Beacon Poll Payload
//
typedef struct {
    uint8_t func_code;    			// FUNC_MASTER_POLL: 0xA2
    uint8_t tag_count;    			// Số lượng Tag tham gia
    uint8_t tag_ids[MAX_TAGS]; 		// Danh sách ID
} pkt_master_poll_t;


//	Struct phụ cho Slv_Beacon Poll
typedef struct {
    uint8_t tag_id;					// ID Tag
    uint16_t dist_cm;				// Khoảng cách với Tag đó
    								// Max 65536 cm ~ 655.36 m
} tag_dist_t;


//	Slv_Beacon Poll Payload
typedef struct {
	uint8_t func_code;				// FUNC_SLAVE_POL: 0xA3
	uint8_t slv_id;					//Slv_beacon ID
	tag_dist_t distances[MAX_TAGS];	//Array quản lý k/c đo được với các Tag
} pkt_slave_poll_t;


// Struct phụ cho Tag Response
typedef struct {
    uint8_t beacon_id;				// Beacon ID
    uint32_t poll_rx_ts;  			// Thời gian Tag nhận được gói Poll của Beacon này
} rx_info_t;


// Tag Response Payload
typedef struct {
    uint8_t func_code;    			// FUNC_TAG_RESP: 0xA4
    uint8_t tag_id;					// Tag ID
    uint32_t resp_tx_ts;  			// Thời gian Tag dự kiến gửi gói này
    uint8_t beacon_count; 			// Số lượng thông tin Beacon đính kèm
    rx_info_t rx_infos[MAX_SLAVES + 1]; // +1 vì tính cả Master
} pkt_tag_resp_t;


#pragma pack(pop)

typedef struct {

} uwb_msg;

#endif /* INC_UWB_APP_H_ */
