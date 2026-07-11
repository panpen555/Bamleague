const MatchStatsModal = ({
  isOpen,
  selectedMatch,
  adminAccordionStyle,
  adminAccordionSummaryStyle,
  adminAccordionHintStyle,
  getAllStatRowsForMatch,
  statFields,
  getStatInputValue,
  updateMatchStatInput,
  saveMatchStats,
  onClose,
}) => {
  if (!isOpen || !selectedMatch) return null;

  const statRows = getAllStatRowsForMatch(selectedMatch);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "white",
          width: "min(1100px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          borderRadius: "12px",
          padding: "16px",
        }}
      >
        <button
          onClick={onClose}
          style={{ float: "right", marginBottom: "8px" }}
        >
          Close
        </button>

        <details open style={adminAccordionStyle}>
          <summary style={adminAccordionSummaryStyle}>
            <span>📊 Player Match Stats</span>
            <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
          </summary>
          <div style={{ marginTop: "32px" }}>
            <h2>Player Match Stats</h2>
            <p>
              Match: Week {selectedMatch.week} | {selectedMatch.label} |{" "}
              {selectedMatch.teamA} vs {selectedMatch.teamB}
            </p>
            <p>
              กรอก PTS / REB / AST / STL / BLK / Games นับตามเกมของทีม /
              Appear นับเฉพาะคนที่ติ๊กลงจริง / Loan Player
              ไม่นับสถิติส่วนตัว
            </p>

            {statRows.length === 0 ? (
              <p>ยังไม่มีรายชื่อผู้เล่น กรุณากด Manage Roster ก่อน</p>
            ) : (
              <table border="1" cellPadding="8" cellSpacing="0">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Match Team</th>
                    <th>Owner Team</th>
                    <th>Role</th>
                    {statFields.map((field) => (
                      <th key={`stat-head-${field.key}`}>{field.label}</th>
                    ))}
                    <th>Personal Stat</th>
                  </tr>
                </thead>
                <tbody>
                  {statRows.map((player) => (
                    <tr
                      key={`${selectedMatch.id}-${
                        player.playerId || player.id
                      }-${player.role}-${player.matchTeam}`}
                    >
                      <td>{player.name}</td>
                      <td>{player.matchTeam}</td>
                      <td>{player.ownerTeam}</td>
                      <td>{player.role === "loan" ? "LOAN" : "REGULAR"}</td>
                      {statFields.map((field) => (
                        <td
                          key={`${selectedMatch.id}-${
                            player.playerId || player.id
                          }-${field.key}`}
                        >
                          <input
                            type="number"
                            min="0"
                            value={getStatInputValue(
                              selectedMatch,
                              player,
                              field.key,
                            )}
                            onChange={(e) =>
                              updateMatchStatInput(
                                selectedMatch,
                                player,
                                field.key,
                                e.target.value,
                              )
                            }
                            style={{ width: "70px" }}
                          />
                        </td>
                      ))}
                      <td>{player.countPersonalStats ? "นับ" : "ไม่นับ"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: "16px" }}>
              <button
                onClick={() => saveMatchStats(selectedMatch)}
                style={{ marginRight: "8px" }}
              >
                Save Match Stats
              </button>
              <button onClick={onClose}>Close</button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default MatchStatsModal;
