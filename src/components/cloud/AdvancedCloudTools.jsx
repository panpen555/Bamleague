import React from "react";

function AdvancedCloudTools({ clearCloudData, adminUser, authLoading }) {
  const canClear = Boolean(adminUser) && !authLoading;
  return (
    <div
      style={{
        border: "1px solid #fecaca",
        borderRadius: "12px",
        padding: "14px",
        background: "#fef2f2",
      }}
    >
      <div style={{ color: "#991b1b", fontWeight: "bold", marginBottom: "8px" }}>
        อันตราย / กู้คืนระบบ
      </div>
      <button
        type="button"
        onClick={clearCloudData}
        disabled={!canClear}
        style={{
          width: "100%",
          minHeight: "44px",
          border: "none",
          borderRadius: "8px",
          background: canClear ? "#b91c1c" : "#94a3b8",
          color: "white",
          fontWeight: "bold",
          cursor: canClear ? "pointer" : "not-allowed",
        }}
      >
        Clear Cloud Data
      </button>
      <p style={{ color: "#7f1d1d", fontSize: "13px", marginBottom: 0 }}>
        ลบ Main, Seasons และข้อมูล Replay/Recovery บน Cloud ใช้เฉพาะเมื่อต้องการเริ่มระบบใหม่
        หลังใช้ต้องตรวจว่า Public Dashboard ไม่มีข้อมูลค้าง
      </p>
    </div>
  );
}

export default AdvancedCloudTools;
