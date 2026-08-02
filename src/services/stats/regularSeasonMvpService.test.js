import {
  buildRegularSeasonStatRows,
  calculateMvpScore,
  classifyScheduleMatchPhase,
  getRegularSeasonMatchIds,
  sortMvpRanking,
} from "./regularSeasonMvpService";

const schedule = [
  { id: 1, label: "League" },
  { id: 2, label: "League" },
  { id: 3, label: "Semi Final", playoffType: "sf1" },
  { id: 4, label: "Final", playoffType: "final" },
];

const game = (matchId, values = {}) => ({
  matchId,
  gameCounted: true,
  appearanceCounted: true,
  pts: 10,
  reb: 2,
  ast: 1,
  stl: 1,
  blk: 1,
  ...values,
});

describe("regular season MVP selectors", () => {
  test("classifies schedule phases from persisted match fields", () => {
    expect(classifyScheduleMatchPhase({ label: "League" })).toBe("regular");
    expect(classifyScheduleMatchPhase({ label: "Regular Season" })).toBe(
      "regular",
    );
    expect(classifyScheduleMatchPhase({ label: "Semi Final" })).toBe(
      "postseason",
    );
    expect(classifyScheduleMatchPhase({ label: "Final" })).toBe("postseason");
    expect(classifyScheduleMatchPhase({ label: "Custom" })).toBe("unknown");
    expect([...getRegularSeasonMatchIds(schedule)]).toEqual(["1", "2"]);
  });

  test("excludes playoff and final games from every MVP input", () => {
    const result = buildRegularSeasonStatRows(
      {
        p1: {
          playerId: "p1",
          playerName: "Player One",
          games: 4,
          appearances: 4,
          pts: 230,
          gamesByMatch: {
            1: game(1),
            2: game(2, { pts: 20, reb: 3, ast: 2, stl: 0, blk: 0 }),
            3: game(3, { pts: 100, reb: 20, ast: 20, stl: 10, blk: 10 }),
            4: game(4, { pts: 100, reb: 20, ast: 20, stl: 10, blk: 10 }),
          },
        },
      },
      schedule,
    );

    expect(result.available).toBe(true);
    expect(result.rows[0]).toMatchObject({
      games: 2,
      appearances: 2,
      pts: 30,
      reb: 5,
      ast: 3,
      stl: 1,
      blk: 1,
      ppg: "15.0",
    });
    expect(result.rows[0].mvpScore).toBe(
      calculateMvpScore({
        games: 2,
        appearances: 2,
        pts: 30,
        reb: 5,
        ast: 3,
        stl: 1,
        blk: 1,
      }),
    );
  });

  test("keeps six regular games when a player also has playoff and final games", () => {
    const sixGameSchedule = [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: index + 1,
        label: "League",
      })),
      { id: 7, label: "Playoff", playoffType: "sf1" },
      { id: 8, label: "Final", playoffType: "final" },
    ];
    const gamesByMatch = Object.fromEntries(
      sixGameSchedule.map((match) => [match.id, game(match.id)]),
    );
    const result = buildRegularSeasonStatRows(
      { p1: { playerId: "p1", gamesByMatch } },
      sixGameSchedule,
    );

    expect(result.rows[0].games).toBe(6);
    expect(result.rows[0].appearances).toBe(6);
    expect(result.rows[0].pts).toBe(60);
  });

  test("ranking is fair to players who did not reach postseason", () => {
    const result = buildRegularSeasonStatRows(
      {
        finalist: {
          playerId: "finalist",
          gamesByMatch: {
            1: game(1, { pts: 5 }),
            2: game(2, { pts: 5 }),
            3: game(3, { pts: 100 }),
            4: game(4, { pts: 100 }),
          },
        },
        regularLeader: {
          playerId: "regularLeader",
          gamesByMatch: {
            1: game(1, { pts: 20 }),
            2: game(2, { pts: 20 }),
          },
        },
      },
      schedule,
    );

    expect(sortMvpRanking(result.rows)[0].playerId).toBe("regularLeader");
  });

  test("does not synthesize regular stats for legacy totals without per-match data", () => {
    const result = buildRegularSeasonStatRows(
      { legacy: { playerId: "legacy", games: 8, pts: 100 } },
      schedule,
    );

    expect(result).toEqual({ available: false, rows: [] });
  });
});
