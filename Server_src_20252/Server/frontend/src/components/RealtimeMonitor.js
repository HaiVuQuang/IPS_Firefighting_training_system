import React, { useState, useEffect } from "react";
import {
  Radio,
  Wifi,
  WifiOff,
  ArrowLeft,
  Target,
  Activity,
} from "lucide-react";
import "../assets/css/RealtimeMonitor.css";

const TAG_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

function RealtimeMonitor({ mapData, systemMode, onBack }) {
  const [wsStatus, setWsStatus] = useState("connecting");
  const [locations, setLocations] = useState({});

  const rows = mapData.rows || 10;
  const cols = mapData.cols || 10;
  const blocked = new Set(mapData.blocked_cells || []);
  const routers = new Set(mapData.router_location || []);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/realtime_location");
    ws.onopen = () => setWsStatus("connected");
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const tagId = data.tag_id || "Device_1";
        setLocations((prev) => ({ ...prev, [tagId]: data }));
      } catch (err) {
        console.error("Error parsing WS:", err);
      }
    };
    ws.onclose = () => setWsStatus("error");
    return () => ws.close();
  }, []);

  // 1. Vẽ Lưới nền (Chỉ vẽ tường và trạm phát)
  const gridCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${c}:${r}`;
      gridCells.push(
        <div
          key={key}
          className={`map-cell monitor-cell ${blocked.has(key) ? "blocked" : ""} ${routers.has(key) ? "router-cell" : ""}`}
        >
          {routers.has(key) && <span className="router-icon">📡</span>}
        </div>,
      );
    }
  }

  return (
    <div className="rm-monitor">
      <div className="rm-header">
        <div className="rm-title-area">
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <h2 className="rm-title-text">Monitor: Map #{mapData.map_info_id}</h2>
        </div>
        <div className="rm-action-area">
          <div className={`status-badge ${wsStatus}`}>
            {wsStatus === "connected" ? (
              <Wifi size={16} />
            ) : (
              <WifiOff size={16} />
            )}
            {wsStatus === "connected" ? "Connected" : "Lost"}
          </div>
          {Object.entries(locations).map(([tagId, loc], idx) => (
            <div
              key={tagId}
              className="confidence-badge"
              style={{
                borderLeft: `4px solid ${TAG_COLORS[idx % TAG_COLORS.length]}`,
              }}
            >
              <Activity size={16} color={TAG_COLORS[idx % TAG_COLORS.length]} />
              <strong style={{ color: TAG_COLORS[idx % TAG_COLORS.length] }}>
                {tagId}
              </strong>
              <span style={{ margin: "0 8px" }}>|</span>
              {loc.type === "uwb" ? (
                <span>
                  Err: <strong>{loc.error}m</strong>
                </span>
              ) : (
                <span>
                  Acc: <strong>{loc.accuracy}%</strong>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        className="map-grid-section"
        style={{ "--map-cols": cols, "--map-rows": rows }}
      >
        <div className="corner-empty"></div>
        <div className="x-labels">
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className="x-label">
              {(0.5 + i).toFixed(1)}
            </div>
          ))}
        </div>
        <div className="y-labels">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="y-label">
              {(0.5 + i).toFixed(1)}
            </div>
          ))}
        </div>

        {/* --- KHU VỰC BẢN ĐỒ CHÍNH --- */}
        <div className="map-grid" style={{ position: "relative" }}>
          {/* Lớp 1: Lưới ô vuông (Background) */}
          {gridCells}

          {/* Lớp 2: Lớp phủ tọa độ tuyệt đối (Overlay) */}
          <div
            className="absolute-position-layer"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none", // Để không chặn click vào các ô lưới bên dưới
            }}
          >
            {Object.entries(locations).map(([tagId, loc], idx) => {
              const color = TAG_COLORS[idx % TAG_COLORS.length];
              return (
                <div
                  key={tagId}
                  className="radar-dot"
                  style={{
                    position: "absolute",
                    // Tọa độ thực tế / Tổng số ô * 100%
                    left: `${(loc.x / cols) * 100}%`,
                    top: `${(loc.y / rows) * 100}%`,
                    transform: "translate(-50%, -50%)", // Đưa tâm dấu chấm vào đúng tọa độ
                    transition: "all 0.3s ease-out", // Hiệu ứng lướt mượt
                    zIndex: 100,
                  }}
                >
                  <div
                    className="radar-pulse"
                    style={{ borderColor: color }}
                  ></div>
                  <div
                    className="radar-core"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: "11px",
                      fontWeight: "bold",
                      color: color,
                      whiteSpace: "nowrap",
                      textShadow: "1px 1px 0 #fff",
                    }}
                  >
                    {tagId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RealtimeMonitor;
