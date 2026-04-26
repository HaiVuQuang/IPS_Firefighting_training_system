import numpy as np

# class StepDetection:
#     def __init__(self, upper_threshold, lower_threshold, min_time, max_time):
#         """
#         Bộ lọc phát hiện bước chân dựa trên đỉnh (peak) của sóng gia tốc.
#         """
#         self.upper_threshold = upper_threshold
#         self.lower_threshold = lower_threshold
#         self.min_time = min_time
#         self.max_time = max_time
#         self.high_peak_time = None
#
#     def detect_step(self, value, time):
#         """
#         Trả về True nếu phát hiện 1 bước chân hoàn chỉnh (Tạo thành 1 chu kỳ sóng lên - xuống)
#         """
#         # Bỏ qua các dao động siêu nhỏ (Nhiễu tĩnh)
#         if value >= 5 and value <= -5:
#             self.high_peak_time = None
#             return False
#             
#         # Bắt đỉnh (Peak) của bước chân
#         if value > self.upper_threshold and self.high_peak_time is None:
#             self.high_peak_time = time
#             return False
#             
#         # Bắt đáy (Trough) và xác nhận bước chân
#         elif value < self.lower_threshold and self.high_peak_time is not None:
#             time_diff = time - self.high_peak_time
#             
#             # Kiểm tra xem thời gian giữa 2 bước có hợp lý với tốc độ đi bộ của người không
#             if self.min_time <= time_diff <= self.max_time:
#                 self.high_peak_time = None
#                 return True  # 1 BƯỚC CHÂN HỢP LỆ!
#             elif time_diff > self.max_time or time_diff < self.min_time:
#                 self.high_peak_time = None
#                 return False
#                 
#         return False

class LinearKalmanFilter:
    def __init__(self):
        """
        Bộ lọc Kalman tuyến tính 2D. Tối ưu hóa để làm mượt quỹ đạo (X, Y).
        """
        # Ma trận chuyển trạng thái (F) và ma trận quan sát (H) cho hệ 2D
        self.F = np.eye(2)
        self.H = np.eye(2)
        
        # Q (Process Noise): Độ tin tưởng vào quỹ đạo cũ. 
        # Càng NHỎ -> Dấu chấm càng mượt, lướt êm, nhưng bám theo AI hơi trễ.
        self.Q = np.eye(2) * 0.05 
        
        # R (Measurement Noise): Mức độ nhiễu của AI. 
        # Càng LỚN -> Càng KHÔNG tin vào độ giật nảy của AI.
        self.R = np.eye(2) * 1.5 
        
        self.state = None
        self.covariance = np.eye(2)

    def update(self, x, y):
        """
        Hàm nạp tọa độ thô từ AI vào và lấy ra tọa độ đã làm mượt
        """
        measurement = np.array([x, y])
        
        # Lần đầu tiên chạy, lấy luôn tọa độ AI làm gốc
        if self.state is None:
            self.state = measurement
            return x, y

        # --- BƯỚC 1: DỰ ĐOÁN (PREDICT) ---
        pred_state = self.F @ self.state
        pred_cov = self.F @ self.covariance @ self.F.T + self.Q

        # --- BƯỚC 2: CẬP NHẬT & ĐIỀU CHỈNH (UPDATE) ---
        # Tính Hệ số Kalman Gain (K)
        kalman_gain = pred_cov @ self.H.T @ np.linalg.inv(self.H @ pred_cov @ self.H.T + self.R)
        
        # Tính toán Tọa độ cuối cùng
        self.state = pred_state + kalman_gain @ (measurement - self.H @ pred_state)
        
        # Cập nhật lại sai số cho vòng lặp tiếp theo
        self.covariance = (np.eye(2) - kalman_gain @ self.H) @ pred_cov

        return float(self.state[0]), float(self.state[1])