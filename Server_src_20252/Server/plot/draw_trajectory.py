import os
import sys
import pandas as pd
import matplotlib
matplotlib.use('Agg') # Bắt buộc dùng Agg khi chạy ngầm
import matplotlib.pyplot as plt
from datetime import datetime

# Lấy thư mục gốc (lùi lại 1 cấp từ thư mục plot)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT_DIR, 'trajectory_data', 'trajectory_log.csv')
OUTPUT_DIR = os.path.join(ROOT_DIR, 'graphs')

def main():
    if not os.path.exists(CSV_PATH):
        print("[Error] Trajectory CSV file not found.")
        sys.exit(1)

    df = pd.read_csv(CSV_PATH)
    if df.empty:
        print("[Error] Trajectory CSV file is empty.")
        sys.exit(1)

    # Đảm bảo thư mục graphs tồn tại
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    fig, ax = plt.subplots(figsize=(10, 8))
    
    colors = ['#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#f59e0b']
    
    # Nhóm theo tag_id và vẽ từng đường
    for idx, (tag, group) in enumerate(df.groupby("tag_id")):
        color = colors[idx % len(colors)]
        ax.plot(group['x'], group['y'], marker='o', markersize=4, linestyle='--', 
                linewidth=1.5, color=color, alpha=0.7, label=f"Tag: {tag}")
        
        # Đánh dấu điểm Đầu (Xanh) và Cuối (Đỏ)
        ax.plot(group['x'].iloc[0], group['y'].iloc[0], marker='s', markersize=8, color='green')
        ax.plot(group['x'].iloc[-1], group['y'].iloc[-1], marker='X', markersize=8, color='red')

    ax.set_xlabel('X Coordinate (m)', fontsize=12)
    ax.set_ylabel('Y Coordinate (m)', fontsize=12)
    ax.grid(True, linestyle='--', alpha=0.6)
    ax.set_aspect('equal', adjustable='datalim')
    ax.legend(loc='upper right')
    
    plt.tight_layout()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    save_path = os.path.join(OUTPUT_DIR, f"trajectory_{timestamp}.png")
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    plt.close('all') 
    
    print(f"Image saved at {save_path}")

if __name__ == "__main__":
    main()