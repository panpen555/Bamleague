export const calculateStandingsFromMatches = (teams = [], matches = []) => {
  if (!Array.isArray(teams) || teams.length === 0) return [];

  const table = {};
  teams.forEach((team) => {
    table[team.name] = {
      team: team.name,
      played: 0,
      win: 0,
      loss: 0,
      pf: 0,
      pa: 0,
      diff: 0,
    };
  });

  (Array.isArray(matches) ? matches : []).forEach((match) => {
    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);
    if (!table[match.teamA] || !table[match.teamB]) return;

    table[match.teamA].played += 1;
    table[match.teamB].played += 1;
    table[match.teamA].pf += scoreA;
    table[match.teamA].pa += scoreB;
    table[match.teamB].pf += scoreB;
    table[match.teamB].pa += scoreA;

    if (scoreA > scoreB) {
      table[match.teamA].win += 1;
      table[match.teamB].loss += 1;
    } else if (scoreB > scoreA) {
      table[match.teamB].win += 1;
      table[match.teamA].loss += 1;
    }
  });

  return Object.values(table)
    .map((row) => ({ ...row, diff: row.pf - row.pa }))
    .sort((a, b) => {
      if (b.win !== a.win) return b.win - a.win;
      if (b.diff !== a.diff) return b.diff - a.diff;
      return b.pf - a.pf;
    });
};

