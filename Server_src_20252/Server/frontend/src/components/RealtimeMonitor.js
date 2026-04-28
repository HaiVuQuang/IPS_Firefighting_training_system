import axios from "axios";
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

const TAG_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444"];

function RealtimeMonitor({ mapData, systemMode, onBack }) {
  const [wsStatus, setWsStatus] = useState("connecting");
  const [locations, setLocations] = useState({});

  const rows = mapData.rows || 10;
  const cols = mapData.cols || 10;
  const blocked = new Set(mapData.blocked_cells || []);
  const routers = new Set(mapData.router_location || []);

  useEffect(() => {
    // Nếu mode là uwb gọi API lấy tọa độ của đúng map ID đó
    if (systemMode === "uwb" && mapData?.map_info_id) {
      axios
        .post(`http://localhost:8000/set_active_uwb_map/${mapData.map_info_id}`)
        .then(() => console.log("Switched to map", mapData.map_info_id))
        .catch((err) => console.error("Failed to switch map", err));
    }

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
  }, [mapData, systemMode]);

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
            {wsStatus === "connected" ? "WebSocket Connected" : "Lost"}
          </div>
          {Object.entries(locations).map(([tagId, loc], idx) => {
            const color = TAG_COLORS[idx % TAG_COLORS.length];
            return (
              <div
                key={tagId}
                className="confidence-badge"
                style={{ color: color }}
              >
                <strong>{tagId}</strong>
                <span>|</span>
                {loc.type === "uwb" ? (
                  <span>
                    Error: <strong>{loc.error}m</strong>
                  </span>
                ) : (
                  <span>
                    Acc: <strong>{loc.accuracy}%</strong>
                  </span>
                )}
              </div>
            );
          })}
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
        <div className="map-grid">
          {/* Lớp 1: Lưới ô vuông (Background) */}
          {gridCells}

          {/* LỚP HIỂN THỊ CÁC UWB BEACONS TĨNH */}
          {systemMode === "uwb" && mapData.beacon_location && (
            <div className="absolute-position-layer">
              {Object.entries(mapData.beacon_location).map(([id, pos]) => (
                <div
                  key={`beacon-${id}`}
                  className="beacon-dot-wrapper"
                  style={{
                    left: `${(pos.x / cols) * 100}%`,
                    top: `${(pos.y / rows) * 100}%`,
                  }}
                >
                  <div className="beacon-fixed-dot"></div>
                  <div className="beacon-number-label">{id}</div>
                </div>
              ))}
            </div>
          )}

          {/* Lớp 2: Lớp phủ tọa độ tuyệt đối (Overlay) */}
          <div className="absolute-position-layer">
            {Object.entries(locations).map(([tagId, loc], idx) => {
              const color = TAG_COLORS[idx % TAG_COLORS.length];
              return (
                <div
                  key={tagId}
                  className="radar-dot"
                  style={{
                    left: `${(loc.x / cols) * 100}%`,
                    top: `${(loc.y / rows) * 100}%`,
                  }}
                >
                  <div
                    className="tag-base"
                    style={{ boxShadow: `0 0 8px ${color}` }}
                  >
                    <div
                      className="tag-core"
                      style={{ backgroundColor: color }}
                    ></div>
                  </div>

                  <span className="radar-label" style={{ color: color }}>
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
