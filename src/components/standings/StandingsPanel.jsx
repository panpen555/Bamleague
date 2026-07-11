const StandingsPanel = ({
  activeAdminMenu,
  adminAccordionStyle,
  adminAccordionSummaryStyle,
  adminAccordionHintStyle,
  standings,
  renderTeamLogo,
}) => {
  if (standings.length === 0) return null;

  return (
    <details
      open
      style={{
        ...adminAccordionStyle,
        display: activeAdminMenu === "schedule" ? "block" : "none",
      }}
    >
      <summary style={adminAccordionSummaryStyle}>
        <span>📋 League Standings</span>
        <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
      </summary>
      <div style={{ marginTop: "32px" }}>
        <h2>League Standings</h2>

        <table border="1" cellPadding="8" cellSpacing="0">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Logo</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>L</th>
              <th>PF</th>
              <th>PA</th>
              <th>Diff</th>
            </tr>
          </thead>

          <tbody>
            {standings.map((row, index) => (
              <tr key={row.team}>
                <td>{index + 1}</td>
                <td>{renderTeamLogo(row.team, 34)}</td>
                <td>{row.team}</td>
                <td>{row.played}</td>
                <td>{row.win}</td>
                <td>{row.loss}</td>
                <td>{row.pf}</td>
                <td>{row.pa}</td>
                <td>{row.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};

export default StandingsPanel;
