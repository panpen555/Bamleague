import React from "react";

function AdminGettingStarted() {
  return (
    <div
      style={{
        border: "1px solid #bbf7d0",
        borderRadius: "14px",
        padding: "16px",
        background: "#f0fdf4",
        marginBottom: "16px",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#166534" }}>
        เริ่มต้นใช้งานสำหรับ Admin
      </h3>
      <ol style={{ margin: "0 0 10px", paddingLeft: "22px", color: "#334155" }}>
        <li>ล็อกอิน Admin</li>
        <li>เพิ่มหรือแก้ไขข้อมูลลีก</li>
        <li>ตรวจ Preview ให้เรียบร้อย</li>
        <li>Validate และกด Safe Publish</li>
        <li>เปิด Public Dashboard เพื่อตรวจผล</li>
      </ol>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
          ข้อมูลระบบที่ควรรู้
        </summary>
        <ul style={{ marginBottom: 0, color: "#475569" }}>
          <li>รูปภาพอัปโหลดผ่าน Cloudinary</li>
          <li>ข้อมูลการแข่งขันบน Cloud ใช้ Firestore Schema V3</li>
          <li>อย่ากด Clear หรือ Recovery หากยังไม่ทราบผลกระทบ</li>
        </ul>
      </details>
    </div>
  );
}

export default AdminGettingStarted;
