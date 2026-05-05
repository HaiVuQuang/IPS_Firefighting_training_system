import axios from "axios";
import React, { useState, useEffect, useRef } from "react";
import {
  Wifi,
  WifiOff,
  ArrowLeft,
  Play,
  X,
  Flame,
  Pause,
  Timer,
  Trophy,
} from "lucide-react";
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
  const [countdown, setCountdown] = useState(null);

  const intervalRef = useRef(null);
  const timeRef = useRef(0);
  const firesRef = useRef([]);

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
        // 1. Tăng thời gian (Dùng timeRef để không bị ảnh hưởng bởi React State)
        timeRef.current += 1;
        setTimeElapsed(timeRef.current);

        let scorePenalty = 0;
        let fireStateChanged = false;

        // 2. Xử lý logic lửa dựa trên mảng firesRef (Rất an toàn, không bị chạy 2 lần)
        const updatedFires = firesRef.current.map((fire) => {
          if (fire.status === "extinguished") return fire;

          if (fire.status === "waiting") {
            if (timeRef.current >= fire.delay_time) {
              fireStateChanged = true;
              return { ...fire, status: "burning" };
            }
            return fire;
          }

          if (fire.status === "burning") {
            const tags = Object.values(locationsRef.current);
            let isSomeoneStepping = false;
            let isSomeoneExtinguishing = false;

            for (const tag of tags) {
              const dist = Math.sqrt(
                Math.pow(tag.x - fire.coord_x, 2) +
                  Math.pow(tag.y - fire.coord_y, 2),
              );
              if (dist <= 0.5) isSomeoneStepping = true;
              if (dist <= 1.5) isSomeoneExtinguishing = true;
            }

            if (isSomeoneStepping) scorePenalty += 20;

            if (isSomeoneExtinguishing) {
              const requiredTime =
                fire.level === 1 ? 3 : fire.level === 2 ? 5 : 8;
              const newProgress = fire.progress + 1;

              if (newProgress >= requiredTime) {
                fireStateChanged = true;
                return {
                  ...fire,
                  status: "extinguished",
                  progress: newProgress,
                  level: 0,
                };
              }
              return { ...fire, progress: newProgress };
            } else {
              return { ...fire, progress: 0 };
            }
          }
          return fire;
        });

        // 3. Trừ điểm phạt
        setScore((s) => Math.max(0, s - 1 - scorePenalty));

        // 4. GỬI MQTT ĐỘC LẬP (Đảm bảo chỉ gửi đúng 1 lần duy nhất)
        if (fireStateChanged) {
          const payloadArr = [];
          updatedFires.forEach((f) => {
            const xIdx = Math.floor(f.coord_x);
            const yIdx = Math.floor(f.coord_y);
            const cellId = yIdx * 10 + xIdx + 1;

            let currentLevel = 0;
            if (f.status === "burning") currentLevel = f.level;
            else if (f.status === "extinguished" || f.status === "waiting")
              currentLevel = 0;

            payloadArr.push(`${cellId},${currentLevel}`);
          });

          const payloadStr = payloadArr.join(",");
          axios
            .post("http://localhost:8000/fire_update", { payload: payloadStr })
            .catch((err) => console.error("MQTT Publish Error:", err));
        }

        // 5. Kiểm tra End Game
        if (updatedFires.every((f) => f.status === "extinguished")) {
          setTrainingState("finished");
        }

        // 6. Cập nhật lại bản sao (Ref) và Giao diện (State)
        firesRef.current = updatedFires;
        setSessionFires(updatedFires);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [trainingState, cols]);

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

  // Bật đếm ngược 3-2-1 trước khi Start
  const handleInitiateTraining = () => {
    setCountdown(3);
    let count = 3;
    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(timer);
        setCountdown(null); // Tắt màn hình đếm ngược
        handleStartTraining(); // Gọi hàm chạy game thực sự
      }
    }, 1000);
  };
  // 4. CÁC HÀM ĐIỀU KHIỂN NÚT BẤM
  const handleStartTraining = () => {
    if (selectedScenarioId === "free") return;

    const sc = scenarios.find(
      (s) => s.scenario_id === Number(selectedScenarioId),
    );
    if (!sc || sc.fires.length === 0)
      return alert("This scenario has no fires!");

    const initializedFires = sc.fires.map((f) => ({
      ...f,
      status: "waiting",
      progress: 0,
    }));

    // Cập nhật cả Ref lẫn State
    firesRef.current = initializedFires;
    setSessionFires(initializedFires);

    timeRef.current = 0;
    setTimeElapsed(0);
    setScore(1000);
    setTrainingState("running");
  };

  const handleAbortTraining = () => {
    // Ép tắt toàn bộ ngọn lửa trên TFT
    if (firesRef.current.length > 0) {
      const payloadArr = firesRef.current.map((f) => {
        const xIdx = Math.floor(f.coord_x);
        const yIdx = Math.floor(f.coord_y);
        const cellId = yIdx * 10 + xIdx + 1;
        return `${cellId},0`;
      });
      axios
        .post("http://localhost:8000/fire_update", {
          payload: payloadArr.join(","),
        })
        .catch((err) => console.error("Error:", err));
    }

    setTrainingState("idle");

    // Reset toàn bộ Ref và State
    firesRef.current = [];
    setSessionFires([]);
    timeRef.current = 0;
    setTimeElapsed(0);
    setScore(1000);
    setSelectedScenarioId("free");
  };

  const handlePauseTraining = () => {
    setTrainingState("paused");
  };

  const handleResumeTraining = () => {
    setTrainingState("running");
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
          <div className={`status-badge ${wsStatus}`}>
            {wsStatus === "connected" ? (
              <Wifi size={16} />
            ) : (
              <WifiOff size={16} />
            )}
            {wsStatus === "connected" ? "Connected" : "Lost"}
          </div>
        </div>
        <div className="rm-action-area">
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
          <option value="free">-- Select Scenario --</option>
          {scenarios.map((sc) => (
            <option key={sc.scenario_id} value={sc.scenario_id}>
              {sc.scenario_name}
            </option>
          ))}
        </select>

        {trainingState === "running" && (
          <>
            <button
              className="btn-outline-icon btn-outline-black"
              onClick={handlePauseTraining}
              title="Pause"
            >
              <Pause size={18} />
            </button>
            <button
              className="btn-outline-icon btn-outline-black"
              onClick={handleAbortTraining}
              title="End"
            >
              <X size={18} />
            </button>
          </>
        )}

        {trainingState === "paused" && (
          <>
            <button
              className="btn-outline-icon btn-outline-black"
              onClick={handleResumeTraining}
              title="Resume"
            >
              <Play size={18} />
            </button>
            <button
              className="btn-outline-icon btn-outline-black"
              onClick={handleAbortTraining}
              title="End"
            >
              <X size={18} />
            </button>
          </>
        )}

        {/* Nút Close (Hiện khi đã hoàn thành) */}
        {trainingState === "finished" && (
          <button
            className="btn-outline-icon btn-outline-black"
            onClick={handleAbortTraining}
            title="Close"
          >
            <X size={18} />
          </button>
        )}

        {(trainingState === "running" ||
          trainingState === "paused" ||
          trainingState === "finished") && (
          <div className="training-stats">
            <div className="stat-box time-text">
              <Timer size={16} /> {timeElapsed}s
            </div>
            <div className="stat-box score-text">
              <Trophy size={16} /> {score}
            </div>
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
                    {progressPercent > 0 && (
                      <div className="sim-progress-bar">
                        <div
                          className="sim-progress-fill"
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="sim-extinguished"></div>
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
      {selectedScenarioId !== "free" && trainingState === "idle" && (
        <div className="rm-start-overlay">
          {countdown === null ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <button
                className="rm-huge-play-btn"
                onClick={handleInitiateTraining}
              >
                {/* Dùng thuộc tính fill="white" để icon Play đặc lại, marginLeft để icon cân giữa hình tròn */}
                <Play
                  size={54}
                  fill="white"
                  color="white"
                  style={{ marginLeft: 8 }}
                />
              </button>
              <div
                className="rm-cancel-hint"
                onClick={() => setSelectedScenarioId("free")}
              >
                Tap here to cancel
              </div>
            </div>
          ) : (
            <div className="rm-countdown-text">{countdown}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default RealtimeMonitor;
