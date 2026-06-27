import React from "react";

function CloudTools({
  cloudStatus,
  uploadToCloud,
  downloadFromCloud,
  clearCloudData,
}) {
  return (
    <div
      style={{
        border: "1px solid #99f6e4",
        borderRadius: "12px",
        padding: "14px",
        background: "#f0fdfa",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#0f766e" }}>☁️ Cloud Storage</h3>

      <p style={{ color: "#555", fontSize: "14px" }}>
        Manual Cloud Mode: ต้องกด Upload เองเท่านั้น เพื่อป้องกันการเขียนทับ
        Cloud โดยไม่ตั้งใจ
      </p>

      <div
        style={{
          display: "inline-block",
          padding: "6px 10px",
          marginBottom: "10px",
          borderRadius: "999px",
          background: "#0f172a",
          color: "white",
          fontSize: "13px",
          fontWeight: "bold",
        }}
      >
        ☁️ Status: {cloudStatus}
      </div>

      <button
        onClick={uploadToCloud}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "8px",
          background: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        ☁️ Upload To Cloud
      </button>

      <button
        onClick={downloadFromCloud}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "8px",
          background: "#0f766e",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        ☁️ Download From Cloud
      </button>

      <button
        onClick={clearCloudData}
        style={{
          width: "100%",
          padding: "10px",
          background: "#b91c1c",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        🗑️ Clear Cloud Data
      </button>
    </div>
  );
}

export default CloudTools;
