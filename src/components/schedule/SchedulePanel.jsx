import React, { useState } from "react";
import {
  addManualScheduleMatch,
  createManualScheduleDraft,
  moveManualScheduleMatch,
  removeManualScheduleMatch,
  updateManualScheduleTeams,
} from "../../services/schedule/scheduleService";

const SchedulePanel = ({
  activeAdminMenu,
  adminAccordionStyle,
  adminAccordionSummaryStyle,
  adminAccordionHintStyle,
  teams,
  schedule,
  createSchedule,
  saveManualSchedule,
  matchRosters,
  playerStats,
  matchStatInputs,
  updatePlayoffTeams,
  clearSchedule,
  updateMatchScore,
  finishMatch,
  renderTeamWithLogo,
  setSelectedRosterMatchId,
  setSelectedStatsMatchId,
  getMatchScoreSyncInfo,
}) => {
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualDraft, setManualDraft] = useState([]);
  const [manualError, setManualError] = useState("");
  const teamNames = teams.map((team) => team.name).filter(Boolean);
  const dependentData = { matchRosters, playerStats, matchStatInputs };

  const startManualEditing = () => {
    setManualDraft(createManualScheduleDraft(schedule));
    setManualError("");
    setIsManualEditing(true);
  };

  const cancelManualEditing = () => {
    setManualDraft([]);
    setManualError("");
    setIsManualEditing(false);
  };

  const updateManualTeam = (matchId, field, teamName) => {
    const result = updateManualScheduleTeams(
      manualDraft,
      matchId,
      field,
      teamName,
      dependentData,
    );
    setManualDraft(result.schedule);
    setManualError(result.error);
  };

  const removeManualMatch = (matchId) => {
    const result = removeManualScheduleMatch(
      manualDraft,
      matchId,
      dependentData,
    );
    setManualDraft(result.schedule);
    setManualError(result.error);
  };

  const saveManualDraft = () => {
    const result = saveManualSchedule(manualDraft);
    if (!result?.saved) {
      setManualError(result?.error || "ไม่สามารถบันทึกตารางได้");
      return;
    }
    setManualError("");
    setIsManualEditing(false);
  };

  const getTeamOptions = (match) =>
    [...new Set([match.teamA, match.teamB, ...teamNames].filter(Boolean))];

  return (
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
              <p>กรุณา Generate Teams ก่อนสร้างตารางแข่งขัน</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={createSchedule}
                  disabled={isManualEditing}
                  style={{ marginRight: "8px", marginBottom: "12px" }}
                >
                  {schedule.length > 0
                    ? "Recreate Random Schedule"
                    : "Create Random Schedule"}
                </button>
                <button
                  type="button"
                  onClick={startManualEditing}
                  disabled={isManualEditing}
                  style={{ marginRight: "8px", marginBottom: "12px" }}
                >
                  จัดตารางเอง
                </button>
              </>
            )}

            {isManualEditing ? (
              <div
                style={{
                  border: "1px solid #93c5fd",
                  borderRadius: "10px",
                  padding: "14px",
                  background: "#eff6ff",
                  marginBottom: "18px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>จัดลำดับและแก้คู่แข่งขัน</h3>
                <p style={{ color: "#475569" }}>
                  การแก้ไขยังไม่กระทบตารางจริงจนกว่าจะกดบันทึก
                  เกมที่มี roster, score, stats หรือผลการแข่งขันแล้วจะเปลี่ยนทีมและลบไม่ได้
                </p>

                {manualError ? (
                  <div
                    role="alert"
                    style={{
                      color: "#991b1b",
                      background: "#fee2e2",
                      padding: "10px",
                      borderRadius: "8px",
                      marginBottom: "10px",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {manualError}
                  </div>
                ) : null}

                {manualDraft.map((match, index) => (
                  <div
                    key={match.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "52px minmax(150px, 1fr) 36px minmax(150px, 1fr) auto",
                      gap: "8px",
                      alignItems: "center",
                      background: "white",
                      border: "1px solid #dbeafe",
                      borderRadius: "8px",
                      padding: "10px",
                      marginBottom: "8px",
                    }}
                  >
                    <strong>#{index + 1}</strong>
                    <select
                      aria-label={`คู่ที่ ${index + 1} ทีมที่ 1`}
                      value={match.teamA}
                      onChange={(event) =>
                        updateManualTeam(
                          match.id,
                          "teamA",
                          event.target.value,
                        )
                      }
                    >
                      <option value="">เลือกทีมที่ 1</option>
                      {getTeamOptions(match).map((teamName) => (
                        <option key={`a-${match.id}-${teamName}`} value={teamName}>
                          {teamName}
                        </option>
                      ))}
                    </select>
                    <span style={{ textAlign: "center", fontWeight: "bold" }}>
                      VS
                    </span>
                    <select
                      aria-label={`คู่ที่ ${index + 1} ทีมที่ 2`}
                      value={match.teamB}
                      onChange={(event) =>
                        updateManualTeam(
                          match.id,
                          "teamB",
                          event.target.value,
                        )
                      }
                    >
                      <option value="">เลือกทีมที่ 2</option>
                      {getTeamOptions(match).map((teamName) => (
                        <option key={`b-${match.id}-${teamName}`} value={teamName}>
                          {teamName}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() =>
                          setManualDraft(
                            moveManualScheduleMatch(
                              manualDraft,
                              match.id,
                              index - 1,
                            ),
                          )
                        }
                        disabled={index === 0}
                        aria-label={`เลื่อนคู่ที่ ${index + 1} ขึ้น`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setManualDraft(
                            moveManualScheduleMatch(
                              manualDraft,
                              match.id,
                              index + 1,
                            ),
                          )
                        }
                        disabled={index === manualDraft.length - 1}
                        aria-label={`เลื่อนคู่ที่ ${index + 1} ลง`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeManualMatch(match.id)}
                        style={{ color: "#b91c1c" }}
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setManualDraft(
                        addManualScheduleMatch(manualDraft, teamNames),
                      );
                      setManualError("");
                    }}
                  >
                    เพิ่มคู่แข่งขัน
                  </button>
                  <button type="button" onClick={saveManualDraft}>
                    บันทึกตาราง
                  </button>
                  <button type="button" onClick={cancelManualEditing}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : null}

            {schedule.length > 0 && !isManualEditing && (
              <>
                <button
                  type="button"
                  onClick={updatePlayoffTeams}
                  style={{ marginRight: "8px", marginBottom: "12px" }}
                >
                  Update Playoff Teams
                </button>

                <button
                  type="button"
                  onClick={clearSchedule}
                  style={{ marginBottom: "12px" }}
                >
                  Clear Schedule
                </button>

                <table border="1" cellPadding="8" cellSpacing="0">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Week</th>
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
                    {schedule.map((match, index) => {
                      const scoreSyncInfo = getMatchScoreSyncInfo?.(match);

                      return (
                        <React.Fragment key={match.id}>
                          <tr>
                            <td>{index + 1}</td>
                            <td>{match.week}</td>
                            <td>{match.label}</td>
                            <td>{renderTeamWithLogo(match.teamA, 30)}</td>
                            <td>
                              <input
                                type="number"
                                value={match.scoreA}
                                onChange={(event) =>
                                  updateMatchScore(
                                    match.id,
                                    "scoreA",
                                    event.target.value,
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
                                onChange={(event) =>
                                  updateMatchScore(
                                    match.id,
                                    "scoreB",
                                    event.target.value,
                                  )
                                }
                                style={{ width: "70px" }}
                              />
                            </td>
                            <td>{match.status}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedRosterMatchId(String(match.id))
                                }
                              >
                                Manage Roster
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedStatsMatchId(String(match.id))
                                }
                              >
                                Enter Stats
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => finishMatch(match.id)}
                              >
                                Finish
                              </button>
                            </td>
                          </tr>
                          {scoreSyncInfo?.hasMismatch ? (
                            <tr>
                              <td
                                colSpan="11"
                                style={{
                                  color: "#92400e",
                                  background: "#fffbeb",
                                  fontSize: "13px",
                                }}
                              >
                                ⚠ คะแนนทีมไม่ตรงกับ Enter Stats — Expected:{" "}
                                {scoreSyncInfo.expectedScoreA} -{" "}
                                {scoreSyncInfo.expectedScoreB}
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {schedule.length === 0 &&
              teams.length > 0 &&
              !isManualEditing && (
                <p>
                  ยังไม่มีตารางแข่งขัน กด Create Random Schedule
                  หรือจัดตารางเอง
                </p>
              )}
          </div>
        </details>
      )}
    </>
  );
};

export default SchedulePanel;
