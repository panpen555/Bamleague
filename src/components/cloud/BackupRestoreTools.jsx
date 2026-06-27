import React from "react";

function BackupRestoreTools({ exportAllData, importLeagueBackup }) {
  const handleExport = () => {
    if (typeof exportAllData !== "function") {
      alert("Export function ไม่ถูกส่งเข้ามา");
      return;
    }

    exportAllData();
  };

  return (
    <div
      style={{
        border: "1px solid #bfdbfe",
        borderRadius: "12px",
        padding: "14px",
        background: "#eff6ff",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#1d4ed8" }}>💾 Backup & Restore</h3>

      <p style={{ color: "#555", fontSize: "14px" }}>
        สำรองข้อมูลเป็นไฟล์ลงเครื่อง ใช้ก่อนแก้โค้ดใหญ่ ก่อนย้ายข้อมูล
        หรือก่อนลบข้อมูล
      </p>

      <button
        onClick={handleExport}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "8px",
          background: "#1d4ed8",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        💾 Export All Data
      </button>

      <label
        style={{
          display: "block",
          border: "1px dashed #93c5fd",
          borderRadius: "8px",
          padding: "10px",
          background: "#dbeafe",
          cursor: "pointer",
        }}
      >
        📥 Import Backup File
        <input
          type="file"
          accept=".json,application/json"
          onChange={importLeagueBackup}
          style={{ display: "block", marginTop: "8px", width: "100%" }}
        />
      </label>
    </div>
  );
}

export default BackupRestoreTools;
