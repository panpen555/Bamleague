import React from "react";

function SeasonManagementTools({
  importSeasonHistory,
  closeCurrentSeason,
  startNewSeason,
}) {
  return (
    <div
      style={{
        border: "1px solid #fed7aa",
        borderRadius: "12px",
        padding: "14px",
        background: "#fff7ed",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#c2410c" }}>🏀 Season Management</h3>

      <p style={{ color: "#555", fontSize: "14px" }}>
        ใช้ปิดซีซั่น เก็บประวัติ และเริ่ม Season ใหม่ โดยไม่ลบรายชื่อผู้เล่น
      </p>

      <label
        style={{
          display: "block",
          border: "1px dashed #fdba74",
          borderRadius: "8px",
          padding: "10px",
          background: "#ffedd5",
          cursor: "pointer",
          marginBottom: "8px",
        }}
      >
        📥 Import Season History
        <input
          type="file"
          accept=".json,application/json"
          onChange={importSeasonHistory}
          style={{ display: "block", marginTop: "8px", width: "100%" }}
        />
      </label>

      <button
        type="button"
        onClick={closeCurrentSeason}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "8px",
          background: "#15803d",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🏁 Close Season
      </button>

      <button
        type="button"
        onClick={startNewSeason}
        style={{
          width: "100%",
          padding: "10px",
          background: "#f59e0b",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🟠 Start New Season
      </button>

      <p style={{ marginBottom: 0, color: "#9a3412", fontSize: "13px" }}>
        ล้าง Teams, Schedule, Draft, Match Roster และ Stats แต่เก็บ Players /
        Season History ไว้
      </p>
    </div>
  );
}

export default SeasonManagementTools;
