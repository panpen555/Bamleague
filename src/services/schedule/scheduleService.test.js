import {
  addManualScheduleMatch,
  buildScheduleResult,
  createManualScheduleDraft,
  groupPublicScheduleInSavedOrder,
  moveManualScheduleMatch,
  projectPublicSchedule,
  removeManualScheduleMatch,
  updateManualScheduleTeams,
  validateManualSchedule,
  validateManualScheduleChanges,
} from "./scheduleService";

const createSchedule = () => [
  { id: 1, teamA: "A", teamB: "B", scoreA: "10", scoreB: "8", status: "Finished" },
  { id: 2, teamA: "C", teamB: "D", scoreA: "", scoreB: "", status: "Pending" },
  { id: 3, teamA: "A", teamB: "C", scoreA: "", scoreB: "", status: "Pending" },
];

describe("manual schedule utilities", () => {
  test("moves the third match to the first position without changing match IDs", () => {
    const original = createSchedule();
    const reordered = moveManualScheduleMatch(original, 3, 0);

    expect(reordered.map((match) => match.id)).toEqual([3, 1, 2]);
    expect(reordered.find((match) => match.id === 1)).toEqual(original[0]);
    expect(original.map((match) => match.id)).toEqual([1, 2, 3]);
  });

  test("reorder keeps roster, stats, inputs, and score linked to matchId", () => {
    const schedule = createSchedule();
    const dependentData = {
      matchRosters: { 1: { teamA: {}, teamB: {} } },
      playerStats: {
        p1: { gamesByMatch: { 1: { matchId: 1, pts: 10 } } },
      },
      matchStatInputs: {
        "1_p1_regular_A": { matchId: 1, pts: "10" },
      },
    };
    const reordered = moveManualScheduleMatch(schedule, 3, 0);

    expect(reordered.find((match) => match.id === 1).scoreA).toBe("10");
    expect(dependentData.matchRosters[1]).toBeDefined();
    expect(dependentData.playerStats.p1.gamesByMatch[1].matchId).toBe(1);
    expect(dependentData.matchStatInputs["1_p1_regular_A"].matchId).toBe(1);
  });

  test("blocks choosing the same team on both sides", () => {
    const result = updateManualScheduleTeams(
      createSchedule(),
      2,
      "teamA",
      "D",
      {},
    );

    expect(result.error).toMatch(/ทีมเดียวกัน/);
    expect(result.schedule.find((match) => match.id === 2).teamA).toBe("C");
  });

  test("adds a match with a unique stable ID", () => {
    const schedule = createSchedule();
    const added = addManualScheduleMatch(schedule, ["A", "B", "C", "D"]);
    const ids = added.map((match) => String(match.id));

    expect(new Set(ids).size).toBe(ids.length);
    expect(added.at(-1).id).toBe(4);
  });

  test("removes an empty match without changing other IDs", () => {
    const result = removeManualScheduleMatch(createSchedule(), 2, {});

    expect(result.error).toBe("");
    expect(result.schedule.map((match) => match.id)).toEqual([1, 3]);
  });

  test("blocks deleting a match with roster, score, stats, or result", () => {
    const result = removeManualScheduleMatch(createSchedule(), 1, {
      matchRosters: { 1: { teamA: {}, teamB: {} } },
    });

    expect(result.error).toMatch(/ลบไม่ได้/);
    expect(result.schedule).toHaveLength(3);
  });

  test("blocks changing teams for a match with existing data", () => {
    const result = updateManualScheduleTeams(
      createSchedule(),
      1,
      "teamB",
      "C",
      {},
    );

    expect(result.error).toMatch(/เปลี่ยนทีมไม่ได้/);
    expect(result.schedule[0].teamB).toBe("B");
  });

  test("save validation rejects protected match deletion or team changes", () => {
    const original = createSchedule();
    const dependentData = {
      playerStats: {
        p1: { gamesByMatch: { 1: { matchId: 1 } } },
      },
    };

    expect(
      validateManualScheduleChanges(
        original,
        original.filter((match) => match.id !== 1),
        dependentData,
      ).valid,
    ).toBe(false);
    expect(
      validateManualScheduleChanges(
        original,
        original.map((match) =>
          match.id === 1 ? { ...match, teamB: "C" } : match,
        ),
        dependentData,
      ).valid,
    ).toBe(false);
  });

  test("cancel-style draft edits do not mutate the real schedule", () => {
    const realSchedule = createSchedule();
    const draft = createManualScheduleDraft(realSchedule);
    const editedDraft = moveManualScheduleMatch(draft, 3, 0);

    expect(editedDraft.map((match) => match.id)).toEqual([3, 1, 2]);
    expect(realSchedule.map((match) => match.id)).toEqual([1, 2, 3]);
  });

  test("random schedule remains deterministic with injected random source", () => {
    const first = buildScheduleResult({
      sourceTeamNames: ["A", "B", "C", "D"],
      random: () => 0.5,
    });
    const second = buildScheduleResult({
      sourceTeamNames: ["A", "B", "C", "D"],
      random: () => 0.5,
    });

    expect(first).toEqual(second);
    expect(first.map((match) => match.id)).toEqual(
      first.map((_, index) => index + 1),
    );
  });

  test("manual order survives JSON serialize and restore", () => {
    const reordered = moveManualScheduleMatch(createSchedule(), 3, 0);
    const restored = JSON.parse(JSON.stringify(reordered));

    expect(restored.map((match) => match.id)).toEqual([3, 1, 2]);
    expect(validateManualSchedule(restored)).toEqual({
      valid: true,
      errors: [],
    });
  });

  test("Public schedule projection preserves saved array order and match IDs", () => {
    const input = [
      { id: 3, week: 2, teamA: "A", teamB: "C" },
      { id: 1, week: 1, teamA: "A", teamB: "B" },
      { id: 2, week: 1, teamA: "C", teamB: "D" },
    ];
    const projected = projectPublicSchedule(input);

    expect(projected.map((match) => match.id)).toEqual([3, 1, 2]);
    expect(projected.map((match) => match.displayOrder)).toEqual([1, 2, 3]);
    expect(projected.map((match) => match.week)).toEqual([2, 1, 1]);
    expect(projected.map((match) => match.id)).not.toEqual([1, 2, 3]);
  });

  test("Public week groups flatten back to the exact saved order", () => {
    const input = [
      { id: 3, week: 2 },
      { id: 1, week: 1 },
      { id: 2, week: 1 },
    ];
    const groups = groupPublicScheduleInSavedOrder(input);

    expect(groups.flatMap((group) => group.matches.map((match) => match.id))).toEqual(
      [3, 1, 2],
    );
    expect(groups.map((group) => group.week)).toEqual([2, 1]);
  });
});
