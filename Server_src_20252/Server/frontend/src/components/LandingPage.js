import React, { useState, useEffect } from "react";
import LoginModal from "./LoginModal";
import "../assets/css/LandingPage.css";
import uwbIcon from "../assets/picture/uwb-icon.png";
import rssiIcon from "../assets/picture/rssi-icon.png";
import {
  Settings,
  X,
  Edit3,
  Smartphone,
  Tag,
  FingerprintPattern,
  SatelliteDish,
} from "lucide-react";
import axios from "axios";

function LandingPage({ isLoggedIn, onLoginSuccess, onSelectMode }) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalMode, setLoginModalMode] = useState("login");

  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [rssiDevices, setRssiDevices] = useState([]);
  const [uwbDevices, setUwbDevices] = useState([]);
  const [editingDevice, setEditingDevice] = useState(null);
  const [newDeviceName, setNewDeviceName] = useState("");

  const openLoginModal = (mode) => {
    setIsLoginModalOpen(true);
    setLoginModalMode(mode);
  };

  // Hook lắng nghe thiết bị mới qua WebSocket
  useEffect(() => {
    let ws;
    if (showDeviceManager) {
      fetchDevices();

      // Mở kết nối WebSocket lắng nghe Server
      ws = new WebSocket("ws://localhost:8000/ws/devices");

      ws.onopen = () => {
        console.log("WebSocket connected for Device Management");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_device") {
            fetchDevices();
          }
        } catch (err) {
          console.error("ERROR parse WS data:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    }

    // Tự động ngắt kết nối khi tắt cửa sổ Popup
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [showDeviceManager]);

  const openDeviceManager = async () => {
    setShowDeviceManager(true);
  };

  const fetchDevices = async () => {
    try {
      const resRssi = await axios.get("http://localhost:8000/devices/rssi");
      const resUwb = await axios.get("http://localhost:8000/devices/uwb");
      setRssiDevices(resRssi.data);
      setUwbDevices(resUwb.data);
    } catch (e) {
      console.error("Failed to fetch devices", e);
    }
  };

  const handleRenameDevice = async () => {
    if (!newDeviceName.trim()) return;
    try {
      await axios.put(
        `http://localhost:8000/devices/${editingDevice.type}/${editingDevice.device_id}`,
        {
          device_name: newDeviceName,
        },
      );
      setEditingDevice(null);
      fetchDevices(); // Tải lại danh sách sau khi đổi tên
    } catch (e) {
      alert("Failed to rename device");
    }
  };

  const handleDeleteDevice = async (e, deviceId, type) => {
    e.stopPropagation();

    try {
      await axios.delete(`http://localhost:8000/devices/${type}/${deviceId}`);
      fetchDevices();
    } catch (e) {
      alert("Failed to delete device");
      console.error(e);
    }
  };

  return (
    <div className="landing">
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        initialMode={loginModalMode}
        onLoginSuccess={onLoginSuccess}
      />

      <nav className="landing-nav">
        <div className="nav-brand">iPAC Lab</div>
        <div className="nav-actions">
          {!isLoggedIn ? (
            // prettier-ignore
            <>
              <button className="btn-login-nav" onClick={() => openLoginModal("login")}>Log in</button>
              <button className="btn-signup-nav" onClick={() => openLoginModal("register")}>Sign Up</button>
            </>
          ) : (
            <div className="welcome-text">Welcome to Workspace</div>
          )}
        </div>
      </nav>

      <main className="hero-content">
        <div className="hero-text-area">
          <div className="hero-subtitle">For personal project development</div>
          <h1 className="hero-title">
            Indoor
            <br />
            Positioning
            <br />
            System.
          </h1>
          <p className="hero-desc">
            Experience the most advanced indoor positioning technology powered
            by UWB trilateration and RSSI fingerprinting.
          </p>
        </div>
      </main>

      {/* Các khối màu mờ ảo bên phải (Blobs) */}
      <div className="hero-visuals">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="blob blob-4"></div>
      </div>

      {/* HIỆN 2 THẺ KHI ĐÃ ĐĂNG NHẬP THÀNH CÔNG */}
      {isLoggedIn &&
        // prettier-ignore
        <div className="landing-selection-cards">
          {/* Widget RSSI Fingerprinting */}
          <div className="mode-card small-card" onClick={() => onSelectMode("fingerprint")}>
            <div className="mode-icon-box">
              <FingerprintPattern size={34} color="#475569" />
            </div>
            <div className="mode-title-small">RSSI<br />Fingerprinting</div>
          </div>

          {/* Widget UWB Trilateration và Manage Devices */}
          <div className="mode-cards-row">
            {/* Widget UWB */}
            <div className="mode-card small-card" onClick={() => onSelectMode("uwb")}>
              <div className="mode-icon-box">
                {/* <img src={uwbIcon} alt="icon" /> */}
                <SatelliteDish size={34} color="#475569" />
              </div>
              <div className="mode-title-small">UWB<br />Trilateration</div>
            </div>

            {/* Widget Manage Devices */}
            <div className="mode-card small-card" onClick={openDeviceManager}>
              <div className="mode-icon-box" style={{ background: "transparent", border: "none" }}>
                <Settings size={34} color="#475569" />
              </div>
              <div className="mode-title-small">Manage<br />Devices</div>
            </div>
          </div>
        </div>}

      {/* POPUP FULLSCREEN: DEVICE MANAGER */}
      {showDeviceManager && (
        <div className="dm-overlay">
          <div className="dm-modal">
            <button
              className="dm-close-btn"
              onClick={() => setShowDeviceManager(false)}
            >
              <X size={24} />
            </button>
            <h2 className="dm-title">Device Management</h2>

            <div className="dm-sections">
              {/* CỘT RSSI */}
              <div className="dm-column">
                <h3 className="dm-subtitle">RSSI Tags</h3>
                <div className="dm-grid">
                  {rssiDevices.map((dev) => (
                    <div
                      className="dm-device-card"
                      key={`rssi-${dev.device_id}`}
                      onClick={() => {
                        setEditingDevice({ ...dev, type: "rssi" });
                        setNewDeviceName(dev.device_name);
                      }}
                    >
                      <button
                        className="dm-btn-delete"
                        onClick={(e) =>
                          handleDeleteDevice(e, dev.device_id, "rssi")
                        }
                        title="Delete Device"
                      >
                        <X size={16} />
                      </button>
                      <div className="dm-device-icon">
                        <Smartphone size={32} color="#3b82f6" />
                      </div>
                      <div className="dm-device-info">
                        <h4>{dev.device_name}</h4>
                        <p>HEX: {dev.device_hex_id}</p>
                      </div>
                    </div>
                  ))}
                  {rssiDevices.length === 0 && (
                    <p className="dm-empty">No RSSI tags found</p>
                  )}
                </div>
              </div>

              {/* CỘT UWB */}
              <div className="dm-column">
                <h3 className="dm-subtitle">UWB Tags</h3>
                <div className="dm-grid">
                  {uwbDevices.map((dev) => (
                    <div
                      className="dm-device-card"
                      key={`uwb-${dev.device_id}`}
                      onClick={() => {
                        setEditingDevice({ ...dev, type: "uwb" });
                        setNewDeviceName(dev.device_name);
                      }}
                    >
                      <button
                        className="dm-btn-delete"
                        onClick={(e) =>
                          handleDeleteDevice(e, dev.device_id, "uwb")
                        }
                        title="Delete Device"
                      >
                        <X size={16} />
                      </button>

                      <div className="dm-device-icon">
                        <Tag size={32} color="#10b981" />
                      </div>
                      <div className="dm-device-info">
                        <h4>{dev.device_name}</h4>
                        <p>HEX: {dev.device_hex_id}</p>
                      </div>
                    </div>
                  ))}
                  {uwbDevices.length === 0 && (
                    <p className="dm-empty">No UWB tags found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP NHỎ: ĐỔI TÊN THIẾT BỊ */}
      {editingDevice && (
        <div className="dm-rename-overlay">
          <div className="dm-rename-modal">
            <h3>
              <Edit3
                size={20}
                style={{ marginRight: "8px", verticalAlign: "middle" }}
              />{" "}
              Rename Device
            </h3>
            <p>
              HEX ID: <strong>{editingDevice.device_hex_id}</strong>
            </p>
            <input
              className="dm-input"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              placeholder="Enter new device name"
            />
            <div className="dm-rename-actions">
              <button className="dm-btn-save" onClick={handleRenameDevice}>
                Save
              </button>
              <button
                className="dm-btn-cancel"
                onClick={() => setEditingDevice(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="landing-nav">
        <div></div>
        <div className="powered">Powered by Sondeptrai</div>
      </div>
    </div>
  );
}

export default LandingPage;
