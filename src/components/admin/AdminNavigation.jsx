import React from "react";

function AdminNavigation({ tabs, activeKey, activeTab, onChange }) {
  const tabBarStyle = {
    position: "sticky",
    top: 0,
    zIndex: 1000,
    background: "rgba(255,255,255,0.97)",
    backdropFilter: "blur(10px)",
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "10px",
    margin: "0 0 18px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "8px",
    boxShadow: "0 10px 28px rgba(15,23,42,0.10)",
  };

  const tabButtonStyle = (key) => ({
    border: `1px solid ${activeKey === key ? "#111827" : "#e5e7eb"}`,
    borderRadius: "14px",
    padding: "11px 12px",
    background: activeKey === key ? "#111827" : "#f9fafb",
    color: activeKey === key ? "white" : "#111827",
    fontWeight: "bold",
    cursor: "pointer",
    whiteSpace: "nowrap",
    textAlign: "left",
    boxShadow:
      activeKey === key ? "0 8px 18px rgba(17,24,39,0.22)" : "none",
  });

  const sectionIntroStyle = {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "16px",
    marginBottom: "14px",
    background: "white",
    boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
  };

  return (
    <>
      <div style={tabBarStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={tabButtonStyle(tab.key)}
            title={tab.description}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={sectionIntroStyle}>
        <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "bold" }}>
          Current Module
        </div>
        <h2 style={{ margin: "4px 0" }}>{activeTab.label}</h2>
        <p style={{ margin: 0, color: "#475569" }}>{activeTab.description}</p>
      </div>
    </>
  );
}

export default AdminNavigation;
