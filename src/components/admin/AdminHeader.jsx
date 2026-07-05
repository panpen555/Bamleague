import React from "react";

function AdminHeader({
  seasonTitle,
  competitionType,
  currentSeason,
  cloudStatus,
  databaseVersion,
  publishValidated,
  onOpenPublic,
  teamsCount,
  teamCount,
  playersCount,
  availablePlayersCount,
  finishedMatchesCount,
  scheduleCount,
  draftsCount,
}) {
  const heroStyle = {
    border: "1px solid #e5e7eb",
    borderRadius: "22px",
    padding: "22px",
    marginBottom: "18px",
    background:
      "linear-gradient(135deg, #111827 0%, #1f2937 55%, #0f172a 100%)",
    color: "white",
    boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
  };

  const heroTopStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    flexWrap: "wrap",
  };

  const statusPillStyle = {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "white",
    display: "inline-block",
    fontWeight: "bold",
    fontSize: "13px",
  };

  const heroActionStyle = {
    background: "white",
    color: "#111827",
    border: "none",
    borderRadius: "10px",
    padding: "11px 14px",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
  };

  const kpiGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
    marginTop: "18px",
  };

  const kpiCardStyle = {
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
  };

  const kpis = [
    {
      label: "Teams",
      value: teamsCount,
      detail: `${teamCount} team setting`,
    },
    {
      label: "Players",
      value: playersCount,
      detail: `${availablePlayersCount} available`,
    },
    {
      label: "Matches",
      value: `${finishedMatchesCount}/${scheduleCount}`,
      detail: "Finished / Total",
    },
    {
      label: "Drafts",
      value: draftsCount,
      detail: "Saved versions",
    },
  ];

  return (
    <div style={heroStyle}>
      <div style={heroTopStyle}>
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#cbd5e1",
              marginBottom: "8px",
            }}
          >
            Admin Portal
          </div>
          <h1 style={{ margin: 0, fontSize: "34px" }}>
            🏀 BAM League Manager
          </h1>
          <p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>
            {seasonTitle} · {competitionType} Season {currentSeason}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={statusPillStyle}>☁️ Cloud: {cloudStatus}</div>
          <br />
          <div style={{ ...statusPillStyle, marginTop: "8px" }}>
            🧠 DB: {databaseVersion}
          </div>
          <br />
          <div style={{ ...statusPillStyle, marginTop: "8px" }}>
            🛡️ Publish: {publishValidated ? "Validated" : "Draft"}
          </div>
          <br />
          <button
            type="button"
            onClick={onOpenPublic}
            style={{ ...heroActionStyle, marginTop: "12px" }}
          >
            👀 Open League Portal
          </button>
        </div>
      </div>

      <div style={kpiGridStyle}>
        {kpis.map((item) => (
          <div key={item.label} style={kpiCardStyle}>
            <div style={{ color: "#cbd5e1", fontSize: "13px" }}>
              {item.label}
            </div>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
              {item.value}
            </div>
            <div style={{ color: "#cbd5e1", fontSize: "12px" }}>
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminHeader;
