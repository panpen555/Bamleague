import React from "react";

function AdvancedSystemToolsSection({ children }) {
  return (
    <details
      style={{
        marginTop: "18px",
        border: "1px solid #fecaca",
        borderRadius: "12px",
        padding: "12px",
        background: "#fff7f7",
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#991b1b" }}>
        แสดงเครื่องมือขั้นสูงและกู้คืนระบบ
      </summary>
      <p style={{ color: "#7f1d1d", fontSize: "13px" }}>
        สำหรับผู้พัฒนาหรือกรณีฉุกเฉิน อาจเขียนทับหรือลบข้อมูล Cloud/Local
        ต้อง Export All Data และตรวจผลหลังใช้งานทุกครั้ง
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "14px",
          alignItems: "stretch",
        }}
      >
        {children}
      </div>
    </details>
  );
}

export default AdvancedSystemToolsSection;
