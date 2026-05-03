import axios from "axios";
import React, { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff, ArrowLeft, Play, Square, Flame } from "lucide-react";
import "../assets/css/RealtimeMonitor.css";

const TAG_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#f59e0b"];
const CELL_SIZE = 38;

function RealtimeMonitor({ mapData, systemMode, onBack }) {
  // === STATE CƠ BẢN CỦA IPS ===
  const [wsStatus, setWsStatus] = useState("connecting");
  const [locations, setLocations] = useState({});
  const locationsRef = useRef({}); // Dùng Ref để lưu toạ độ mới nhất, phục vụ vòng lặp Game
  const hasInitialized = useRef(false);

  // === STATE CỦA HỆ THỐNG HUẤN LUYỆN ===
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("free");
  const [trainingState, setTrainingState] = useState("idle"); // "idle", "running", "finished"
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [score, setScore] = useState(1000);
  const [sessionFires, setSessionFires] = useState([]); // Chứa danh sách lửa và trạng thái của chúng
  const intervalRef = useRef(null);

  const rows = mapData.rows || 10;
  const cols = mapData.cols || 10;
  const blocked = new Set(mapData.blocked_cells || []);
  const routers = new Set(mapData.router_location || []);

  // 1. GỌI API LOAD MODEL & LOAD SCENARIOS
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    let ws = null;

    const initSystem = async () => {
      try {
        // Load danh sách kịch bản
        const scRes = await axios.get(
          `http://localhost:8000/scenarios/${systemMode}/${mapData.map_info_id}`,
        );
        setScenarios(scRes.data);

        // Load model AI / UWB
        if (systemMode === "uwb") {
          await axios.post(
            `http://localhost:8000/set_active_uwb_map/${mapData.map_info_id}`,
          );
        } else if (systemMode === "fingerprint") {
          await axios.post(
            `http://localhost:8000/set_active_rssi_map/${mapData.map_info_id}`,
          );
        }

        // Kết nối WebSocket
        ws = new WebSocket("ws://localhost:8000/ws/realtime_location");
        ws.onopen = () => setWsStatus("connected");
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const tagId = data.tag_id;
            if (tagId) {
              setLocations((prev) => {
                const newLocs = { ...prev, [tagId]: data };
                locationsRef.current = newLocs; // Cập nhật Ref liên tục
                return newLocs;
              });
            }
          } catch (err) {
            console.error("WS error:", err);
          }
        };
        ws.onclose = () => setWsStatus("error");
      } catch (err) {
        alert(
          `Setup failed for Map #${mapData?.map_info_id}. Train model first if using RSSI!`,
        );
        onBack();
      }
    };

    initSystem();
    return () => {
      if (ws) ws.close();
    };
  }, [mapData?.map_info_id, systemMode]);

  // 2. VÒNG LẶP HUẤN LUYỆN (Chạy mỗi 1 giây)
  useEffect(() => {
    if (trainingState === "running") {
      intervalRef.current = setInterval(() => {
        setTimeElapsed((t) => t + 1);

        setSessionFires((prevFires) => {
          let scorePenalty = 0; // Trừ điểm nếu bị bỏng

          const updatedFires = prevFires.map((fire) => {
            if (fire.status === "extinguished") return fire; // Lửa đã tắt thì bỏ qua

            // Trạng thái chờ: Đợi hết delay_time thì bùng cháy
            if (fire.status === "waiting") {
              // Phải +1 vì timeElapsed ở callback state có thể chạy chậm hơn 1 nhịp
              if (timeElapsed + 1 >= fire.delay_time) {
                return { ...fire, status: "burning" };
              }
              return fire;
            }

            // Trạng thái cháy: Tính toán khoảng cách tới các thẻ Tag
            if (fire.status === "burning") {
              const tags = Object.values(locationsRef.current);
              let isSomeoneStepping = false; // Dẫm lên lửa
              let isSomeoneExtinguishing = false; // Đứng gần xịt cứu hoả

              for (const tag of tags) {
                // Công thức tính khoảng cách Pytago: sqrt((x1-x2)^2 + (y1-y2)^2)
                const dist = Math.sqrt(
                  Math.pow(tag.x - fire.coord_x, 2) +
                    Math.pow(tag.y - fire.coord_y, 2),
                );

                if (dist <= 0.5) isSomeoneStepping = true;
                if (dist <= 1.5) isSomeoneExtinguishing = true;
              }

              if (isSomeoneStepping) scorePenalty += 20; // Trừ 20 điểm

              if (isSomeoneExtinguishing) {
                const requiredTime =
                  fire.level === 1 ? 3 : fire.level === 2 ? 5 : 8;
                const newProgress = fire.progress + 1;

                if (newProgress >= requiredTime) {
                  return {
                    ...fire,
                    status: "extinguished",
                    progress: newProgress,
                  };
                }
                return { ...fire, progress: newProgress };
              } else {
                // Đang dập mà bỏ đi chỗ khác -> reset tiến trình về 0
                return { ...fire, progress: 0 };
              }
            }
            return fire;
          });

          // Trừ điểm thời gian (1đ/s) và điểm phạt bỏng
          setScore((s) => Math.max(0, s - 1 - scorePenalty));

          // Kiểm tra xem đã dập xong hết lửa chưa (Win Condition)
          if (updatedFires.every((f) => f.status === "extinguished")) {
            setTrainingState("finished"); // Kích hoạt useEffect kết thúc
          }

          return updatedFires;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [trainingState, timeElapsed]);

  // 3. XỬ LÝ KHI KẾT THÚC BÀI TẬP (Lưu vào DB)
  useEffect(() => {
    if (trainingState === "finished") {
      alert(`Simulation Completed!\nTime: ${timeElapsed}s\nScore: ${score}`);

      // Lấy ID thiết bị đầu tiên làm người chơi chính
      const tagIds = Object.keys(locationsRef.current);
      const mainDevice = tagIds.length > 0 ? tagIds[0] : "Unknown_Device";

      axios
        .post("http://localhost:8000/training_history", {
          username: "Trainee", // Hiện tại Hardcode, có thể lấy từ Context Login sau
          scenario_id: Number(selectedScenarioId),
          device_hex_id: mainDevice,
          score: score,
        })
        .then(() => console.log("History saved!"))
        .catch((err) => console.error("Failed to save history", err));
    }
  }, [trainingState, score, timeElapsed, selectedScenarioId]);

  // 4. CÁC HÀM ĐIỀU KHIỂN NÚT BẤM
  const handleStartTraining = () => {
    if (selectedScenarioId === "free") return;

    const sc = scenarios.find(
      (s) => s.scenario_id === Number(selectedScenarioId),
    );
    if (!sc || sc.fires.length === 0)
      return alert("This scenario has no fires!");

    // Khởi tạo các ngọn lửa với trạng thái chờ
    const initializedFires = sc.fires.map((f) => ({
      ...f,
      status: "waiting", // waiting -> burning -> extinguished
      progress: 0,
    }));

    setSessionFires(initializedFires);
    setScore(1000);
    setTimeElapsed(0);
    setTrainingState("running");
  };

  const handleStopTraining = () => {
    setTrainingState("idle");
    setSessionFires([]);
    setTimeElapsed(0);
    setScore(1000);
  };

  // === RENDER GIAO DIỆN LƯỚI ===
  const gridCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const coordX = (c + 0.5).toFixed(1);
      const coordY = (rows - 1 - r + 0.5).toFixed(1);
      const key = `${coordX}:${coordY}`;
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
      {/* HEADER CŨ */}
      <div
        className="rm-header"
        style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}
      >
        <div className="rm-title-area">
          <button
            className="btn btn-secondary"
            onClick={onBack}
            disabled={trainingState === "running"}
          >
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
          {Object.entries(locations).map(([tagId, loc], idx) => {
            const color = TAG_COLORS[idx % TAG_COLORS.length];
            return (
              <div key={tagId} className="error-badge" style={{ color: color }}>
                <strong>{tagId}</strong> |{" "}
                {loc.type === "uwb"
                  ? `Err: ${loc.error}m`
                  : `Acc: ${loc.accuracy}%`}
              </div>
            );
          })}
        </div>
      </div>

      {/* TOOLBAR HUẤN LUYỆN MỚI */}
      <div className="training-toolbar">
        <select
          className="input-field"
          style={{ width: "250px", margin: 0 }}
          value={selectedScenarioId}
          onChange={(e) => setSelectedScenarioId(e.target.value)}
          disabled={trainingState !== "idle"}
        >
          <option value="free">-- Free Roam Mode --</option>
          {scenarios.map((sc) => (
            <option key={sc.scenario_id} value={sc.scenario_id}>
              {sc.scenario_name}
            </option>
          ))}
        </select>

        {selectedScenarioId !== "free" && trainingState === "idle" && (
          <button
            className="btn btn-dark"
            style={{ padding: "10px 20px", borderRadius: 8 }}
            onClick={handleStartTraining}
          >
            <Play size={18} /> Start Scenario
          </button>
        )}

        {(trainingState === "running" || trainingState === "finished") && (
          <button
            className="btn btn-secondary"
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              color: "#ef4444",
              borderColor: "#ef4444",
            }}
            onClick={handleStopTraining}
          >
            <Square size={18} /> Stop
          </button>
        )}

        {(trainingState === "running" || trainingState === "finished") && (
          <div className="training-stats">
            <div className="stat-box time-text">Time: {timeElapsed}s</div>
            <div className="stat-box score-text">Score: {score}</div>
          </div>
        )}
      </div>

      <div className="map-grid-section">
        <div className="corner-empty"></div>
        {/* TRỤC X & Y GIỮ NGUYÊN ... */}
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
        <div
          className="y-axis-container"
          style={{
            display: "grid",
            gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px)`,
          }}
        >
          {Array.from({ length: rows }, (_, i) => (
            <div key={`y-${i}`} className="axis-label-box">
              <span className="axis-text">
                {(rows - 1 - i + 0.5).toFixed(1)}
              </span>
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

          {/* VẼ BEACON UWB */}
          {systemMode === "uwb" &&
            mapData.beacon_location &&
            Object.entries(mapData.beacon_location).map(([id, pos]) => (
              <div
                key={`beacon-${id}`}
                className="beacon-dot-wrapper"
                style={{
                  left: `${pos.x * CELL_SIZE}px`,
                  top: `${(rows - pos.y) * CELL_SIZE}px`,
                }}
              >
                <div className="beacon-dot"></div>
                <div className="beacon-number-label">{id}</div>
              </div>
            ))}

          {/* VẼ NGỌN LỬA MÔ PHỎNG */}
          {sessionFires.map((fire, idx) => {
            if (fire.status === "waiting") return null; // Ẩn khi chưa tới lúc cháy

            const requiredTime =
              fire.level === 1 ? 3 : fire.level === 2 ? 5 : 8;
            const progressPercent = (fire.progress / requiredTime) * 100;

            return (
              <div
                key={`fire-${idx}`}
                className="sim-fire-wrapper"
                style={{
                  left: `${fire.coord_x * CELL_SIZE}px`,
                  top: `${(rows - fire.coord_y) * CELL_SIZE}px`,
                }}
              >
                {fire.status === "burning" ? (
                  <>
                    <div className="sim-fire-icon">🔥</div>
                    <div className="sim-progress-bar">
                      <div
                        className="sim-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </>
                ) : (
                  <div className="sim-extinguished">💨</div>
                )}
              </div>
            );
          })}

          {/* VẼ TAG DI CHUYỂN */}
          {Object.entries(locations).map(([tagId, loc], idx) => {
            const color = TAG_COLORS[idx % TAG_COLORS.length];
            return (
              <div
                key={tagId}
                className="radar-dot"
                style={{
                  left: `${loc.x * CELL_SIZE}px`,
                  top: `${(rows - loc.y) * CELL_SIZE}px`,
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
