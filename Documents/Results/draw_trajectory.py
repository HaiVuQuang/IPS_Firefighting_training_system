import os
import sys
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime

# Cấu hình đường dẫn
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(CURRENT_DIR, 'trajectory_log.csv')
TRUTH_PATH = os.path.join(CURRENT_DIR, 'ground_truth.csv')
FILTERED_CSV_PATH = os.path.join(CURRENT_DIR, 'filtered_trajectory_log.csv')

def main():
    if not os.path.exists(CSV_PATH):
        print(f"[Error] Không tìm thấy file: {CSV_PATH}")
        sys.exit(1)

    df = pd.read_csv(CSV_PATH)
    
    # Loại bỏ tọa độ âm
    df = df[(df['x'] >= 0) & (df['y'] >= 0)]
    
    # # ==========================================
    # # PHẦN 3: TỰ ĐỘNG LỌC ĐOẠN ĐƯỜNG THỪA
    # # ==========================================
    # distances = np.sqrt((df['x'] - 0.5)**2 + (df['y'] - 0.5)**2)
    # close_points = distances[distances < 0.8]
    
    # if not close_points.empty:
    #     start_idx = close_points.index[0]  
    #     end_idx = close_points.index[-1]   
        
    #     df = df.loc[start_idx:end_idx].reset_index(drop=True)
    #     df.to_csv(FILTERED_CSV_PATH, index=False)
    #     print(f"[Thành công] Đã cắt bỏ đoạn nhiễu đầu/cuối và xuất ra file: {FILTERED_CSV_PATH}")
    # else:
    #     print("[Cảnh báo] Không tìm thấy điểm nào gần (0.5, 0.5) để cắt dữ liệu.")

    # if df.empty:
    #     print("[Lỗi] Không còn dữ liệu sau khi lọc.")
    #     sys.exit(1)

    # ==========================================
    # PHẦN 1 & 2: CẤU HÌNH BẢN ĐỒ VÀ VẼ QUỸ ĐẠO
    # ==========================================
    fig, ax = plt.subplots(figsize=(8, 12))
    
    # --- A. VẼ QUỸ ĐẠO THỰC TẾ (MÀU XANH CÓ MŨI TÊN) ---
    if os.path.exists(TRUTH_PATH):
        truth_df = pd.read_csv(TRUTH_PATH)
        ax.plot(truth_df['x'], truth_df['y'], color='blue', linewidth=3.5, 
                linestyle='-', label='Quỹ đạo kịch bản', zorder=1)
        
        # Vẽ mũi tên dày hơn, to rõ hơn
        for i in range(len(truth_df) - 1):
            x1, y1 = truth_df.iloc[i]['x'], truth_df.iloc[i]['y']
            x2, y2 = truth_df.iloc[i+1]['x'], truth_df.iloc[i+1]['y']
            
            dx, dy = x2 - x1, y2 - y1
            distance = np.sqrt(dx**2 + dy**2)
            
            # Cứ khoảng 1.5 mét sẽ có 1 mũi tên (đảm bảo ít nhất 1 mũi tên mỗi đoạn)
            num_arrows = max(1, int(distance / 1.5))
            
            for j in range(1, num_arrows + 1):
                frac = j / (num_arrows + 1)
                px = x1 + dx * frac
                py = y1 + dy * frac
                
                # Cấu hình vector chỉ hướng chuẩn xác
                dir_x = dx / distance
                dir_y = dy / distance
                
                # Sử dụng kiểu -|> (tam giác đặc) với head_width lớn để tạo sự rõ nét
                ax.annotate('', xy=(px + dir_x*0.01, py + dir_y*0.01), xytext=(px, py),
                            arrowprops=dict(arrowstyle="-|>,head_width=0.6,head_length=0.9", 
                                            color='blue', lw=3.5), zorder=2)
    else:
        print(f"[Cảnh báo] Chưa có file kịch bản thực tế tại: {TRUTH_PATH}")

    # --- B. VẼ QUỸ ĐẠO ĐO ĐƯỢC TỪ LOG (MÀU ĐỎ) ---
    for tag, group in df.groupby("tag_id"):
        # Đã tăng markersize từ 4 lên 7 để điểm lấy mẫu to hơn
        ax.plot(group['x'], group['y'], marker='o', markersize=7, linestyle='-', 
                linewidth=3.5, color='red', alpha=1.0, label=f"Quỹ đạo thực tế (Tag: {tag})", zorder=3)
        
        ax.plot(group['x'].iloc[0], group['y'].iloc[0], marker='s', markersize=9, color='green', zorder=4)
        ax.plot(group['x'].iloc[-1], group['y'].iloc[-1], marker='X', markersize=9, color='darkred', zorder=4)

    # Cố định bản đồ 6x9
    ax.set_xlim(0, 6)
    ax.set_ylim(0, 9)

    ax.set_xticks(range(0, 7, 1))
    ax.set_yticks(range(0, 10, 1))

    ax.set_xlabel('X Coordinate (m)', fontsize=14, fontweight='bold')
    ax.set_ylabel('Y Coordinate (m)', fontsize=14, fontweight='bold')
    
    ax.grid(True, color='black', linestyle='-', linewidth=1.0, alpha=1.0)
    ax.set_aspect('equal', adjustable='box')
    ax.set_facecolor('#ffffff')
    ax.legend(loc='upper right')
    
    plt.tight_layout()
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    save_path = os.path.join(CURRENT_DIR, f"trajectory_comparison_{timestamp}.png")
    
    plt.savefig(save_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close('all') 
    
    print(f"[Thành công] Đã lưu ảnh đồ thị tại: {save_path}")

if __name__ == "__main__":
    main()