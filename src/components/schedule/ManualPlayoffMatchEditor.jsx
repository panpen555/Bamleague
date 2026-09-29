import React from "react";
import {
  getBestLoserCandidates,
  getPlayoffTypeFromLabel,
  normalizeTeamSource,
} from "../../services/schedule/manualPlayoffService";
import { matchHasCompetitionData } from "../../services/schedule/scheduleService";

const PHASE_LABELS = [
  "Play-in",
  "Quarterfinal",
  "Semi Final",
  "Final",
  "3rd Place",
  "Custom Postseason",
];

const ManualPlayoffMatchEditor = ({
  match,
  schedule,
  teams,
  dependentData,
  onChange,
}) => {
  const isProtected = matchHasCompetitionData(match, dependentData);
  const matchOptions = schedule.filter(
    (candidate) => String(candidate.id) !== String(match.id),
  );

  const updateSource = (side, nextSource) => {
    if (isProtected) return;
    onChange({
      ...match,
      [`team${side}Source`]: normalizeTeamSource(nextSource),
    });
  };

  const renderSource = (side) => {
    const field = `team${side}Source`;
    const source = normalizeTeamSource(match[field]);
    const bestLoserState =
      source.type === "bestLoser"
        ? getBestLoserCandidates(source, schedule)
        : null;

    return (
      <div style={{ display: "grid", gap: "6px" }}>
        <select
          aria-label={`Match ${match.id} Team ${side} source`}
          value={source.type}
          disabled={isProtected}
          onChange={(event) => {
            const type = event.target.value;
            if (type === "team") updateSource(side, { type, teamName: "" });
            else if (type === "seed") updateSource(side, { type, seed: 1 });
            else if (type === "winner" || type === "loser") {
              updateSource(side, { type, matchId: "" });
            } else if (type === "bestLoser") {
              updateSource(side, { type, matchIds: [], selectedTeam: "" });
            } else updateSource(side, { type: "tbd" });
          }}
        >
          <option value="tbd">TBD</option>
          <option value="team">Direct team</option>
          <option value="seed">Regular Season Seed</option>
          <option value="winner">Winner of Match</option>
          <option value="loser">Loser of Match</option>
          <option value="bestLoser">Best Loser (Admin selects)</option>
        </select>

        {source.type === "team" ? (
          <select
            value={source.teamName}
            disabled={isProtected}
            onChange={(event) =>
              updateSource(side, { type: "team", teamName: event.target.value })
            }
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={`${match.id}-${side}-team-${team.name}`} value={team.name}>
                {team.name}
              </option>
            ))}
          </select>
        ) : null}

        {source.type === "seed" ? (
          <select
            value={source.seed}
            disabled={isProtected}
            onChange={(event) =>
              updateSource(side, { type: "seed", seed: Number(event.target.value) })
            }
          >
            {teams.map((team, index) => (
              <option key={`${match.id}-${side}-seed-${index + 1}`} value={index + 1}>
                Seed {index + 1}
              </option>
            ))}
          </select>
        ) : null}

        {source.type === "winner" || source.type === "loser" ? (
          <select
            value={String(source.matchId || "")}
            disabled={isProtected}
            onChange={(event) =>
              updateSource(side, { type: source.type, matchId: event.target.value })
            }
          >
            <option value="">Select source match</option>
            {matchOptions.map((candidate) => (
              <option key={`${match.id}-${side}-source-${candidate.id}`} value={candidate.id}>
                Match {candidate.id}: {candidate.label || "League"}
              </option>
            ))}
          </select>
        ) : null}

        {source.type === "bestLoser" ? (
          <div style={{ border: "1px solid #cbd5e1", padding: "8px" }}>
            <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
              Loser source matches
            </div>
            {matchOptions.map((candidate) => {
              const matchId = String(candidate.id);
              const checked = source.matchIds.includes(matchId);
              return (
                <label key={`${match.id}-${side}-loser-source-${matchId}`} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isProtected}
                    onChange={(event) => {
                      const matchIds = event.target.checked
                        ? [...source.matchIds, matchId]
                        : source.matchIds.filter((id) => id !== matchId);
                      updateSource(side, {
                        type: "bestLoser",
                        matchIds,
                        selectedTeam: "",
                      });
                    }}
                  />{" "}
                  Match {candidate.id}: {candidate.label || "League"}
                </label>
              );
            })}
            <select
              value={source.selectedTeam}
              disabled={isProtected || !bestLoserState?.ready}
              onChange={(event) =>
                updateSource(side, { ...source, selectedTeam: event.target.value })
              }
              style={{ width: "100%", marginTop: "6px" }}
            >
              <option value="">Admin selects Best Loser</option>
              {(bestLoserState?.candidates || []).map((teamName) => (
                <option key={`${match.id}-${side}-best-loser-${teamName}`} value={teamName}>
                  {teamName}
                </option>
              ))}
            </select>
            {bestLoserState?.error ? (
              <small style={{ color: bestLoserState.ready ? "#475569" : "#b45309" }}>
                {bestLoserState.error}
              </small>
            ) : null}
            {bestLoserState?.ready &&
            source.selectedTeam &&
            !bestLoserState.candidates.includes(source.selectedTeam) ? (
              <small role="alert" style={{ color: "#b91c1c", fontWeight: "bold" }}>
                Invalid Best Loser selection. Choose again; no replacement was selected automatically.
              </small>
            ) : null}
          </div>
        ) : null}

        <small>
          Resolved team: <strong>{match[`team${side}`] || "TBD"}</strong>
        </small>
      </div>
    );
  };

  return (
    <div style={{ gridColumn: "1 / -1", display: "grid", gap: "10px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "8px" }}>
        <select
          value={PHASE_LABELS.includes(match.label) ? match.label : "Custom Postseason"}
          disabled={isProtected}
          onChange={(event) => {
            const label = event.target.value;
            onChange({ ...match, label, playoffType: getPlayoffTypeFromLabel(label) });
          }}
        >
          {PHASE_LABELS.map((label) => (
            <option key={`${match.id}-label-${label}`} value={label}>{label}</option>
          ))}
        </select>
        <input
          type="text"
          value={match.label || ""}
          disabled={isProtected}
          aria-label={`Match ${match.id} postseason label`}
          onChange={(event) => {
            const label = event.target.value;
            onChange({ ...match, label, playoffType: getPlayoffTypeFromLabel(label) });
          }}
          placeholder="Phase / label"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div><strong>Team A source</strong>{renderSource("A")}</div>
        <div><strong>Team B source</strong>{renderSource("B")}</div>
      </div>
      {isProtected ? (
        <div role="alert" style={{ color: "#991b1b", fontWeight: "bold" }}>
          This playoff match has score, roster, or stats data. Its team sources and phase are locked; Week/order may still be changed safely.
        </div>
      ) : null}
    </div>
  );
};

export default ManualPlayoffMatchEditor;