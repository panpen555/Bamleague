import React from "react";

function PlayerImportExport({ downloadTemplate, importCSV, exportCSV }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "12px",
        marginBottom: "16px",
        background: "#fafafa",
      }}
    >
      <h3 style={{ marginTop: 0 }}>📥 Import / Export Players</h3>

      <button type="button" onClick={downloadTemplate}>
        Download CSV Template
      </button>

      <button type="button" onClick={exportCSV} style={{ marginLeft: "8px" }}>
        Export Players CSV
      </button>

      <label style={{ display: "block", marginTop: "10px" }}>
        Import CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={importCSV}
          style={{ display: "block", marginTop: "6px" }}
        />
      </label>
    </div>
  );
}

export default PlayerImportExport;
