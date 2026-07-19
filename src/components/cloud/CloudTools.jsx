import React from "react";

function CloudTools({
  cloudStatus,
  uploadToCloud,
  downloadFromCloud,
  clearCloudData,
  adminUser,
  authLoading,
}) {
  const canWriteCloud = Boolean(adminUser) && !authLoading;
  const writeDisabledStyle = {
    opacity: canWriteCloud ? 1 : 0.55,
    cursor: canWriteCloud ? "pointer" : "not-allowed",
  };

  return (
    <div
      style={{
        border: "1px solid #99f6e4",
        borderRadius: "12px",
        padding: "14px",
        background: "#f0fdfa",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#0f766e" }}>Cloud Storage</h3>

      <p style={{ color: "#555", fontSize: "14px" }}>
        Manual Cloud Mode: Download is public. Upload, Safe Publish, and Clear
        Cloud require Google sign-in. Firestore Rules will enforce real security
        in Phase 2.
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
        Status: {cloudStatus}
      </div>

      {!canWriteCloud ? (
        <p style={{ color: "#7c2d12", fontSize: "13px", marginTop: 0 }}>
          Sign in with Google to enable Upload To Cloud and Clear Cloud Data.
        </p>
      ) : null}

      <button
        onClick={uploadToCloud}
        disabled={!canWriteCloud}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "8px",
          background: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          ...writeDisabledStyle,
        }}
      >
        Upload To Cloud
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
        Download From Cloud
      </button>

      <button
        onClick={clearCloudData}
        disabled={!canWriteCloud}
        style={{
          width: "100%",
          padding: "10px",
          background: "#b91c1c",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          ...writeDisabledStyle,
        }}
      >
        Clear Cloud Data
      </button>
    </div>
  );
}

export default CloudTools;
