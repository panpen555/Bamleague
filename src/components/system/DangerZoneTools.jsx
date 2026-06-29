import React from "react";

function DangerZoneTools({ resetAllSystem }) {
  return (
    <div
      style={{
        border: "1px solid #fecaca",
        borderRadius: "12px",
        padding: "14px",
        background: "#fef2f2",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#b91c1c" }}>⚠️ Danger Zone</h3>

      <p style={{ color: "#7f1d1d", fontSize: "14px" }}>
        ใช้เมื่อต้องการล้างข้อมูลทั้งหมดในเครื่องเพื่อเริ่มระบบใหม่ ควร Export
        Backup ก่อนทุกครั้ง
      </p>

      <button
        type="button"
        onClick={resetAllSystem}
        style={{
          width: "100%",
          padding: "12px",
          background: "#7f1d1d",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🔴 Delete All League Data
      </button>

      <p style={{ color: "#991b1b", fontSize: "13px", marginBottom: 0 }}>
        ลบ Players, Teams, Schedule, Stats, Season History และ LocalStorage
        แต่ไม่ลบ Source Code
      </p>
    </div>
  );
}

export default DangerZoneTools;
