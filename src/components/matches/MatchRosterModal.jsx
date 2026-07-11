const MatchRosterModal = ({
  isOpen,
  selectedMatch,
  adminAccordionStyle,
  adminAccordionSummaryStyle,
  adminAccordionHintStyle,
  getMatchRoster,
  getSideTeamName,
  getTeamPlayers,
  getLoanCandidates,
  toggleActivePlayer,
  loanForm,
  setLoanForm,
  addLoanPlayerToMatch,
  removeLoanPlayerFromMatch,
  saveMatchRoster,
  clearMatchRoster,
  onClose,
  renderTeamWithLogo,
  renderPlayerAvatar,
  getPlayerPhotoUrl,
}) => {
  if (!isOpen || !selectedMatch) return null;

  const roster = getMatchRoster(selectedMatch);

  const renderSideRoster = (side) => {
    const teamName = getSideTeamName(selectedMatch, side);
    const teamPlayers = getTeamPlayers(teamName);
    const activePlayers = roster[side].activePlayers || [];
    const loanPlayers = roster[side].loanPlayers || [];
    const loanCandidates = getLoanCandidates(selectedMatch, side);
    const totalPlayers = activePlayers.length + loanPlayers.length;

    return (
      <div
        style={{
          border: "1px solid #999",
          padding: "12px",
          minWidth: "340px",
        }}
      >
        <h3>{renderTeamWithLogo(teamName, 36)}</h3>

        <p>
          Active + Loan: <strong>{totalPlayers}</strong> คน
          {totalPlayers < 5 ? " ⚠️ ยังไม่ครบ 5" : " ✅ ครบ 5"}
        </p>

        <h4>Regular Players</h4>
        {teamPlayers.length === 0 ? (
          <p>ยังไม่มีผู้เล่นในทีม</p>
        ) : (
          teamPlayers.map((player) => (
            <label
              key={`${side}-active-${player.id}`}
              style={{ display: "block", marginBottom: "6px" }}
            >
              <input
                type="checkbox"
                checked={activePlayers.includes(player.id)}
                onChange={() =>
                  toggleActivePlayer(selectedMatch, side, player.id)
                }
              />{" "}
              {player.name} | {player.tier} | {player.rating}
            </label>
          ))
        )}

        <h4>Loan Players</h4>
        <div style={{ marginBottom: "8px" }}>
          <select
            value={loanForm.side === side ? loanForm.playerId : ""}
            onChange={(e) => setLoanForm({ side, playerId: e.target.value })}
            style={{ marginRight: "8px" }}
          >
            <option value="">เลือกผู้เล่นยืมตัว</option>
            {loanCandidates.map((player) => (
              <option
                key={`loan-candidate-${side}-${player.id}`}
                value={player.id}
              >
                {player.name} ({player.teamName || "No Team"})
              </option>
            ))}
          </select>

          <button onClick={() => addLoanPlayerToMatch(selectedMatch, side)}>
            Add Loan
          </button>
        </div>

        {loanPlayers.length === 0 ? (
          <p>ไม่มีผู้เล่นยืมตัว</p>
        ) : (
          <ul>
            {loanPlayers.map((loan) => (
              <li key={`${side}-loan-${loan.playerId}`}>
                {renderPlayerAvatar(getPlayerPhotoUrl(loan.playerId), 26)}{" "}
                {loan.playerName} | From: {loan.ownerTeam} | LOAN |
                ไม่นับสถิติส่วนตัว{" "}
                <button
                  onClick={() =>
                    removeLoanPlayerFromMatch(
                      selectedMatch,
                      side,
                      loan.playerId,
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

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
            <span>📝 Match Roster</span>
            <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
          </summary>
          <div style={{ marginTop: "32px" }}>
            <h2>Match Roster</h2>
            <p>
              Match: Week {selectedMatch.week} | {selectedMatch.label} |{" "}
              {selectedMatch.teamA} vs {selectedMatch.teamB}
            </p>
            <p>
              Regular Player = นับสถิติในอนาคต / Loan Player = ช่วยแข่ง
              แต่ไม่นับสถิติส่วนตัว
            </p>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {renderSideRoster("teamA")}
              {renderSideRoster("teamB")}
            </div>

            <div style={{ marginTop: "16px" }}>
              <button
                onClick={() => saveMatchRoster(selectedMatch)}
                style={{ marginRight: "8px" }}
              >
                Save Match Roster
              </button>

              <button
                onClick={() => clearMatchRoster(selectedMatch.id)}
                style={{ marginRight: "8px" }}
              >
                Clear Match Roster
              </button>

              <button onClick={onClose}>Close</button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default MatchRosterModal;
