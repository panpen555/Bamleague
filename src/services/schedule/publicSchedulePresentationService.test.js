import {
  buildPostseasonBracketModel,
  buildWeeklyStandingsSnapshots,
  groupRegularScheduleByWeek,
  isReliableFinishedMatch,
  splitPublicScheduleByPhase,
} from "./publicSchedulePresentationService";

const teams = ["A", "B", "C", "D"].map((name) => ({ name }));
const match = (id, week, teamA, teamB, scoreA = "", scoreB = "", status = "Pending") => ({
  id,
  week,
  label: "League",
  teamA,
  teamB,
  scoreA,
  scoreB,
  status,
});

describe("public schedule presentation selectors", () => {
  test("separates regular, postseason and unknown matches without using index or Week", () => {
    const result = splitPublicScheduleByPhase([
      match("r1", 50, "A", "B"),
      { ...match("p1", 1, "C", "D"), label: "Play-in" },
      { ...match("x1", 2, "A", "C"), label: "Friendly" },
    ]);
    expect(result.regularMatches.map((item) => item.id)).toEqual(["r1"]);
    expect(result.postseasonMatches.map((item) => item.id)).toEqual(["p1"]);
    expect(result.unknownMatches.map((item) => item.id)).toEqual(["x1"]);
  });

  test("groups adjacent matches in a Week and preserves the exact saved order", () => {
    const groups = groupRegularScheduleByWeek([
      match("m2", 2, "A", "B"),
      match("m1", 1, "A", "C"),
      match("m3", 2, "C", "D"),
    ]);
    expect(groups.map((group) => group.week)).toEqual([2, 1, 2]);
    expect(groups.flatMap((group) => group.matches).map((item) => item.id)).toEqual([
      "m2",
      "m1",
      "m3",
    ]);
  });

  test("uses a dash snapshot for the first played Week", () => {
    const result = buildWeeklyStandingsSnapshots([match("w1", 1, "A", "B")], teams);
    expect(result.snapshotsByWeek[1]).toMatchObject({
      available: false,
      reason: "first-week",
      rankByTeam: {},
    });
  });

  test("Week 2 uses only completed Week 1 results", () => {
    const schedule = [
      match("w1a", 1, "A", "B", 80, 60, "Finished"),
      match("w1b", 1, "C", "D", 70, 65, "Finished"),
      match("w2", 2, "A", "C", 1, 100, "Finished"),
    ];
    const snapshot = buildWeeklyStandingsSnapshots(schedule, teams).snapshotsByWeek[2];
    expect(snapshot.rankByTeam.A).toBe(1);
    expect(snapshot.rankByTeam.C).toBe(2);
  });

  test("does not publish a partial ranking while an earlier Week is incomplete", () => {
    const schedule = [
      match("w1a", 1, "A", "B", 80, 60, "Finished"),
      match("w1b", 1, "C", "D"),
      match("w2", 2, "A", "C"),
    ];
    expect(buildWeeklyStandingsSnapshots(schedule, teams).snapshotsByWeek[2]).toMatchObject({
      available: false,
      reason: "waiting-for-results",
      waitingForWeek: 1,
    });
  });

  test("skips empty Week numbers and calculates from existing earlier Weeks", () => {
    const schedule = [
      match("w1", 1, "A", "B", 75, 70, "Finished"),
      match("w3", 3, "C", "D"),
    ];
    expect(buildWeeklyStandingsSnapshots(schedule, teams).snapshotsByWeek[3].rankByTeam.A).toBe(1);
  });

  test("excludes postseason results from weekly standings", () => {
    const schedule = [
      match("w1", 1, "A", "B", 75, 70, "Finished"),
      { ...match("final", 1, "B", "A", 200, 1, "Finished"), label: "Final" },
      match("w2", 2, "C", "D"),
    ];
    const snapshot = buildWeeklyStandingsSnapshots(schedule, teams).snapshotsByWeek[2];
    expect(snapshot.rankByTeam.A).toBe(1);
    expect(snapshot.rankByTeam.B).toBeGreaterThan(snapshot.rankByTeam.A);
  });

  test("recomputes later snapshots deterministically after an earlier result changes", () => {
    const schedule = [
      match("w1", 1, "A", "B", 80, 70, "Finished"),
      match("w2", 2, "C", "D"),
    ];
    const first = buildWeeklyStandingsSnapshots(schedule, teams).snapshotsByWeek[2];
    const changed = buildWeeklyStandingsSnapshots(
      [{ ...schedule[0], scoreA: 60, scoreB: 90 }, schedule[1]],
      teams,
    ).snapshotsByWeek[2];
    expect(first.rankByTeam.A).toBe(1);
    expect(changed.rankByTeam.B).toBe(1);
  });

  test("reports movement against the previous available pre-Week snapshot", () => {
    const schedule = [
      match("w1a", 1, "A", "B", 80, 70, "Finished"),
      match("w1b", 1, "C", "D", 60, 50, "Finished"),
      match("w2a", 2, "A", "C", 50, 100, "Finished"),
      match("w2b", 2, "B", "D", 90, 60, "Finished"),
      match("w3", 3, "A", "D"),
    ];
    const snapshot = buildWeeklyStandingsSnapshots(schedule, teams).snapshotsByWeek[3];
    expect(snapshot.movementByTeam.C).toBe("up");
    expect(snapshot.movementByTeam.A).toBe("down");
    expect(snapshot.previousRankByTeam.A).toBe(1);
  });

  test("returns legacy fallback when any regular match has no valid Week", () => {
    const schedule = [{ ...match("legacy", null, "A", "B"), week: undefined }];
    expect(buildWeeklyStandingsSnapshots(schedule, teams)).toMatchObject({
      available: false,
      reason: "legacy-week",
    });
  });

  test("requires Finished status plus complete numeric scores", () => {
    expect(isReliableFinishedMatch(match("ok", 1, "A", "B", "0", "12", "Finished"))).toBe(true);
    expect(isReliableFinishedMatch(match("blank", 1, "A", "B", " ", 12, "Finished"))).toBe(false);
    expect(isReliableFinishedMatch(match("bad", 1, "A", "B", "x", 12, "Finished"))).toBe(false);
  });

  test("builds winner, loser and Best Loser edges only from explicit Match IDs", () => {
    const schedule = [
      { ...match("p1", 4, "A", "D"), phase: "postseason", label: "Play-in", manualPlayoff: true },
      { ...match("p2", 4, "B", "C"), phase: "postseason", label: "Play-in", manualPlayoff: true },
      {
        ...match("sf", 5, "TBD", "C"),
        phase: "postseason",
        label: "Semi Final",
        manualPlayoff: true,
        teamASource: { type: "winner", matchId: "p1" },
        teamBSource: { type: "bestLoser", matchIds: ["p1", "p2"], selectedTeam: "C" },
      },
      {
        ...match("third", 6, "TBD", "TBD"),
        phase: "postseason",
        label: "3rd Place",
        manualPlayoff: true,
        teamASource: { type: "loser", matchId: "sf" },
      },
    ];
    const model = buildPostseasonBracketModel(schedule);
    expect(model.hasExplicitRelationships).toBe(true);
    expect(model.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromMatchId: "p1", toMatchId: "sf", sourceType: "winner" }),
      expect.objectContaining({ fromMatchId: "p2", toMatchId: "sf", sourceType: "bestLoser" }),
      expect.objectContaining({ fromMatchId: "sf", toMatchId: "third", sourceType: "loser" }),
    ]));
  });

  test("does not invent connectors for legacy or Standard Playoff cards", () => {
    const model = buildPostseasonBracketModel([
      { ...match("sf1", 7, "Rank 1", "Rank 4"), label: "Semi Final" },
      { ...match("f", 8, "Winner SF1", "Winner SF2"), label: "Final" },
    ]);
    expect(model.hasExplicitRelationships).toBe(false);
    expect(model.edges).toEqual([]);
    expect(model.phases.flatMap((phase) => phase.matches).map((item) => item.id)).toEqual(["sf1", "f"]);
  });

  test("keeps custom postseason phases without hard-coding a round count", () => {
    const model = buildPostseasonBracketModel([
      { ...match("custom", 10, "A", "B"), phase: "postseason", label: "Wild Card" },
    ]);
    expect(model.phases).toHaveLength(1);
    expect(model.phases[0].label).toBe("Wild Card");
  });
});

