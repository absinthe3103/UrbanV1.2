// App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import Visualizer from "./components/Visualizer";
import DataCollector from "./pages/DataCollector";

const NavLink = ({ to, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        padding: "8px 20px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.04em",
        color: isActive ? "#ffffff" : "#cbd5e1",
        background: isActive
          ? "linear-gradient(135deg, rgba(37,99,235,0.5), rgba(59,130,246,0.3))"
          : "transparent",
        border: isActive
          ? "1px solid rgba(96,165,250,0.5)"
          : "1px solid transparent",
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = "#ffffff";
          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = "#cbd5e1";
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {children}
    </Link>
  );
};

function App() {
  return (
    <Router>
      <div
        style={{
          fontFamily: "'Segoe UI', Tahoma, sans-serif",
          minHeight: "100vh",
          background: "#1a3a5c",
        }}
      >
        {/* ── Nav ── */}
        <nav
          style={{
            padding: "0 40px",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0d1f3c",
            borderBottom: "1px solid rgba(37,99,235,0.4)",
            position: "sticky",
            top: 0,
            zIndex: 200,
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                Urban Foundation Guardian
              </div>
            </div>
          </div>

          {/* Nav links */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <NavLink to="/">📊 Dashboard</NavLink>
            <NavLink to="/collect">📝 Data Entry</NavLink>
          </div>
        </nav>

        {/* ── Routes ── */}
        <Routes>
          <Route path="/" element={<Visualizer />} />
          <Route path="/collect" element={<DataCollector />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
