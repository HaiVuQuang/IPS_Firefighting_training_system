import axios from "axios";
import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, ArrowLeft } from "lucide-react";
import "../assets/css/RealtimeMonitor.css";

const TAG_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#f59e0b"];
const CELL_SIZE = 38;

function RealtimeMonitor({ mapData, systemMode, onBack }) {
  const [wsStatus, setWsStatus] = useState("connecting");
  const [locations, setLocations] = useState({});

  const rows = mapData.rows || 10;
  const cols = mapData.cols || 10;
  const blocked = new Set(mapData.blocked_cells || []);
  const routers = new Set(mapData.router_location || []);

  useEffect(() => {
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

  const gridCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${(c + 0.5).toFixed(1)}:${(r + 0.5).toFixed(1)}`;
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
    <div className="rm-container">
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
              <div key={tagId} className="error-badge" style={{ color: color }}>
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

      <div className="map-grid-section">
        <div className="corner-empty"></div>
        {/* TRỤC X */}
        <div
          className="x-axis-container"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
          }}
        >
          {Array.from({ length: cols }, (_, i) => (
            <div key={`x-${i}`} className="axis-label-box">
              <span className="axis-text">{(0.5 + i).toFixed(1)}</span>
              <div className="axis-tick-x"></div>
            </div>
          ))}
        </div>

        {/* TRỤC Y */}
        <div
          className="y-axis-container"
          style={{
            display: "grid",
            gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px)`,
          }}
        >
          {Array.from({ length: rows }, (_, i) => (
            <div key={`y-${i}`} className="axis-label-box">
              <span className="axis-text">{(0.5 + i).toFixed(1)}</span>
              <div className="axis-tick-y"></div>
            </div>
          ))}
        </div>

        {/* LƯỚI BẢN ĐỒ */}
        <div
          className="map-grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px)`,
          }}
        >
          {gridCells}

          {/* VẼ BEACON VỚI MODE UWB */}
          {systemMode === "uwb" &&
            mapData.beacon_location &&
            Object.entries(mapData.beacon_location).map(([id, pos]) => (
              <div
                key={`beacon-${id}`}
                className="beacon-dot-wrapper"
                style={{
                  left: `${pos.x * CELL_SIZE}px`,
                  top: `${pos.y * CELL_SIZE}px`,
                }}
              >
                <div className="beacon-dot"></div>
                <div className="beacon-number-label">{id}</div>
              </div>
            ))}

          {/* VẼ TAG DI CHUYỂN */}
          {Object.entries(locations).map(([tagId, loc], idx) => {
            const color = TAG_COLORS[idx % TAG_COLORS.length];
            return (
              <div
                key={tagId}
                className="radar-dot"
                style={{
                  left: `${loc.x * CELL_SIZE}px`,
                  top: `${loc.y * CELL_SIZE}px`,
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
  );
}

export default RealtimeMonitor;
