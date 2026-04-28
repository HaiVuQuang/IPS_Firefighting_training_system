import React, { useState } from "react";
import axios from "axios";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Database,
  X,
  DatabaseZap,
} from "lucide-react";
import "../assets/css/CollectData.css";

function CollectData({ mapData }) {
  const [selectedCell, setSelectedCell] = useState(null);
  const [collectedCells, setCollectedCells] = useState(new Set());
  const [samples, setSamples] = useState(50);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Quản lý trạng thái chi tiết cho nút Submit ( processing, success, error)
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  // Trạng thái chi tiết cho nút Train Model
  const [trainModelStatus, setTrainModelStatus] = useState("idle");
  const [trainModelMessage, setTrainModelMessage] = useState("");

  const rows = mapData.rows || 10;
  const cols = mapData.cols || 10;
  const blocked = new Set(mapData.blocked_cells || []);
  const routers = new Set(mapData.router_location || []);

  const handleCellClick = (r, c) => {
    const key = `${c}:${r}`;
    if (blocked.has(key)) {
      alert("Cannot collect data on a blocked cell!");
      return;
    }
    if (collectedCells.has(key)) {
      const confirmOverwrite = window.confirm(
        "This cell has already been data-collected. Are you sure you want to re-collect data?",
      );
      if (!confirmOverwrite) return;
    }
    // Mở popup
    setSelectedCell({ r, c, x: (0.5 + c).toFixed(1), y: (0.5 + r).toFixed(1) });
    setMessage("");
  };

  const handleCollectData = async () => {
    setLoading(true);
    setMessage("");
    try {
      const payload = {
        map_info_id: mapData.map_info_id,
        coord_x: Number(selectedCell.x),
        coord_y: Number(selectedCell.y),
        samples: Number(samples),
      };
      const res = await axios.post(
        "http://localhost:8000/collect_data",
        payload,
      );

      const cellKey = `${selectedCell.c}:${selectedCell.r}`;
      setCollectedCells((prev) => new Set(prev).add(cellKey));

      setMessage(res.data.message);
      setTimeout(() => setSelectedCell(null), 2000); // Tự đóng popup sau 2s
    } catch (err) {
      alert("Failed to collect data");
    }
    setLoading(false);
  };

  // --- HÀM XỬ LÝ: Submit với cập nhật trạng thái chi tiết ---
  const handleSubmit = async () => {
    setSubmitStatus("processing"); // Đang xử lý
    setSubmitMessage("WBO Filter is processing RSSI data...");

    try {
      // Gọi API preprocess_map ở Backend
      const res = await axios.post(
        `http://localhost:8000/preprocess_map/${mapData.map_info_id}`,
      );
      setSubmitStatus("success"); // Thành công
      setSubmitMessage(res.data.message); // Hiển thị thông báo thành công
    } catch (err) {
      console.error(err);
      setSubmitStatus("error"); // Lỗi
      setSubmitMessage("Failed to generate CSV data. Check Backend log.");
    }

    // Tự động xóa thông báo và reset trạng thái nút sau 4 giây
    setTimeout(() => {
      setSubmitMessage("");
      setSubmitStatus("idle");
    }, 4000);
  };

  const handleTrainModel = async () => {
    setTrainModelStatus("processing");
    setTrainModelMessage("AI is learning... This may take a few minutes.");

    try {
      const res = await axios.post(
        `http://localhost:8000/train_model/${mapData.map_info_id}`,
      );
      setTrainModelStatus("success");
      setTrainModelMessage(res.data.message);
    } catch (err) {
      console.error(err);
      setTrainModelStatus("error");
      setTrainModelMessage("Training failed. Check log terminal.");
    }

    setTimeout(() => {
      setTrainModelMessage("");
      setTrainModelStatus("idle");
    }, 5000);
  };

  // --- HÀM HELPER: Render vùng thông báo dựa trên trạng thái ---
  const renderSubmitNotification = () => {
    if (!submitMessage) return null;

    let containerClass = "cd-notification-container";
    let Icon = null;

    if (submitStatus === "processing") {
      containerClass += " cd-notification-processing";
      Icon = <Loader2 size={18} className="spin" />; // Icon load xoay tròn
    } else if (submitStatus === "success") {
      containerClass += " cd-notification-success";
      Icon = <CheckCircle size={18} />; // Icon tích xanh
    } else if (submitStatus === "error") {
      containerClass += " cd-notification-error";
      Icon = <AlertTriangle size={18} />; // Icon cảnh báo đỏ
    }

    return (
      <div className={containerClass}>
        {Icon}
        <span>{submitMessage}</span>
      </div>
    );
  };

  const renderTrainModelNotification = () => {
    if (!trainModelMessage) return null;

    let containerClass = "cd-notification-container";
    let Icon = null;
    if (trainModelStatus === "processing") {
      containerClass += " cd-notification-processing";
      Icon = <Loader2 size={18} className="spin" />;
    } else if (trainModelStatus === "success") {
      containerClass += " cd-notification-success";
      Icon = <CheckCircle size={18} />;
    } else if (trainModelStatus === "error") {
      containerClass += " cd-notification-error";
      Icon = <AlertTriangle size={18} />;
    }
    return (
      <div className={containerClass}>
        {Icon}
        <span>{trainModelMessage}</span>
      </div>
    );
  };

  // --- HÀM HELPER: Render nút bấm dựa trên trạng thái ---
  const renderSubmitButton = () => {
    const isProcessing = submitStatus === "processing";
    return (
      <button
        className="btn-run-model" // Dùng class CSS mới
        onClick={handleSubmit}
        disabled={isProcessing} // Vô hiệu hóa khi đang chạy
      >
        {isProcessing ? (
          // Đang chạy: Hiện icon xoay
          <Loader2 size={18} className="spin" />
        ) : (
          // Bình thường: Hiện icon mũi tên
          <ArrowRight size={18} />
        )}
        {isProcessing ? "Processing..." : "Submit"}
      </button>
    );
  };

  const renderTrainModelButton = () => {
    const isProcessing = trainModelStatus === "processing";
    return (
      <button
        className="btn-run-model"
        onClick={handleTrainModel}
        disabled={
          trainModelStatus === "processing" || submitStatus === "processing"
        }
      >
        {trainModelStatus === "processing" ? (
          <Loader2 size={18} className="spin" />
        ) : (
          <ArrowRight size={18} />
        )}
        {trainModelStatus === "processing" ? "Training..." : "Train Model"}
      </button>
    );
  };

  // --- Render các ô map (Giữ nguyên) ---
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${c}:${r}`;
      const isBlocked = blocked.has(key);
      const hasRouter = routers.has(key);
      const isSelected = selectedCell?.r === r && selectedCell?.c === c;
      const isCollected = collectedCells.has(key);

      cells.push(
        <button
          key={key}
          type="button"
          className={`map-cell ${isBlocked ? "blocked" : ""} ${hasRouter ? "router-cell" : ""} ${isCollected ? "collected" : ""}`}
          onClick={() => handleCellClick(r, c)}
        >
          {hasRouter && <span>📡</span>}
        </button>,
      );
    }
  }

  return (
    <div className="map-editor">
      {/* --- PHẦN HEADER ĐÃ ĐƯỢC TÁI CẤU TRÚC ĐẸP HƠN --- */}
      <div className="cd-header">
        <div className="cd-title-area">
          <h2 className="cd-title-text">
            Colect Data Map #{mapData.map_info_id}
          </h2>
        </div>

        <div className="cd-action-area">
          {/* Render vùng thông báo (vàng, xanh, đỏ tùy trạng thái) */}
          {renderSubmitNotification()}
          {/* Render nút Submit (màu xanh dương gradient) */}
          {renderSubmitButton()}

          {renderTrainModelNotification()}
          {/* NÚT 2: TRAIN AI MODEL */}
          {renderTrainModelButton()}
        </div>
      </div>

      <div
        className="map-grid-section"
        style={{ "--map-cols": cols, "--map-rows": rows }}
      >
        <div className="corner-empty"></div>
        {/* Render Trục X */}
        <div className="x-labels">
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className="x-label">
              {(0.5 + i).toFixed(1)}
            </div>
          ))}
        </div>
        {/* Render Trục Y */}
        <div className="y-labels">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="y-label">
              {(0.5 + i).toFixed(1)}
            </div>
          ))}
        </div>
        <div className="map-grid">{cells}</div>
      </div>
      {/* POPUP (MODAL) THU THẬP DỮ LIỆU CHUẨN APPLE/FINTECH */}
      {selectedCell && (
        <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Nút X đóng cửa sổ */}
            <button
              className="btn-close-modal"
              onClick={() => setSelectedCell(null)}
            >
              <X size={24} />
            </button>

            {/* Icon minh họa */}
            <div className="modal-icon">
              <Database size={24} />
            </div>

            <h2 className="modal-title">Collect RSSI Data</h2>
            <p className="modal-subtitle">
              Coordinate:{" "}
              <strong>
                X: {selectedCell.x}, Y: {selectedCell.y}
              </strong>
            </p>

            <div className="label-form">
              <label className="label-title">Number of samples:</label>
              <input
                className="modal-input"
                type="number"
                value={samples}
                onChange={(e) => setSamples(e.target.value)}
              />
            </div>

            {/* Thông báo thành công nằm gọn gàng bên trong */}
            {message && (
              <div className="success-message">
                <CheckCircle size={18} /> {message}
              </div>
            )}

            {/* Nút Submit phủ toàn bộ chiều ngang */}
            <button
              className="btn-modal-submit"
              onClick={handleCollectData}
              disabled={loading}
            >
              {loading ? "Collecting..." : "Start"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollectData;
