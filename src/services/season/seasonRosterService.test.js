import {
  getSeasonRosterPlayerCount,
  getSeasonRosterPlayerCountState,
  getSeasonRosterPlayerIds,
  hasReliableSeasonTeamRosters,
} from "./seasonRosterService";

const createPlayers = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    available: index % 2 === 0,
  }));

describe("season roster player selectors", () => {
  test("counts assigned team roster players instead of database players", () => {
    const databasePlayers = createPlayers(12);
    const teams = [
      { name: "Team A", players: databasePlayers.slice(0, 5) },
      { name: "Team B", players: databasePlayers.slice(5, 9) },
    ];

    expect(databasePlayers).toHaveLength(12);
    expect(getSeasonRosterPlayerCount(teams)).toBe(9);
  });

  test("counts assigned players without games, appearances, or playerStats", () => {
    const teams = [
      {
        name: "Team A",
        players: [{ id: "p1", name: "Bench Player", available: true }],
      },
    ];

    expect(getSeasonRosterPlayerCount(teams)).toBe(1);
  });

  test("counts unavailable players if they are assigned to a season team", () => {
    const teams = [
      {
        name: "Team A",
        players: [{ id: "p1", name: "Unavailable", available: false }],
      },
    ];

    expect(getSeasonRosterPlayerCount(teams)).toBe(1);
  });

  test("does not count available players who are not assigned to a team", () => {
    const teams = [{ name: "Team A", players: [] }];
    const availableFreeAgent = { id: "p1", name: "Free Agent", available: true };

    expect(availableFreeAgent.available).toBe(true);
    expect(getSeasonRosterPlayerCount(teams)).toBe(0);
  });

  test("deduplicates the same player within one team and across teams", () => {
    const player = { id: "p1", bamPlayerId: "BAM-000001", name: "Player One" };
    const teams = [
      { name: "Team A", players: [player, { ...player }] },
      { name: "Team B", players: [{ ...player, teamName: "Team B" }] },
    ];

    expect(getSeasonRosterPlayerCount(teams)).toBe(1);
  });

  test("uses player.id as the primary roster identity", () => {
    const teams = [
      {
        name: "Team A",
        players: [
          { id: "p1", bamPlayerId: "BAM-000001" },
          { id: "p2", bamPlayerId: "BAM-000002" },
        ],
      },
    ];

    expect(getSeasonRosterPlayerIds(teams)).toEqual(["id:p1", "id:p2"]);
  });

  test("uses bamPlayerId to deduplicate supported legacy roster data", () => {
    const teams = [
      {
        name: "Team A",
        players: [
          { bamPlayerId: "BAM-000001", name: "Legacy Player" },
          { bamPlayerId: "BAM-000001", name: "Legacy Player Duplicate" },
        ],
      },
      {
        name: "Team B",
        players: [{ id: "legacy-copy", bamPlayerId: "BAM-000001" }],
      },
    ];

    expect(getSeasonRosterPlayerCount(teams)).toBe(1);
  });

  test("skips roster rows without id and bamPlayerId instead of guessing by name", () => {
    const teams = [
      {
        name: "Team A",
        players: [
          { name: "Name Only" },
          { id: "p1", name: "Identified Player" },
        ],
      },
    ];

    expect(getSeasonRosterPlayerIds(teams)).toEqual(["id:p1"]);
  });

  test("marks history without reliable team rosters as unavailable for N/A display", () => {
    expect(hasReliableSeasonTeamRosters(undefined)).toBe(false);
    expect(hasReliableSeasonTeamRosters([{ name: "Legacy Team" }])).toBe(false);
    expect(getSeasonRosterPlayerCountState(undefined)).toEqual({
      available: false,
      count: null,
      playerIds: [],
    });
  });

  test("returns an available count state for current or archived team rosters", () => {
    expect(
      getSeasonRosterPlayerCountState([
        { name: "Team A", players: [{ id: "p1" }] },
        { name: "Team B", players: [{ id: "p2" }] },
      ]),
    ).toEqual({
      available: true,
      count: 2,
      playerIds: ["id:p1", "id:p2"],
    });
  });
});
