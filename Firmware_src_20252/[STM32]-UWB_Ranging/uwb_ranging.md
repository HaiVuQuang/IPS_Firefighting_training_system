# UWB Multi-Tag & Multi-Beacon RTLS Architecture

## 1. System Overview & Core Concepts
This project implements a Real-Time Location System (RTLS) capable of handling multiple Tags and multiple Beacons (Slaves) coordinated by a Master Beacon. 

* **Ranging Algorithm**: Single-Sided Two-Way Ranging (SS-TWR) with Piggybacking.
* **Required Timestamps for ToF**: 
    * `poll_tx_ts` (Slave Poll TX)
    * `tag_poll_rx_ts` (Tag RX Slave Poll)
    * `tag_resp_tx_ts` (Tag TX Response)
    * `resp_rx_ts` (Slave RX Tag Response)
* **Hardware Stack**: STM32F103 series MCU coupled with Qorvo/Decawave DW1000 UWB transceivers.
* **Core APIs**: Decawave Device API including `dwt_starttx`, `dwt_setdelayedtrxtime`, `dwt_readrxtimestamp`, `dwt_readrxtimestamplo32`, and `dwt_forcetrxoff`.

## 2. System Components & Roles

### Master Beacon (Coordinator)
* **Role**: Network synchronizer and data gateway.
* **Tasks**: 
    * Broadcasts the `Master Poll` at the start of every cycle to synchronize the network (T=0).
    * Manages the dynamic "Active Tag Queue" with a Time-To-Live (TTL) mechanism.
    * Listens to `Slave Polls` to extract calculated distances (piggybacked data) and forwards them to a Central MCU (e.g., ESP32) via UART DMA.

### Slave Beacon (Anchor)
* **Role**: Fixed reference point for ranging.
* **Tasks**:
    * Listens for the `Master Poll` to reset its hardware timer and synchronize to the current cycle.
    * Transmits a `Slave Poll` in its fixed TDMA slot. This packet serves a dual purpose: initiating TWR with Tags and piggybacking the calculated distances from the *previous* cycle up to the Master.
    * Listens for `Tag Responses`, records RX timestamps, and calculates the Time of Flight (ToF) and distance at the end of the cycle.

### Tag (Tracked Object)
* **Role**: Mobile node being tracked.
* **Tasks**:
    * When unassigned, broadcasts `ADV` (Advertisement) packets periodically to join the network.
    * Listens to the `Master Poll` to find its ID. If present, it extracts its dynamic TDMA slot index.
    * Listens to all incoming `Slave Polls`, recording the RX timestamps.
    * Transmits a single `Tag Response` in its assigned TDMA slot, packing all recorded Slave RX timestamps into the payload.

## 3. Network Lifecycle & TDMA Timing

### Tag Join Logic (ADV)
Tags not listed in the Master's active queue operate in `TAG_STATE_ADV`. They broadcast `FUNC_ADV` packets periodically (e.g., every 300ms). The Master receives these, adds the Tag ID to its Virtual Queue, and assigns it a TTL (e.g., 5 cycles). If a Tag misses multiple cycles, its TTL drops to 0, and the Master removes it to free up the slot.

### The 60ms TDMA Cycle Breakdown
The system uses a strict 60ms cycle managed by STM32's `TIM2` (1µs resolution):
1. **0 - 4ms (`MASTER_POLL`)**: Master broadcasts the list of active Tags. Slaves and Tags reset `TIM2` to 0 upon reception.
2. **5 - 35ms (`SLAVE_POLL`)**: Slaves sequentially broadcast their Polls. Tag listens and records timestamps.
3. **35 - 56ms (`TAG_RESPONSE`)**: Tags sequentially broadcast their Responses.
4. **56 - 60ms (`DIST_CALC`)**: Slaves compute ToF for all Tags. Master idles/prepares for the next cycle.

### Slot Allocation Strategy
* **Fixed Slots (Slaves)**: Slaves have hardcoded TDMA slots based on a predefined topology list (`SLV_TOPOLOGY_LIST`). Slave Index = TDMA Slot.
* **Dynamic Slots (Tags)**: Master Poll payload contains an array of `tag_ids`. The index of a Tag's ID in this array dictates its TDMA slot for that specific cycle. This allows seamless Tag roaming and joining/leaving without hardcoding.

## 4. Packet Structure & Protocol
All packets are wrapped in a standard IEEE 802.15.4 MAC Frame:
* **MAC Header (9 bytes)**: Frame Control (`0x8841`), Sequence Number, PAN ID (`0xDECA`), Dest Addr (Broadcast `0xFFFF`), Src Addr.
* **Payload (Variable)**: Specific to the function code.
* **FCS (2 bytes)**: Hardware CRC-16 appended and verified automatically by the DW1000.

### Payload Definitions
* **FUNC_ADV (0xA1)**: `[FuncCode:1] | [TagID:1]`.
* **FUNC_MASTER_POLL (0xA2)**: `[FuncCode:1] | [MasterID:1] | [TagCount:1] | [TagID_1...TagID_N]`.
* **FUNC_SLAVE_POLL (0xA3)**: `[FuncCode:1] | [SlaveID:1] | [TagCount:1] | [Array of (TagID, Dist_cm)]`. *Note: The distance array contains results from cycle N-1 (Piggybacking)*.
* **FUNC_TAG_RESP (0xA4)**: `[FuncCode:1] | [TagID:1] | [Resp_TX_TS:4] | [BeaconCount:1] | [Array of (BeaconID, Poll_RX_TS)]`.

## 5. Software Architecture & Coding Style

### Finite State Machine (FSM)
Each node operates on a strictly non-blocking FSM inside the `main` loop, driven by `elapsed_us` from `TIM2`. 
* **Master FSM**: `MST_STATE_PREPARE_MST_POLL` $\rightarrow$ `MST_STATE_LISTENING_PACKET`.
* **Slave FSM**: `SLV_STATE_WAIT_MST_POLL` $\rightarrow$ `SLV_STATE_PREPARE_SLV_POLL` $\rightarrow$ `SLV_STATE_WAIT_TAG_RES` $\rightarrow$ `SLV_STATE_CALCULATE_DIST`.
* **Tag FSM**: `TAG_STATE_ADV` $\rightarrow$ `TAG_STATE_WAIT_MST_POLL` $\rightarrow$ `TAG_STATE_WAIT_SLV_POLL` $\rightarrow$ `TAG_STATE_PREPARE_TAG_RES`.

### Dual-Clock Synchronization
The architecture completely separates state-machine timeouts from RF calculation timestamps:
* **STM32 `TIM2` (1µs resolution)**: Used exclusively for FSM state transitions and TDMA timeout guardrails. It is reset to 0 upon receiving the Master Poll.
* **DW1000 RX/TX Timestamps (15.65ps resolution)**: Used exclusively for ToF math and `dwt_setdelayedtrxtime`. Timestamps are masked to 32-bits to safely handle wrap-arounds using native C unsigned integer math. Calculations are cast to `double` to prevent precision loss.

### Debugging & Hardware Constraints
* **UART DMA**: `HAL_UART_Transmit_DMA` is strictly enforced for all `debug_print` and `send_to_centralMCU` functions. Blocking UART (`HAL_UART_Transmit`) is prohibited to prevent CPU bottlenecks leading to DW1000 `Late TX` errors.
* **Interrupt Handlers (`rx_ok_cb`)**: The DW1000 ISR only parses data, sets flags, and manages safe Buffer ring-pushes (e.g., `slv_msg_queue` in the Master). All heavy lifting (String formatting, distance math) is deferred to the FSM in the main loop.

### Data Structures
* Ring Buffers are used in the Master to queue incoming Slave Polls from the ISR before processing them in the main loop.