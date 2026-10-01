import {
  buildPublicPlayerDirectory,
  filterPublicPlayerDirectory,
  sortPublicPlayerDirectory,
} from "./publicPlayerDirectoryService";

const rosterTeams = [
  {
    name: "Team A",
    players: [
      { id: "p1", bamPlayerId: "BAM-001", name: "Alpha", available: false },
      { id: "p2", bamPlayerId: "BAM-002", name: "Bravo" },
      { id: "p3", bamPlayerId: "BAM-003", name: "Charlie" },
    ],
  },
];

const buildDirectory = (overrides = {}) =>
  buildPublicPlayerDirectory({
    teams: rosterTeams,
    playerSnapshots: [
      { id: "p1", name: "Alpha", photoUrl: "alpha.jpg", shooting: 5 },
      { id: "free", name: "Database Only" },
    ],
    seasonStatRows: [
      { playerId: "p1", appearances: 2, pts: 12, reb: 4 },
      { playerId: "free", appearances: 8, pts: 99 },
    ],
    regularSeasonRows: [
      { playerId: "p2", playerName: "Bravo", mvpScore: 20, pts: 12 },
      { playerId: "p1", playerName: "Alpha", mvpScore: 10, pts: 8 },
    ],
    regularSeasonAvailable: true,
    ...overrides,
  });

describe("public player directory selectors", () => {
  test("uses only season team rosters and keeps roster players without stats", () => {
    const result = buildDirectory();

    expect(result.available).toBe(true);
    expect(result.players.map((player) => player.id)).toEqual(["p1", "p2", "p3"]);
    expect(result.players.some((player) => player.id === "free")).toBe(false);
    expect(result.players.find((player) => player.id === "p1").available).toBe(false);
    expect(result.players.find((player) => player.id === "p3").stats).toEqual(
      expect.objectContaining({ appearances: 0, pts: 0, ppg: "0.0" }),
    );
  });

  test("enriches from exact archived identity without matching by name", () => {
    const result = buildDirectory({
      teams: [{ name: "Old Team", players: [{ id: "old-1", name: "Same Name" }] }],
      playerSnapshots: [
        { id: "other-1", name: "Same Name", shooting: 5 },
        { id: "old-1", name: "Archived Player", shooting: 2 },
      ],
      seasonStatRows: [],
      regularSeasonRows: [],
    });

    expect(result.players[0]).toEqual(
      expect.objectContaining({ id: "old-1", name: "Same Name", shooting: 2 }),
    );
  });

  test("uses exact BAM ID as the legacy identity bridge", () => {
    const result = buildDirectory({
      teams: [{ name: "Old Team", players: [{ id: "old", bamPlayerId: "BAM-X", name: "Legacy" }] }],
      playerSnapshots: [{ id: "snapshot", bamPlayerId: "BAM-X", name: "Snapshot", defense: 4 }],
      seasonStatRows: [{ playerId: "stats", bamPlayerId: "BAM-X", appearances: 1, pts: 7 }],
      regularSeasonRows: [],
    });

    expect(result.players[0]).toEqual(
      expect.objectContaining({ defense: 4, teamName: "Old Team" }),
    );
    expect(result.players[0].stats.pts).toBe(7);
  });

  test("sorts ranked players first and unranked players by name", () => {
    const sorted = sortPublicPlayerDirectory(buildDirectory().players, "mvp");

    expect(sorted.map((player) => player.name)).toEqual([
      "Bravo",
      "Alpha",
      "Charlie",
    ]);
    expect(sorted.map((player) => player.mvpRank)).toEqual([1, 2, null]);
  });

  test("does not use total season stats as the Regular MVP score", () => {
    const result = buildDirectory({
      seasonStatRows: [{ playerId: "p1", appearances: 5, pts: 100, mvpScore: 999 }],
      regularSeasonRows: [{ playerId: "p1", mvpScore: 8, pts: 5 }],
    });

    expect(result.players[0].stats.pts).toBe(100);
    expect(result.players[0].regularSeasonMvpScore).toBe(8);
  });

  test("marks MVP score and rank unavailable for legacy mixed-phase data", () => {
    const result = buildDirectory({ regularSeasonAvailable: false });

    expect(result.players.every((player) => player.mvpRank === null)).toBe(true);
    expect(
      result.players.every((player) => player.regularSeasonMvpScore === null),
    ).toBe(true);
  });

  test("returns unavailable instead of falling back when archived rosters are missing", () => {
    expect(buildDirectory({ teams: [{ name: "Legacy Team" }] })).toEqual({
      available: false,
      players: [],
    });
  });

  test("treats an empty teams array as a valid no-teams state", () => {
    expect(buildDirectory({ teams: [] })).toEqual({
      available: true,
      players: [],
    });
  });

  test("searches name, BAM ID and team and applies the team filter", () => {
    const players = buildDirectory().players;

    expect(filterPublicPlayerDirectory(players, { search: "bam-002" })).toHaveLength(1);
    expect(filterPublicPlayerDirectory(players, { search: "team a" })).toHaveLength(3);
    expect(filterPublicPlayerDirectory(players, { search: "alpha", team: "Team A" })).toHaveLength(1);
    expect(filterPublicPlayerDirectory(players, { team: "Other" })).toHaveLength(0);
  });

  test("attaches awards only by exact player identity", () => {
    const result = buildDirectory({
      awardTargets: [
        { label: "Regular Season MVP", player: { playerId: "p2" } },
        { label: "Top Scorer", player: { playerId: "missing", playerName: "Alpha" } },
      ],
    });

    expect(result.players.find((player) => player.id === "p2").awards).toEqual([
      "Regular Season MVP",
    ]);
    expect(result.players.find((player) => player.id === "p1").awards).toEqual([]);
  });
});
