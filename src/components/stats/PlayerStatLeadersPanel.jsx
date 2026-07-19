const PlayerStatLeadersPanel = ({
  activeAdminMenu,
  adminAccordionStyle,
  adminAccordionSummaryStyle,
  adminAccordionHintStyle,
  hasPlayerStats,
  statLeaderBoards,
  clearPlayerStats,
  setSelectedProfilePlayerId,
  setActiveAdminMenu,
}) => {
  if (!hasPlayerStats) return null;

  return (
    <details
      open
      style={{
        ...adminAccordionStyle,
        display: activeAdminMenu === "stats" ? "block" : "none",
      }}
    >
      <summary style={adminAccordionSummaryStyle}>
        <span>📊 Player Stat Leaders</span>
        <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
      </summary>
      <div style={{ marginTop: "32px" }}>
        <h2>Player Stat Leaders</h2>
        <button onClick={clearPlayerStats} style={{ marginBottom: "12px" }}>
          Clear Player Stats
        </button>

        {statLeaderBoards.map((board) => (
          <div key={board.field} style={{ marginBottom: "24px" }}>
            <h3>{board.title}</h3>

            {board.leaders.length === 0 ? (
              <p>ยังไม่มีข้อมูล {board.label}</p>
            ) : (
              <table border="1" cellPadding="8" cellSpacing="0">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Team</th>
                    <th>Games</th>
                    <th>Appear</th>
                    <th>{board.label}</th>
                    {board.field === "pts" && <th>PPG</th>}
                  </tr>
                </thead>
                <tbody>
                  {board.leaders.map((stat, index) => (
                    <tr key={`${board.field}-${stat.playerId}`}>
                      <td>{index + 1}</td>
                      <td>
                        <button
                          onClick={() => {
                            setSelectedProfilePlayerId(String(stat.playerId));
                            setActiveAdminMenu("stats");
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          {stat.playerName}
                        </button>
                      </td>
                      <td>{stat.teamName || "-"}</td>
                      <td>{stat.games}</td>
                      <td>{stat.appearances || 0}</td>
                      <td>{stat[board.field] || 0}</td>
                      {board.field === "pts" && <td>{stat.ppg}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </details>
  );
};

export default PlayerStatLeadersPanel;
