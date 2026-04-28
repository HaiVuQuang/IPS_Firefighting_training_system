import React, { useState } from "react";
import LoginModal from "./LoginModal";
import "../assets/css/LandingPage.css";
import uwbIcon from "../assets/picture/uwb-icon.png";
import rssiIcon from "../assets/picture/rssi-icon.png";

function LandingPage({ isLoggedIn, onLoginSuccess, onSelectMode }) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalMode, setLoginModalMode] = useState("login");

  const openLoginModal = (mode) => {
    setIsLoginModalOpen(true);
    setLoginModalMode(mode);
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
      {isLoggedIn && (
        <div className="landing-selection-cards">
          <div
            className="mode-card small-card"
            onClick={() => onSelectMode("fingerprint")}
          >
            <div className="mode-icon-box">
              <img src={rssiIcon} alt="icon" />
            </div>
            <div className="mode-title-small">
              RSSI
              <br />
              Fingerprinting
            </div>
          </div>

          <div
            className="mode-card small-card"
            onClick={() => onSelectMode("uwb")}
          >
            <div className="mode-icon-box">
              <img src={uwbIcon} alt="icon" />
            </div>
            <div className="mode-title-small">
              UWB
              <br />
              Trilateration
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
