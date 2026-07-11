const SchedulePanel = ({
  activeAdminMenu,
  adminAccordionStyle,
  adminAccordionSummaryStyle,
  adminAccordionHintStyle,
  teams,
  schedule,
  createSchedule,
  updatePlayoffTeams,
  clearSchedule,
  updateMatchScore,
  finishMatch,
  renderTeamWithLogo,
  setSelectedRosterMatchId,
  setSelectedStatsMatchId,
}) => (
  <>
    {activeAdminMenu === "schedule" && (
      <details
        open
        style={{
          ...adminAccordionStyle,
          display: activeAdminMenu === "schedule" ? "block" : "none",
        }}
      >
        <summary style={adminAccordionSummaryStyle}>
          <span>📅 Schedule / Match Control</span>
          <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
        </summary>
        <div style={{ marginTop: "32px" }}>
          <h2>📅 Schedule / Match Control</h2>
          <p style={{ color: "#555" }}>
            จัดการตารางแข่ง กรอกคะแนน Manage Roster และ Enter Stats
            ของแต่ละแมตช์ในแท็บนี้
          </p>

          {teams.length === 0 ? (
            <p>กรุณา Generate Teams ก่อนสร้างตารางแข่ง</p>
          ) : (
            <button
              onClick={createSchedule}
              style={{ marginRight: "8px", marginBottom: "12px" }}
            >
              {schedule.length > 0 ? "Recreate Schedule" : "Create Schedule"}
            </button>
          )}

          {schedule.length > 0 && (
            <>
              <button
                onClick={updatePlayoffTeams}
                style={{ marginRight: "8px", marginBottom: "12px" }}
              >
                Update Playoff Teams
              </button>

              <button
                onClick={clearSchedule}
                style={{ marginBottom: "12px" }}
              >
                Clear Schedule
              </button>

              {[...new Set(schedule.map((match) => match.week))]
                .sort((a, b) => a - b)
                .map((week) => (
                  <div key={week} style={{ marginTop: "20px" }}>
                    <h3>Week {week}</h3>

                    <table border="1" cellPadding="8" cellSpacing="0">
                      <thead>
                        <tr>
                          <th>Round</th>
                          <th>Team A</th>
                          <th>Score A</th>
                          <th>Team B</th>
                          <th>Score B</th>
                          <th>Status</th>
                          <th>Roster</th>
                          <th>Stats</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {schedule
                          .filter((match) => match.week === week)
                          .map((match) => (
                            <tr key={match.id}>
                              <td>{match.label}</td>
                              <td>{renderTeamWithLogo(match.teamA, 30)}</td>
                              <td>
                                <input
                                  type="number"
                                  value={match.scoreA}
                                  onChange={(e) =>
                                    updateMatchScore(
                                      match.id,
                                      "scoreA",
                                      e.target.value,
                                    )
                                  }
                                  style={{ width: "70px" }}
                                />
                              </td>
                              <td>{renderTeamWithLogo(match.teamB, 30)}</td>
                              <td>
                                <input
                                  type="number"
                                  value={match.scoreB}
                                  onChange={(e) =>
                                    updateMatchScore(
                                      match.id,
                                      "scoreB",
                                      e.target.value,
                                    )
                                  }
                                  style={{ width: "70px" }}
                                />
                              </td>
                              <td>{match.status}</td>
                              <td>
                                <button
                                  onClick={() =>
                                    setSelectedRosterMatchId(String(match.id))
                                  }
                                >
                                  Manage Roster
                                </button>
                              </td>
                              <td>
                                <button
                                  onClick={() =>
                                    setSelectedStatsMatchId(String(match.id))
                                  }
                                >
                                  Enter Stats
                                </button>
                              </td>
                              <td>
                                <button onClick={() => finishMatch(match.id)}>
                                  Finish
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </>
          )}

          {schedule.length === 0 && teams.length > 0 && (
            <p>ยังไม่มีตารางแข่ง กด Create Schedule เพื่อสร้างตาราง</p>
          )}
        </div>
      </details>
    )}
  </>
);

export default SchedulePanel;
