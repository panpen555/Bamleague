import { calculateStandingsFromMatches } from "./standingsService";

describe("shared standings calculation", () => {
  test("preserves the existing Wins, Differential, then PF ordering", () => {
    const teams = ["A", "B", "C", "D"].map((name) => ({ name }));
    const matches = [
      { teamA: "A", teamB: "D", scoreA: 80, scoreB: 70 },
      { teamA: "B", teamB: "C", scoreA: 90, scoreB: 85 },
    ];
    const standings = calculateStandingsFromMatches(teams, matches);
    expect(standings.map((row) => row.team)).toEqual(["A", "B", "C", "D"]);
    expect(standings[0]).toMatchObject({ win: 1, diff: 10, pf: 80 });
    expect(standings[1]).toMatchObject({ win: 1, diff: 5, pf: 90 });
  });

  test("keeps the existing tied-game behavior without assigning a win or loss", () => {
    const standings = calculateStandingsFromMatches(
      [{ name: "A" }, { name: "B" }],
      [{ teamA: "A", teamB: "B", scoreA: 70, scoreB: 70 }],
    );
    expect(standings[0]).toMatchObject({ played: 1, win: 0, loss: 0, pf: 70, pa: 70 });
    expect(standings[1]).toMatchObject({ played: 1, win: 0, loss: 0, pf: 70, pa: 70 });
  });
});

