import {
  PLAYOFF_MODE_MANUAL,
  PLAYOFF_MODE_STANDARD,
  createManualPlayoffMatch,
  getBestLoserCandidates,
  getFinishedMatchOutcome,
  getPlayoffTypeFromLabel,
  normalizeTeamSource,
  resolveManualPlayoffSchedule,
  resolveTeamSource,
  validateManualPlayoffSchedule,
} from "./manualPlayoffService";

const standings = ["A", "B", "C", "D", "E", "F"].map((team) => ({ team }));
const playIns = [
  { id: "P1", week: 5, label: "Play-in", phase: "postseason", playoffType: "play_in", manualPlayoff: true, teamA: "A", teamB: "F", scoreA: "80", scoreB: "70", status: "Finished", teamASource: { type: "seed", seed: 1 }, teamBSource: { type: "seed", seed: 6 } },
  { id: "P2", week: 5, label: "Play-in", phase: "postseason", playoffType: "play_in", manualPlayoff: true, teamA: "B", teamB: "E", scoreA: "75", scoreB: "65", status: "Finished", teamASource: { type: "seed", seed: 2 }, teamBSource: { type: "seed", seed: 5 } },
  { id: "P3", week: 5, label: "Play-in", phase: "postseason", playoffType: "play_in", manualPlayoff: true, teamA: "C", teamB: "D", scoreA: "60", scoreB: "68", status: "Finished", teamASource: { type: "seed", seed: 3 }, teamBSource: { type: "seed", seed: 4 } },
];

const bestLoserSource = (selectedTeam = "") => ({
  type: "bestLoser",
  matchIds: ["P1", "P2", "P3"],
  selectedTeam,
});

describe("manual playoff bracket utilities", () => {
  test("exposes separate Standard and Manual modes", () => {
    expect(PLAYOFF_MODE_STANDARD).toBe("standard");
    expect(PLAYOFF_MODE_MANUAL).toBe("manual");
  });

  test("creates a postseason match with a stable unique ID and explicit phase", () => {
    const match = createManualPlayoffMatch([{ id: 7, week: 3 }], { week: 4, label: "Quarterfinal" });
    expect(match).toMatchObject({ id: 8, week: 4, phase: "postseason", playoffType: "quarterfinal", manualPlayoff: true, teamA: "TBD", teamB: "TBD" });
  });

  test("classifies supported and custom postseason labels", () => {
    expect(getPlayoffTypeFromLabel("Play-in")).toBe("play_in");
    expect(getPlayoffTypeFromLabel("Semi Final")).toBe("semi_final");
    expect(getPlayoffTypeFromLabel("Final")).toBe("final");
    expect(getPlayoffTypeFromLabel("3rd Place")).toBe("third_place");
    expect(getPlayoffTypeFromLabel("Wildcard Night")).toBe("custom_postseason");
  });

  test("resolves Seed 1-6 without using schedule array indexes", () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      expect(resolveTeamSource({ type: "seed", seed }, { standings }).teamName).toBe(standings[seed - 1].team);
    }
  });

  test("resolves winner and loser only from a Finished non-tied match", () => {
    expect(getFinishedMatchOutcome(playIns[0])).toMatchObject({ status: "resolved", winner: "A", loser: "F" });
    expect(resolveTeamSource({ type: "winner", matchId: "P1" }, { schedule: playIns }).teamName).toBe("A");
    expect(resolveTeamSource({ type: "loser", matchId: "P1" }, { schedule: playIns }).teamName).toBe("F");
  });

  test("returns TBD before the source match is Finished", () => {
    const schedule = [{ ...playIns[0], status: "Pending" }];
    expect(resolveTeamSource({ type: "winner", matchId: "P1" }, { schedule })).toMatchObject({ teamName: "TBD", status: "pending" });
  });

  test("does not create an automatic winner for a tied playoff", () => {
    const schedule = [{ ...playIns[0], scoreA: "70", scoreB: "70" }];
    expect(resolveTeamSource({ type: "winner", matchId: "P1" }, { schedule })).toMatchObject({ teamName: "TBD", status: "invalid" });
  });

  test("offers only losers from all selected finished source matches", () => {
    expect(getBestLoserCandidates(bestLoserSource(), playIns)).toEqual({ ready: true, candidates: ["F", "E", "C"], error: "" });
  });

  test("requires Admin to select Best Loser and never chooses automatically", () => {
    const unresolved = resolveTeamSource(bestLoserSource(), { schedule: playIns });
    expect(unresolved).toMatchObject({ teamName: "TBD", status: "pending" });
    expect(unresolved.candidates).toEqual(["F", "E", "C"]);
    expect(resolveTeamSource(bestLoserSource("E"), { schedule: playIns }).teamName).toBe("E");
  });

  test("invalidates a Best Loser selection if an upstream result changes", () => {
    const changed = playIns.map((match) =>
      match.id === "P2" ? { ...match, scoreA: "60", scoreB: "75" } : match,
    );
    expect(resolveTeamSource(bestLoserSource("E"), { schedule: changed })).toMatchObject({ teamName: "TBD", status: "invalid" });
  });

  test("waits until every Best Loser source match is Finished", () => {
    const pending = playIns.map((match) =>
      match.id === "P3" ? { ...match, status: "Pending" } : match,
    );
    expect(getBestLoserCandidates(bestLoserSource(), pending).ready).toBe(false);
  });

  test("resolves a manual semifinal from winners plus selected Best Loser", () => {
    const semifinal = {
      id: "SF1", week: 6, label: "Semi Final", phase: "postseason", playoffType: "semi_final", manualPlayoff: true,
      teamA: "TBD", teamB: "TBD", scoreA: "", scoreB: "", status: "Pending",
      teamASource: { type: "winner", matchId: "P1" }, teamBSource: bestLoserSource("E"),
    };
    const result = resolveManualPlayoffSchedule([...playIns, semifinal], standings);
    expect(result.errors).toEqual([]);
    expect(result.schedule.find((match) => match.id === "SF1")).toMatchObject({ teamA: "A", teamB: "E" });
  });

  test("blocks resolved team changes when the downstream match has data", () => {
    const semifinal = {
      id: "SF1", week: 6, label: "Semi Final", phase: "postseason", playoffType: "semi_final", manualPlayoff: true,
      teamA: "Old A", teamB: "Old B", scoreA: "10", scoreB: "", status: "Pending",
      teamASource: { type: "winner", matchId: "P1" }, teamBSource: bestLoserSource("E"),
    };
    const result = resolveManualPlayoffSchedule([...playIns, semifinal], standings);
    expect(result.blockedMatchIds).toEqual(["SF1"]);
    expect(result.schedule.find((match) => match.id === "SF1")).toMatchObject({ teamA: "Old A", teamB: "Old B" });
  });

  test("rejects missing references, self references, and cycles by Match ID", () => {
    const first = { ...createManualPlayoffMatch([], { week: 2 }), id: "A", teamASource: { type: "winner", matchId: "B" } };
    const second = { ...createManualPlayoffMatch([first], { week: 3 }), id: "B", teamASource: { type: "winner", matchId: "A" } };
    const cycle = validateManualPlayoffSchedule([first, second]);
    expect(cycle.valid).toBe(false);
    expect(cycle.errors.join(" ")).toMatch(/cycle/i);
    const missing = validateManualPlayoffSchedule([{ ...first, teamASource: { type: "winner", matchId: "MISSING" } }]);
    expect(missing.valid).toBe(false);
    expect(missing.errors.join(" ")).toMatch(/missing/i);
  });

  test("preserves manual bracket fields through JSON backup-style round trip", () => {
    const bracket = [...playIns, { ...createManualPlayoffMatch(playIns, { week: 6, label: "Semi Final" }), teamASource: { type: "winner", matchId: "P1" }, teamBSource: bestLoserSource("E") }];
    const restored = JSON.parse(JSON.stringify({ playoffMode: PLAYOFF_MODE_MANUAL, schedule: bracket }));
    expect(restored.playoffMode).toBe(PLAYOFF_MODE_MANUAL);
    expect(restored.schedule.at(-1).teamASource).toEqual({ type: "winner", matchId: "P1" });
    expect(restored.schedule.at(-1).teamBSource.selectedTeam).toBe("E");
  });

  test("normalizes malformed source objects to safe TBD", () => {
    expect(normalizeTeamSource(null)).toEqual({ type: "tbd" });
    expect(normalizeTeamSource({ type: "unknown", matchId: 1 })).toEqual({ type: "tbd" });
  });
});