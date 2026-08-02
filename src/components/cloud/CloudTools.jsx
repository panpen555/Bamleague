import React from "react";

function CloudTools({
  cloudStatus,
  uploadToCloud,
  downloadFromCloud,
  adminUser,
  authLoading,
}) {
  const canWriteCloud = Boolean(adminUser) && !authLoading;

  return (
    <div
      style={{
        border: "1px solid #bfdbfe",
        borderRadius: "12px",
        padding: "14px",
        background: "#eff6ff",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#1d4ed8" }}>Cloud สำหรับงานประจำ</h3>
      <div
        style={{
          display: "inline-block",
          padding: "4px 9px",
          marginBottom: "10px",
          borderRadius: "999px",
          background: "#dcfce7",
          color: "#166534",
          fontSize: "12px",
          fontWeight: "bold",
        }}
      >
        ใช้งานทั่วไป
      </div>
      <p style={{ color: "#475569", fontSize: "13px" }}>
        Status: <strong>{cloudStatus}</strong>
      </p>

      <button
        type="button"
        onClick={uploadToCloud}
        disabled={!canWriteCloud}
        style={{
          width: "100%",
          minHeight: "44px",
          background: canWriteCloud ? "#2563eb" : "#94a3b8",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: canWriteCloud ? "pointer" : "not-allowed",
        }}
      >
        Upload To Cloud
      </button>
      <p style={{ color: "#92400e", fontSize: "13px", marginTop: "6px" }}>
        เขียนทับข้อมูล Cloud ด้วยข้อมูลเครื่องนี้ ระบบจะดาวน์โหลด recovery ของ Cloud เดิมก่อน
        หลังใช้ให้ตรวจ Public Dashboard
      </p>

      <button
        type="button"
        onClick={downloadFromCloud}
        style={{
          width: "100%",
          minHeight: "44px",
          background: "#0f766e",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Download Cloud Data
      </button>
      <p style={{ color: "#92400e", fontSize: "13px", marginBottom: 0 }}>
        นำข้อมูลล่าสุดจาก Cloud มาเขียนทับเครื่องนี้ ระบบจะดาวน์โหลด local recovery ก่อน
        หลังใช้ให้ตรวจ Players, Schedule และ Replay
      </p>
    </div>
  );
}

export default CloudTools;
