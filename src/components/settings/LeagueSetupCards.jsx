import React from "react";

const LeagueSetupCards = ({
  competitionType,
  teamCount,
  teamCountOptions,
  seasonProjectName,
  defaultSeasonProjectName,
  currentSeasonTitle,
  currentSeason,
  onCompetitionTypeChange,
  onTeamCountChange,
  onSeasonProjectNameChange,
  onResetSeasonProjectName,
}) => {
  return (
    <>
      <div
        style={{
          border: "1px solid #bfdbfe",
          background: "white",
          borderRadius: "10px",
          padding: "14px",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#1d4ed8" }}>
          🏀 Competition Setup
        </h3>
        <p style={{ color: "#555", fontSize: "14px" }}>
          เลือกรูปแบบการแข่งขันและจำนวนทีมหลักของ Season นี้
        </p>

        <label style={{ display: "block", marginBottom: "10px" }}>
          ประเภทการแข่งขัน
          <select
            value={competitionType}
            onChange={(event) =>
              onCompetitionTypeChange(event.target.value)
            }
            style={{
              display: "block",
              width: "100%",
              marginTop: "6px",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          >
            <option value="5X5">5X5</option>
            <option value="3X3">3X3</option>
          </select>
        </label>

        <label style={{ display: "block" }}>
          จำนวนทีม
          <select
            value={teamCount}
            onChange={(event) => onTeamCountChange(event.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: "6px",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          >
            {teamCountOptions.map((count) => (
              <option key={count} value={count}>
                {count} Teams
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            marginTop: "12px",
            padding: "10px",
            borderRadius: "8px",
            background: "#eff6ff",
            color: "#1e40af",
            fontSize: "13px",
          }}
        >
          ⚠️ การเปลี่ยนประเภทหรือจำนวนทีม อาจล้าง Teams, Schedule, Draft และ
          Stats ปัจจุบัน แต่ไม่ลบรายชื่อ Players
        </div>
      </div>

      <div
        style={{
          border: "1px solid #fed7aa",
          background: "white",
          borderRadius: "10px",
          padding: "14px",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#c2410c" }}>📅 Season Setup</h3>
        <p style={{ color: "#555", fontSize: "14px" }}>
          ตั้งชื่อรายการสำหรับแสดงใน Dashboard และ Public View
        </p>

        <label style={{ display: "block" }}>
          ชื่อโครงการ / รายการแข่งขัน
          <input
            value={seasonProjectName}
            onChange={(event) =>
              onSeasonProjectNameChange(event.target.value)
            }
            placeholder={defaultSeasonProjectName}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              marginTop: "6px",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />
        </label>

        <button
          type="button"
          onClick={onResetSeasonProjectName}
          style={{
            marginTop: "10px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #fb923c",
            background: "#fff7ed",
            color: "#9a3412",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ใช้ชื่อเริ่มต้น
        </button>

        <div
          style={{
            marginTop: "12px",
            padding: "10px",
            borderRadius: "8px",
            background: "#fff7ed",
            color: "#9a3412",
            fontSize: "13px",
          }}
        >
          Current: {currentSeasonTitle} | Season {currentSeason}
        </div>
      </div>
    </>
  );
};

export default LeagueSetupCards;
