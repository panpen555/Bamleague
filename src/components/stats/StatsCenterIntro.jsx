import React from "react";

const StatsCenterIntro = ({ adminAccordionStyle, hasPlayerStats }) => {
  return (
    <div
      style={{
        ...adminAccordionStyle,
        padding: "16px",
        background: "#f8fafc",
      }}
    >
      <h2 style={{ marginTop: 0 }}>📊 Stats Center</h2>
      <p style={{ color: "#555", marginBottom: 0 }}>
        สรุปสถิติผู้เล่น MVP Ranking, Player Profile และ Stat Leaders
        อยู่ในแท็บนี้ ส่วนการกรอกคะแนน/Match Roster ยังอยู่ใน 📅 Schedule
      </p>
      {!hasPlayerStats && (
        <p style={{ marginBottom: 0 }}>
          ยังไม่มีสถิติผู้เล่น ให้ไปที่ 📅 Schedule แล้วกด Enter Stats
          ของแมตช์ก่อน
        </p>
      )}
    </div>
  );
};

export default StatsCenterIntro;
