const MvpRankingPanel = ({
  activeAdminMenu,
  adminAccordionStyle,
  adminAccordionSummaryStyle,
  adminAccordionHintStyle,
  hasPlayerStats,
  mvpRanking,
  renderPlayerAvatar,
  getPlayerPhotoUrl,
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
        <span>📈 MVP Ranking</span>
        <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
      </summary>
      <div style={{ marginTop: "32px" }}>
        <h2>MVP Ranking</h2>
        <p>
          Formula: PTS + REB×1.2 + AST×1.5 + STL×2 + BLK×2 + Appearance Bonus
        </p>

        <table border="1" cellPadding="8" cellSpacing="0">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Photo</th>
              <th>Player</th>
              <th>Team</th>
              <th>MVP Score</th>
              <th>Games</th>
              <th>Appear</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>PPG</th>
            </tr>
          </thead>

          <tbody>
            {mvpRanking.map((stat, index) => (
              <tr key={`mvp-${stat.playerId}`}>
                <td>{index + 1}</td>
                <td>{renderPlayerAvatar(getPlayerPhotoUrl(stat.playerId), 38)}</td>
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
                <td>{Number(stat.mvpScore || 0).toFixed(1)}</td>
                <td>{stat.games}</td>
                <td>{stat.appearances || 0}</td>
                <td>{stat.pts || 0}</td>
                <td>{stat.reb || 0}</td>
                <td>{stat.ast || 0}</td>
                <td>{stat.stl || 0}</td>
                <td>{stat.blk || 0}</td>
                <td>{stat.ppg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};

export default MvpRankingPanel;
