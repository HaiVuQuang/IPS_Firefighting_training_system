import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  ArrowLeft,
  Flame,
  FlameKindling,
  Plus,
  Trash2,
  CheckCircle2,
  SquarePen,
} from "lucide-react";
import "../assets/css/Scenarios.css";

const CELL_SIZE = 38;

function Scenarios({ mapData, systemMode, onBack }) {
  const [scenarios, setScenarios] = useState([]);
  const [activeScenarioId, setActiveScenarioId] = useState("new"); // ID bài tập
  const [fireMode, setFireMode] = useState("normal"); // "normal" hoặc "spreading"
  const [scenarioName, setScenarioName] = useState("");
  const [fires, setFires] = useState([]);
  const [editingFire, setEditingFire] = useState(null);

  const [message, setMessage] = useState("");

  const rows = mapData.rows || 10;
  const cols = mapData.cols || 10;
  const blocked = new Set(mapData.blocked_cells || []);
  const routers = new Set(mapData.router_location || []);

  // Flag chống gọi API 2 lần
  const hasFetched = useRef(false);

  const fetchScenarios = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8000/scenarios/${systemMode}/${mapData.map_info_id}`,
      );
      setScenarios(res.data);
    } catch (err) {
      console.error("Failed to fetch scenarios", err);
    }
  };

  // Hàm chọn Scenario
  const handleSelectScenario = (e) => {
    const val = e.target.value;
    setActiveScenarioId(val);
    setMessage("");

    if (val === "new") {
      setScenarioName("");
      setFires([]);
    } else {
      const found = scenarios.find((s) => s.scenario_id === Number(val));
      if (found) {
        setScenarioName(found.scenario_name);
        setFires(found.fires);
      }
    }
  };

  // Click vào ô trên bản đồ
  const handleCellClick = (r, c) => {
    const coordX = (c + 0.5).toFixed(1);
    const coordY = (rows - 1 - r + 0.5).toFixed(1);
    const key = `${coordX}:${coordY}`;

    if (blocked.has(key)) {
      alert("Cannot place fire on a blocked cell!");
      return;
    }

    const existingFireIndex = fires.findIndex(
      (f) => f.coord_x === Number(coordX) && f.coord_y === Number(coordY),
    );

    if (existingFireIndex >= 0) {
      setEditingFire({ ...fires[existingFireIndex], index: existingFireIndex });
    } else {
      // Nếu chưa có, bật popup tạo mới (Mặc định level 1, delay 5s)
      setEditingFire({
        index: -1,
        coord_x: Number(coordX),
        coord_y: Number(coordY),
        level: 1,
        delay_time: 5,
        is_spreading: fireMode === "spreading",
      });
    }
  };

  // Hàm lấy icon ngọn lửa theo level
  const getFireIcon = (level) => {
    return level === 1 ? "🪔" : level === 2 ? "🔥" : "🌋"; // Level 1: Đèn dầu, 2: Lửa, 3: Núi lửa
  };

  const handleSaveFire = () => {
    const newFires = [...fires];
    if (editingFire.index >= 0) {
      newFires[editingFire.index] = editingFire; // Cập nhật
    } else {
      newFires.push(editingFire); // Thêm mới
    }
    setFires(newFires);
    setEditingFire(null);
  };

  const handleDeleteFire = (index) => {
    const newFires = fires.filter((_, i) => i !== index);
    setFires(newFires);
  };

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) return alert("Please enter Scenario Name!");
    if (fires.length === 0)
      return alert("Please place at least one fire on the map!");

    try {
      // MẸO UPDATE: Nếu đang sửa kịch bản cũ, xóa cái cũ trước khi tạo cái mới
      if (activeScenarioId !== "new") {
        await axios.delete(
          `http://localhost:8000/scenarios/${activeScenarioId}`,
        );
      }

      const payload = {
        map_info_id: mapData.map_info_id,
        map_type: systemMode,
        scenario_name: scenarioName,
        fires: fires,
      };

      await axios.post("http://localhost:8000/scenarios", payload);

      setMessage(
        activeScenarioId === "new"
          ? "Scenario saved successfully!"
          : "Scenario updated successfully!",
      );
      fetchScenarios();
      setActiveScenarioId("new"); // Trả về form trống
      setScenarioName("");
      setFires([]);

      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert("Failed to save scenario");
      console.error(err);
    }
  };

  const handleDeleteScenario = async () => {
    if (!window.confirm("Are you sure you want to delete this scenario?"))
      return;
    try {
      await axios.delete(`http://localhost:8000/scenarios/${activeScenarioId}`);
      setMessage("Scenario deleted!");
      fetchScenarios();
      setActiveScenarioId("new");
      setScenarioName("");
      setFires([]);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert("Delete failed");
    }
  };

  // Render các ô vuông
  const gridCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const coordX = (c + 0.5).toFixed(1);
      const coordY = (rows - 1 - r + 0.5).toFixed(1);
      const key = `${coordX}:${coordY}`;

      const isBlocked = blocked.has(key);
      const hasRouter = routers.has(key);
      const hasFire = fires.find(
        (f) => f.coord_x === Number(coordX) && f.coord_y === Number(coordY),
      );

      gridCells.push(
        <button
          key={key}
          type="button"
          className={`map-cell ${isBlocked ? "blocked" : ""} ${hasRouter ? "router-cell" : ""}`}
          onClick={() => handleCellClick(r, c)}
          title={`Cell (${coordX}, ${coordY})`}
        >
          {hasRouter && <span className="router-icon">📡</span>}
          {hasFire && (
            <span
              className={`fire-icon fire-lv${hasFire.level} ${hasFire.is_spreading ? "fire-spreading" : ""}`}
            >
              {getFireIcon(hasFire.level)}
            </span>
          )}
        </button>,
      );
    }
  }

  // Lấy danh sách các kịch bản của Map này từ Server
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchScenarios();
  }, [mapData.map_info_id, systemMode]);

  return (
    <div className="scenarios-container">
      <div className="scenarios-header">
        <div className="scenarios-title-group">
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <h2 className="rm-title-text">
            Training Scenario: Map #{mapData.map_info_id}
          </h2>
        </div>

        {message && (
          <div className="success-msg" style={{ margin: 0 }}>
            <CheckCircle2 size={18} /> {message}
          </div>
        )}

        {/* Đưa selector-box lên đây */}
        <div className="scenario-selector-box">
          <select
            className="scenario-select"
            value={activeScenarioId}
            onChange={handleSelectScenario}
          >
            <option value="new">-- Create New Scenario --</option>
            {scenarios.map((sc) => (
              <option key={sc.scenario_id} value={sc.scenario_id}>
                {sc.scenario_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="map-editor">
        {/* CỘT TRÁI: SIDEBAR CẤU HÌNH */}
        <div className="map-sidebar">
          <h2 className="map-title" style={{ fontSize: "1.2rem" }}>
            Scenario Config
          </h2>

          <div className="segmented-control">
            <button
              className={`segment-btn fire-mode ${fireMode === "normal" ? "active" : ""}`}
              onClick={() => setFireMode("normal")}
            >
              Normal
              <br />
              Fire
            </button>
            <button
              className={`segment-btn spread-mode ${fireMode === "spreading" ? "active" : ""}`}
              onClick={() => setFireMode("spreading")}
            >
              Spreading
              <br />
              Fire
            </button>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label className="input-label">
              Scenario Name
              <input
                className="input-field"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g. D8-802"
              />
            </label>
          </div>

          <div className="inspector-panel" style={{ flex: 1 }}>
            <div className="beacon-list-title">
              Fire Points (Total: {fires.length})
            </div>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
              Click any blank cell to set fire.
            </p>

            <div className="beacon-list-container">
              {fires.map((f, i) => (
                <div key={i} className="fire-item">
                  <div className="fire-chip">🔥</div>
                  <div className="fire-info">
                    <div>
                      x : <strong>{f.coord_x}</strong> | y : {""}
                      <strong>{f.coord_y}</strong>
                    </div>
                    <div>
                      Level: <strong>{f.level}</strong> | Start:{" "}
                      <strong>{f.delay_time}s</strong>
                    </div>
                  </div>

                  {/* BỎ ĐIỀU KIỆN ẨN, LUÔN HIỆN NÚT EDIT VÀ DELETE */}
                  <div className="beacon-actions">
                    <button
                      className="btn-edit-small"
                      onClick={() => setEditingFire({ ...f, index: i })}
                      title="Edit Fire"
                    >
                      <SquarePen size={14} />
                    </button>
                    <button
                      className="btn-delete-small"
                      onClick={() => handleDeleteFire(i)}
                      title="Delete Fire"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-footer">
            <button className="btn-blue" onClick={handleSaveScenario}>
              Save
            </button>
            {activeScenarioId !== "new" && (
              <button
                className="btn-pink"
                onClick={handleDeleteScenario}
                title="Delete Scenario"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: LƯỚI BẢN ĐỒ */}
        <div className="map-canvas">
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
                  <span className="axis-text">
                    {(rows - 1 - i + 0.5).toFixed(1)}
                  </span>
                  <div className="axis-tick-y"></div>
                </div>
              ))}
            </div>

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
                      top: `${(rows - pos.y) * CELL_SIZE}px`,
                    }}
                  >
                    <div className="beacon-dot"></div>
                    <div className="beacon-number-label">{id}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* POPUP CẤU HÌNH THÔNG SỐ NGỌN LỬA */}
      {editingFire && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Fire Configuration
            </h3>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 15 }}>
              Coordinate: x={editingFire.coord_x}, y={editingFire.coord_y}
            </p>

            <div className="modal-form">
              <label className="input-label">
                Fire Level
                <select
                  className="input-field"
                  value={editingFire.level}
                  onChange={(e) =>
                    setEditingFire({
                      ...editingFire,
                      level: Number(e.target.value),
                    })
                  }
                >
                  <option value={1}>Level 1 (Small)</option>
                  <option value={2}>Level 2 (Medium)</option>
                  <option value={3}>Level 3 (Large)</option>
                </select>
              </label>

              <label className="input-label">
                Appearance Time (seconds)
                <input
                  type="number"
                  className="input-field"
                  min="0"
                  value={editingFire.delay_time}
                  onChange={(e) =>
                    setEditingFire({
                      ...editingFire,
                      delay_time: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className="btn-popup-actions">
              <button className="btn-confirm" onClick={handleSaveFire}>
                Confirm
              </button>
              <button
                className="btn-gray"
                onClick={() => setEditingFire(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Scenarios;
