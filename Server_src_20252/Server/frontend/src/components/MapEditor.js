import React, { useMemo, useState } from "react";
import axios from "axios";
import "../assets/css/MapEditor.css";
import { Router, Box } from "lucide-react";

const MAX_SIZE = 20;

function clampSize(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 1;
  return Math.min(Math.max(n, 1), MAX_SIZE);
}

function MapEditor({ mapToEdit, systemMode, onSaved, onCancel }) {
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const [blocked, setBlocked] = useState(() => new Set());
  const [routerLocations, setRouterLocations] = useState(() => new Set());
  const [gridKey, setGridKey] = useState(0);
  const [areaOfOneUnit, setAreaOfOneUnit] = useState(1);
  const [mode, setMode] = useState("block");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [dragAction, setDragAction] = useState(null);

  React.useEffect(() => {
    if (mapToEdit) {
      setAreaOfOneUnit(mapToEdit.area_of_one_unit ?? 1);

      if (mapToEdit.rows && mapToEdit.cols) {
        setRows(mapToEdit.rows);
        setCols(mapToEdit.cols);
      }

      if (mapToEdit.blocked_cells && Array.isArray(mapToEdit.blocked_cells)) {
        setBlocked(new Set(mapToEdit.blocked_cells));
      } else {
        setBlocked(new Set());
      }

      if (
        mapToEdit.router_location &&
        Array.isArray(mapToEdit.router_location)
      ) {
        setRouterLocations(new Set(mapToEdit.router_location));
      } else {
        setRouterLocations(new Set());
      }

      setMessage("");
      setError("");
    }
  }, [mapToEdit]);

  const totalCells = useMemo(() => rows * cols, [rows, cols]);

  const walkableCellIds = useMemo(() => {
    const ids = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const key = `${c}:${r}`;
        if (!blocked.has(key)) {
          ids.push(r * cols + c + 1);
        }
      }
    }
    return ids;
  }, [rows, cols, blocked]);

  const handleMouseDown = (r, c) => {
    const key = `${c}:${r}`;

    if (mode === "block") {
      // Chế độ vẽ tường: Khởi tạo việc kéo thả
      const isCurrentlyBlocked = blocked.has(key);
      setDragAction(isCurrentlyBlocked ? "unblock" : "block");
      setDragStart({ r, c });
      setDragEnd({ r, c });
    } else if (mode === "router") {
      // Chế độ Router: Click 1 phát là đặt/xóa luôn, không cần kéo
      setRouterLocations((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  };

  const handleMouseEnter = (r, c) => {
    // Chỉ cập nhật tọa độ kéo thả nếu đang ấn giữ chuột (dragStart có dữ liệu)
    // và đang ở chế độ vẽ tường (block)
    if (mode === "block" && dragStart) {
      setDragEnd({ r, c });
    }
  };

  const applySelection = () => {
    // Nếu đang ở chế độ Router thì bỏ qua hàm kéo thả này
    if (mode !== "block" || !dragStart || !dragEnd) return;

    const minR = Math.min(dragStart.r, dragEnd.r);
    const maxR = Math.max(dragStart.r, dragEnd.r);
    const minC = Math.min(dragStart.c, dragEnd.c);
    const maxC = Math.max(dragStart.c, dragEnd.c);

    setBlocked((prev) => {
      const next = new Set(prev);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const key = `${c}:${r}`;
          if (dragAction === "block") next.add(key);
          else next.delete(key);
        }
      }
      return next;
    });

    setDragStart(null);
    setDragEnd(null);
    setDragAction(null);
  };

  const resetBlocks = () => {
    setBlocked(new Set());
  };

  const resetRouters = () => {
    setRouterLocations(new Set());
  };

  const applySize = (event) => {
    event.preventDefault();
    const newRows = clampSize(rows);
    const newCols = clampSize(cols);
    setRows(newRows);
    setCols(newCols);
    resetBlocks();
    setGridKey((k) => k + 1);
    setMessage("");
    setError("");
  };

  const saveMap = async () => {
    setMessage("");
    setError("");

    try {
      const payload = {
        total_units: totalCells,
        area_of_one_unit: Number(areaOfOneUnit),
        walkable_area: Number(walkableCellIds.length),
        router_number: routerLocations.size,
        router_location: Array.from(routerLocations),
        cols: cols,
        rows: rows,
        blocked_cells: Array.from(blocked),
      };

      const endpoint = systemMode === "fingerprint" ? "/maps" : "/uwb_maps";

      if (mapToEdit?.map_info_id) {
        const res = await axios.put(
          `${endpoint}/${mapToEdit.map_info_id}`,
          payload,
        );
        setMessage("Map updated successfully");
        onSaved?.(res.data);
      } else {
        const res = await axios.post(endpoint, payload);
        setMessage("Map created successfully");
        onSaved?.(res.data);
      }
    } catch (err) {
      const apiMsg =
        err.response?.data?.detail || err.response?.data || err.message;
      setError(apiMsg || "Failed to save map");
      console.error("Save map error", err);
    }
  };

  const xLabels = Array.from({ length: cols }, (_, i) => (0.5 + i).toFixed(1));
  const yLabels = Array.from({ length: rows }, (_, i) => (0.5 + i).toFixed(1));

  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const key = `${c}:${r}`;
      const actuallyBlocked = blocked.has(key);
      const coordX = c.toFixed(1);
      const coordY = r.toFixed(1);

      // Kiểm tra xem ô này có nằm trong vùng đang quét chuột không
      let inSelection = false;
      if (dragStart && dragEnd) {
        inSelection =
          r >= Math.min(dragStart.r, dragEnd.r) &&
          r <= Math.max(dragStart.r, dragEnd.r) &&
          c >= Math.min(dragStart.c, dragEnd.c) &&
          c <= Math.max(dragStart.c, dragEnd.c);
      }

      // Nếu đang quét qua, hiển thị trước kết quả (preview). Nếu không thì lấy trạng thái thật.
      const isBlocked = inSelection ? dragAction === "block" : actuallyBlocked;
      const hasRouter = routerLocations.has(key);

      cells.push(
        <button
          key={key}
          type="button"
          // Class CSS: Nếu có router thì thêm viền xanh, nếu đang preview vẽ tường thì mờ đi
          className={`map-cell ${isBlocked ? "blocked" : ""} ${hasRouter ? "router-cell" : ""} ${inSelection && mode === "block" ? "preview" : ""}`}
          onMouseDown={() => handleMouseDown(r, c)}
          onMouseEnter={() => handleMouseEnter(r, c)}
          onDragStart={(e) => e.preventDefault()}
          aria-label={`Cell ${coordX}, ${coordY}`}
          title={
            hasRouter
              ? `Router (${coordX}, ${coordY})`
              : isBlocked
                ? `Blocked (${coordX}, ${coordY})`
                : `Free (${coordX}, ${coordY})`
          }
          data-coord={`${coordX}, ${coordY}`}
        >
          {hasRouter && (
            <span style={{ fontSize: "18px", pointerEvents: "none" }}>📡</span>
          )}
        </button>,
      );
    }
  }

  return (
    <div className="map-editor-apple">
      {/* CỘT TRÁI: THANH CÔNG CỤ (SIDEBAR) */}
      <div className="map-sidebar">
        <h2 className="map-title">Map Editor</h2>
        <div className="sidebar-section">
          <label className="apple-label">
            Rows
            <input
              className="apple-input"
              type="number"
              min={1}
              max={MAX_SIZE}
              value={rows}
              onChange={(e) => setRows(clampSize(e.target.value))}
            />
          </label>
          <label className="apple-label">
            Columns
            <input
              className="apple-input"
              type="number"
              min={1}
              max={MAX_SIZE}
              value={cols}
              onChange={(e) => setCols(clampSize(e.target.value))}
            />
          </label>
          <label className="apple-label" style={{ gridColumn: "1 / -1" }}>
            Area of one unit (m²)
            <input
              className="apple-input"
              type="number"
              min={0}
              step="0.1"
              value={areaOfOneUnit}
              onChange={(e) => setAreaOfOneUnit(e.target.value)}
            />
          </label>
        </div>
        <div className="sidebar-actions">
          <button
            className="btn-apple-secondary"
            type="button"
            onClick={resetBlocks}
            disabled={blocked.size === 0}
          >
            Clear blocks
          </button>
          {systemMode === "fingerprint" && (
            <button
              className="btn-apple-secondary"
              type="button"
              onClick={resetRouters}
              disabled={routerLocations.size === 0}
            >
              Clear routers
            </button>
          )}
        </div>
        <div className="sidebar-stats">
          <div className="stat-item">
            <span>Total:</span> <b>{totalCells}</b>
          </div>
          <div className="stat-item">
            <span>Blocked:</span> <b>{blocked.size}</b>
          </div>
          <div className="stat-item">
            <span>Walkable:</span> <b>{walkableCellIds.length}</b>
          </div>
        </div>
        <div className="sidebar-footer">
          <button
            className="btn-apple-primary"
            type="button"
            onClick={(e) => {
              applySize(e);
              saveMap();
            }}
          >
            {mapToEdit ? "Update map" : "Create map"}
          </button>
          <button
            className="btn-apple-danger"
            type="button"
            onClick={() => onCancel?.()}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* CỘT PHẢI: KHU VỰC VẼ BẢN ĐỒ (CANVAS) */}
      <div className="map-canvas">
        {/* Thanh trượt chọn chế độ kiểu iOS (Segmented Control) */}
        <div className="apple-segmented-control">
          <button
            type="button"
            className={mode === "block" ? "segment-btn active" : "segment-btn"}
            onClick={() => setMode("block")}
          >
            <Box size={20} />
          </button>
          {systemMode === "fingerprint" && (
            <button
              type="button"
              className={
                mode === "router" ? "segment-btn active" : "segment-btn"
              }
              onClick={() => setMode("router")}
            >
              <Router size={20} />
            </button>
          )}
        </div>

        {/* Khung Grid Bản đồ */}
        <div
          className="map-grid-section"
          key={gridKey}
          style={{ "--map-cols": cols, "--map-rows": rows }}
        >
          <div className="corner-empty"></div>
          <div className="x-labels">
            {xLabels.map((x) => (
              <div key={x} className="x-label">
                {x}
              </div>
            ))}
          </div>
          <div className="y-labels">
            {yLabels.map((y) => (
              <div key={y} className="y-label">
                {y}
              </div>
            ))}
          </div>
          <div
            className="map-grid"
            onMouseUp={applySelection}
            onMouseLeave={applySelection}
          >
            {cells}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapEditor;
