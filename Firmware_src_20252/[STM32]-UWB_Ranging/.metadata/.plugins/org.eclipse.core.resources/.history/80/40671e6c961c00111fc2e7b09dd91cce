/*
 * uwb_app.c
 *
 *  Created on: Mar 8, 2026
 *      Author: ADMIN
 */

#include "uwb_app.h"


/* ======================================================================
 *				   --- HÀM & BIẾN NỘI BỘ DÙNG CHUNG ---
 * =====================================================================*/


/*------------------------------------------------------------------------
 * @brief: 	Biến xử lý nội bộ dùng chung
 -----------------------------------------------------------------------*/
static uint8_t rx_buffer[128];				//	Buffer nhận (RX)
static uwb_msg_frame_t tx_frame;			//	Buffer truyền (TX)
static uint8_t frame_seq = 0;


/*------------------------------------------------------------------------
 * @brief: 	UWB configuration manage struct
 * @param: 	none
 -----------------------------------------------------------------------*/
uwb_dev_config_t beacon_cfg = {
    .short_addr = NODE_ID,
    .ant_dly_tx = TX_ANT_DLY,
    .ant_dly_rx = RX_ANT_DLY,

    /* RF Configuration */
    .config = {
		.chan = CHANNEL_NUM,				/* Channel number. */
		.prf = DWT_PRF_64M,					/* Pulse repetition frequency. */
		.txPreambLength = DWT_PLEN_128,		/* Preamble length. Used in TX only. */
		.rxPAC = DWT_PAC8,					/* Preamble acquisition chunk size. Used in RX only. */
		.txCode = 9,						/* TX preamble code. Used in TX only. */
		.rxCode = 9,						/* RX preamble code. Used in RX only. */
		.nsSFD = 0,							/* 0 to use standard SFD, 1 to use non-standard SFD. */
		.dataRate = DWT_BR_6M8,				/* Data rate. */
		.phrMode = DWT_PHRMODE_STD,			/* PHY header mode. */
		.sfdTO = (129 + 8 - 8)				/* SFD timeout (preamble length + 1 + SFD length - PAC size). Used in RX only. */
    },

    /* TX Power Configuration */
    .tx_config = {
        .PGdly = 0xC2,       // PG Delay cho Channel 2
        .power = 0x67676767  // Công suất phát chuẩn
    }
};

/*----------------------------------------------------------------------
 * @brief: 	Reset module DW1000
 * @param: 	none
 *
 ----------------------------------------------------------------------*/
void Reset_DW1000(void) {
    HAL_GPIO_WritePin(DW_RESET_GPIO_Port, DW_RESET_Pin, GPIO_PIN_RESET);
    HAL_Delay(2);
    HAL_GPIO_WritePin(DW_RESET_GPIO_Port, DW_RESET_Pin, GPIO_PIN_SET);
    HAL_Delay(5);
}


/*----------------------------------------------------------------------
 * @brief: 	Set hspi1 clock to 2.25MHz (UWB init)
 * @param: 	none
 *
 ----------------------------------------------------------------------*/
void port_set_dw1000_slowrate(SPI_HandleTypeDef *hspi)
{
	hspi->Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_32;
    HAL_SPI_Init(hspi);
}


/*----------------------------------------------------------------------
 * @brief: 	Set hspi1 clock to 18MHz
 * @param:
 * 			*hspi: Pointer to SPI handle Structure definition
 *
 ----------------------------------------------------------------------*/
void port_set_dw1000_fastrate(SPI_HandleTypeDef *hspi)
{
	hspi->Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_4;
    HAL_SPI_Init(hspi);
}


/*! -------------------------------------------------------------------
 * @brief:	Get the RX time-stamp in a 64-bit variable.
 * 			This function assumes that length of timestamps is 40 bits
 * @return  64-bit value of the read time-stamp.
 ----------------------------------------------------------------------*/
 uint64_t get_rx_timestamp_u64(void)
{
    uint8_t ts_tab[5];
    uint64_t ts = 0;
    int i;
    dwt_readrxtimestamp(ts_tab);

    for (i = 4; i >= 0; i--) {
        ts <<= 8;
        ts |= ts_tab[i];
    }

//    // Debug
//    uint32_t ts_high = (uint32_t)(ts >> 32);
//    uint32_t ts_low = (uint32_t)(ts & 0xFFFFFFFF);
    return ts;
}





 /* =====================================================================
  *				 	--- HÀM & LOGIC XỬ LÝ TAG ---
  * ====================================================================*/

 /* TDMA Timing (Microseconds tính từ lúc nhận Master Poll)
 * 	|----------------------------------30ms----------------------------------|
 *	|--2--|------------14--------------|--1--|-----------10------------|--3--|
 *	(MST_Poll)		(SLV_Poll)		   (BACKUP)		  (TAG_RES)       (MST_UART)
 */

 /*----------------------------------------------------------------------
  * @brief: [TAG] Finite State Machine
  ----------------------------------------------------------------------*/
 typedef enum {
	 STATE_ADV = 0,					//	Trạng thái Broadcast ADV
	 STATE_WAIT_MST_POLL,    		//  0-2ms		Lắng nghe Master Poll
	 STATE_WAIT_SLV_POLL,  			//  2-16ms: 	Lắng nghe Slave Poll
	 STATE_PREPARE_TAG_RES,  		//  16-28ms: 	Chuẩn bị gói Response
 } tag_fsm_state_t;


 /*----------------------------------------------------------------------
  * @brief: [TAG] Variable & Flag
  ----------------------------------------------------------------------*/

 // State hiện tại của Tag (Defaut: STATE_ADV)
 volatile tag_fsm_state_t tag_state = STATE_ADV;



 /*----------------------------------------------------------------------
  * @brief: [TAG] Handle function
  ----------------------------------------------------------------------*/


 /*----------------------------------------------------------------------
  * @brief: [TAG] Main loop
  ----------------------------------------------------------------------*/
 void tag_loop (void) {
	 uint32_t current_ms = HAL_GetTick();

	 switch (tag_state) {

	 	 case STATE_ADV:

	 		 /* ToDo: XỬ LÝ BẢN TIN VÀ ADV ĐỊNH KỲ
	 		  * 	- Tạo payload + bọc MAC header
	 		  *		- TX Broadcast -> RX (Mỗi 100 ms)
	 		  *		- LED báo Join OK
	 		  *		- Chuyển STATE_WAIT_MST_POLL <=> Nhận FUNC_MASTER_POLL
	 		  *		- Handle RX callback
	 		  * */

	 		 break;

	 	 case STATE_WAIT_MST_POLL:

	 		 /* ToDo: LẮNG NGHE FUNC_MASTER_POLL
	 		  * 	- Vừa vào STATE_WAIT_MST_POLL lưu lại start_time
	 		  * 	- Quay lại STATE_ADV <=> elasped = current_time - start_time >= 500ms
	 		  * 	- (Rx callback) Lưu lại rx_mst_poll_time (stm32) làm mốc 0. Dò ID bản thân
	 		  * 		+ Ko có bỏ qua (xóa rx_mst_poll_time)
	 		  * 		+ Nếu có lấy TDMA slot k (xóa start_time)
	 		  *		- Chuyển STATE_WAIT_SLV_POLL <=> current_time - rx_mst_poll_time > MASTER_POLL_TIMEOUT
	 		  * */

	 		 break;

	 	 case STATE_WAIT_SLV_POLL:

	 		 /* ToDo: LẮNG NGHE STATE_WAIT_SLV_POLL
	 		  * 	- (Rx callback) Lưu lại ID Beacon và rx_slv_poll_time[i] (dw1000)
	 		  *		- Chuyển STATE_PREPARE_TAG_RES <=> current_time - rx_mst_poll_time > MASTER_POLL_TIMEOUT + SLAVE_POLL_TIMEOUT
	 		  * */

	 		 break;

	 	 case STATE_PREPARE_TAG_RES:

	 		 /* ToDo: CHUẨN BỊ GÓI RES
	 		  * 	- Đóng gói payload + bọc MAC header
	 		  *		- Cài thời gian gửi sau delay = 500 + k * TAG_SLOT_TDMA_US
	 		  *		- Chuyển STATE_WAIT_MST_POLL khi gửi thành công
	 		  * */

	 		 break;



	 }


 }



 /* ====================================================================
  *			   --- HÀM & LOGIC XỬ LÝ SLV_BEACON ---
  * ===================================================================*/

 /*----------------------------------------------------------------------
  * @brief: [SLV_BEACON] Finite State Machine
  ----------------------------------------------------------------------*/
 typedef enum {
	 STATE_WAIT_MST_POLL,    		//  0-2ms		Lắng nghe Master Poll
	 STATE_PREPARE_SLV_POLL,  		//  2-16ms: 	Chuẩn bị gói Slv_Beacon Poll
	 STATE_WAIT_TAG_RES,  			//  16-28ms: 	Lắng nghe gói Response từ Tag
	 STATE_CALCULATE_DIST			//  28-30ms: 	Slv_Beacon tính toán k/c pha hiện tại
 } slv_fsm_state_t;


 /*----------------------------------------------------------------------
  * @brief: [SLV_BEACON] Variable & Flag
  ----------------------------------------------------------------------*/
 volatile slv_fsm_state_t slv_state = STATE_WAIT_MST_POLL;


 /*----------------------------------------------------------------------
  * @brief: [SLV_BEACON] Handle function
  ----------------------------------------------------------------------*/


 /*----------------------------------------------------------------------
  * @brief: [SLV_BEACON] Main loop
  ----------------------------------------------------------------------*/
 void slv_beacon_loop (void) {
	 uint32_t current_ms = HAL_GetTick();

	 /* ToDo:
	  * 	-
	  *		-
	  *		-
	  * */



	 /* ToDo:
	  * 	-
	  *		-
	  *		-
	  * */



	 /* ToDo:
	  * 	-
	  *		-
	  *		-
	  * */



	 /* ToDo:
	  * 	-
	  *		-
	  *		-
	  * */
 }




 /* ToDo:
  * 	-
  *		-
  *		-
  * */



 /* =====================================================================
  *			   --- HÀM & LOGIC XỬ LÝ MST_BEACON ---
  * ===================================================================*/

 /*----------------------------------------------------------------------
  * @brief: [MST_BEACON] Finite State Machine
  ----------------------------------------------------------------------*/

 /*----------------------------------------------------------------------
  * @brief: [MST_BEACON] Variable & Flag
  ----------------------------------------------------------------------*/

 /*----------------------------------------------------------------------
  * @brief: [MST_BEACON] Handle function
  ----------------------------------------------------------------------*/

 /*----------------------------------------------------------------------
  * @brief: [MST_BEACON] Main loop
  ----------------------------------------------------------------------*/
 void mst_beacon_loop (void) {
	 uint32_t current_ms = HAL_GetTick();


 }


 /* ToDo: XỬ LÝ BROADCAST MST_POLL
  * 	- Tạo gói Poll (Danh sách Tag từ Queue)
  *		- Chuyển mode RX -> Gửi UWB
  *		- Timeout: MASTER_POLL_TIMEOUT
  * */



 /* ToDo: XỬ LÝ NHẬN SLV_POLL + TAG_RES + ADV
  * 	- Nếu SLV_POLL	-> Đọc Dist của từng Tag trong gói, lưu struct
  *		- Nếu TAG_RES	-> Lưu ID vào Queue để MST_POLL pha sau
  *		- Nếu ADV		-> Lưu ID vào Queue để MST_POLL pha sau
  *		- Timeout:
  * */

