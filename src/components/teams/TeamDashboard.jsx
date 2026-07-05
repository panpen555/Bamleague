import React from "react";

function TeamDashboard({
  activeAdminMenu,
  adminAccordionStyle,
  adminAccordionSummaryStyle,
  adminAccordionHintStyle,
  teamDashboardData,
  teams,
  expandedTeamDashboard,
  setExpandedTeamDashboard,
  renderTeamLogo,
  renderPlayerAvatar,
  getPlayerPhotoUrl,
  setSelectedProfilePlayerId,
}) {
  if (!teams || teams.length === 0) return null;

  return (
    <details
      open
      style={{
        ...adminAccordionStyle,
        display: activeAdminMenu === "teams" ? "block" : "none",
      }}
    >
      <summary style={adminAccordionSummaryStyle}>
        <span>📋 Team View / Team Dashboard</span>
        <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
      </summary>

      <div style={{ marginTop: "32px" }}>
        <h2>Team Dashboard</h2>
        <p>ภาพรวมทีมสำหรับเตรียมต่อยอดไป Public Dashboard</p>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {teamDashboardData.map((teamData, index) => (
            <div
              key={`team-dashboard-${teamData.teamName}`}
              onClick={() =>
                setExpandedTeamDashboard((prev) =>
                  prev === teamData.teamName ? "" : teamData.teamName,
                )
              }
              style={{
                border:
                  expandedTeamDashboard === teamData.teamName
                    ? "2px solid #111"
                    : "1px solid #222",
                borderRadius: "12px",
                padding: "16px",
                minWidth: "280px",
                background: "#fafafa",
                cursor: "pointer",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "12px" }}>
                {renderTeamLogo(teamData.teamName, 82)}
                <h3 style={{ marginBottom: "4px" }}>
                  #{index + 1} {teamData.teamName}
                </h3>
                <div>
                  <strong>Power Score:</strong> {teamData.powerScore.toFixed(1)}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <strong>GP</strong>
                  <br />
                  {teamData.gp}
                </div>
                <div>
                  <strong>W-L</strong>
                  <br />
                  {teamData.win}-{teamData.loss}
                </div>
                <div>
                  <strong>Win%</strong>
                  <br />
                  {teamData.winPct}%
                </div>
                <div>
                  <strong>Roster</strong>
                  <br />
                  {teamData.rosterCount}
                </div>
                <div>
                  <strong>PF</strong>
                  <br />
                  {teamData.pf}
                </div>
                <div>
                  <strong>PA</strong>
                  <br />
                  {teamData.pa}
                </div>
                <div>
                  <strong>Diff</strong>
                  <br />
                  {teamData.diff > 0 ? `+${teamData.diff}` : teamData.diff}
                </div>
                <div>
                  <strong>PPG / PAPG</strong>
                  <br />
                  {teamData.ppg} / {teamData.papg}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #ddd", paddingTop: "10px" }}>
                <p style={{ margin: "6px 0" }}>
                  <strong>Team MVP:</strong>{" "}
                  {teamData.teamMvp ? (
                    <button
                      onClick={() =>
                        setSelectedProfilePlayerId(teamData.teamMvp.playerId)
                      }
                    >
                      {renderPlayerAvatar(
                        getPlayerPhotoUrl(teamData.teamMvp.playerId),
                        24,
                      )}{" "}
                      {teamData.teamMvp.playerName} /{" "}
                      {teamData.teamMvp.mvpScore.toFixed(1)}
                    </button>
                  ) : (
                    "-"
                  )}
                </p>

                <p style={{ margin: "6px 0" }}>
                  <strong>Top Scorer:</strong>{" "}
                  {teamData.topScorer ? (
                    <button
                      onClick={() =>
                        setSelectedProfilePlayerId(teamData.topScorer.playerId)
                      }
                    >
                      {renderPlayerAvatar(
                        getPlayerPhotoUrl(teamData.topScorer.playerId),
                        24,
                      )}{" "}
                      {teamData.topScorer.playerName} / {teamData.topScorer.pts} PTS
                    </button>
                  ) : (
                    "-"
                  )}
                </p>

                <p style={{ margin: "6px 0", color: "#666" }}>
                  {expandedTeamDashboard === teamData.teamName
                    ? "▲ คลิกเพื่อปิดรายละเอียดทีม"
                    : "▼ คลิกเพื่อดูรายละเอียดทีม"}
                </p>

                {expandedTeamDashboard === teamData.teamName && (
                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px dashed #ccc",
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {(() => {
                      const team = teams.find(
                        (item) => item.name === teamData.teamName,
                      );

                      if (!team) return <p>ไม่พบข้อมูลทีม</p>;

                      return (
                        <div>
                          {team.lockedGroupName && (
                            <div
                              style={{
                                fontWeight: "bold",
                                color: "#d35400",
                                marginBottom: "8px",
                              }}
                            >
                              🔒 {team.lockedGroupName}
                            </div>
                          )}

                          <p>
                            <strong>Total Score:</strong> {team.totalScore}
                          </p>

                          {team.eliteWarning && <p>⚠️ SSS+ อยู่ร่วมกับ S+ / S-</p>}

                          <p>
                            <strong>Position:</strong> PG {team.positionSummary.PG} | SG{" "}
                            {team.positionSummary.SG} | SF {team.positionSummary.SF} | PF{" "}
                            {team.positionSummary.PF} | C {team.positionSummary.C}
                          </p>

                          {team.missingPositions.length === 0 ? (
                            <p>✅ Position Complete</p>
                          ) : (
                            <p>⚠️ Missing: {team.missingPositions.join(", ")}</p>
                          )}

                          <p>
                            <strong>Skill:</strong> เลี้ยง {team.skillTotals.dribbling} | วงใน{" "}
                            {team.skillTotals.insideScoring} | ยิง {team.skillTotals.shooting} | ป้องกัน{" "}
                            {team.skillTotals.defense} | จ่าย {team.skillTotals.passing}
                          </p>

                          <ol style={{ paddingLeft: "20px" }}>
                            {(team.players || []).map((player) => (
                              <li key={player.id} style={{ marginBottom: "6px" }}>
                                {renderPlayerAvatar(
                                  player.photoUrl || getPlayerPhotoUrl(player.id),
                                  28,
                                )}{" "}
                                {player.name} | {player.tier} | {player.rating} |{" "}
                                {player.pos1}
                                {player.pos2 ? `/${player.pos2}` : ""}
                                {player.lockedGroupName
                                  ? ` 🔒 ${player.lockedGroupName}`
                                  : ""}
                              </li>
                            ))}
                          </ol>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export default TeamDashboard;
