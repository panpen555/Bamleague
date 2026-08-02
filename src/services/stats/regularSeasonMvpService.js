const normalizeMatchLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

const POSTSEASON_LABELS = new Set([
  "playoff",
  "semi final",
  "semifinal",
  "final",
  "finals",
  "3rd place",
  "third place",
]);

export const classifyScheduleMatchPhase = (match) => {
  const label = normalizeMatchLabel(match?.label);
  const playoffType = normalizeMatchLabel(match?.playoffType);

  if (label === "league" || label === "regular season") return "regular";
  if (playoffType || POSTSEASON_LABELS.has(label)) return "postseason";
  return "unknown";
};

export const getRegularSeasonMatchIds = (schedule = []) =>
  new Set(
    (Array.isArray(schedule) ? schedule : [])
      .filter((match) => classifyScheduleMatchPhase(match) === "regular")
      .map((match) => String(match.id)),
  );

export const canCalculateRegularSeasonStats = (
  schedule = [],
  statsObject = {},
) => {
  const matches = Array.isArray(schedule) ? schedule : [];
  if (matches.length === 0) return false;
  if (matches.some((match) => classifyScheduleMatchPhase(match) === "unknown")) {
    return false;
  }

  const stats = Object.values(statsObject || {});
  if (stats.length === 0) return true;
  return stats.every(
    (stat) => stat?.gamesByMatch && typeof stat.gamesByMatch === "object",
  );
};

export const calculateMvpScore = ({
  pts = 0,
  reb = 0,
  ast = 0,
  stl = 0,
  blk = 0,
  appearances = 0,
}) =>
  Number(pts) +
  Number(reb) * 1.2 +
  Number(ast) * 1.5 +
  Number(stl) * 2 +
  Number(blk) * 2 +
  Number(appearances) * 0.75;

export const buildRegularSeasonStatRows = (
  statsObject = {},
  schedule = [],
) => {
  if (!canCalculateRegularSeasonStats(schedule, statsObject)) {
    return { available: false, rows: [] };
  }

  const regularMatchIds = getRegularSeasonMatchIds(schedule);
  const rows = Object.values(statsObject || {}).map((stat) => {
    const regularGames = Object.values(stat?.gamesByMatch || {}).filter((game) =>
      regularMatchIds.has(String(game?.matchId)),
    );
    const totals = regularGames.reduce(
      (result, game) => ({
        games: result.games + (game?.gameCounted ? 1 : 0),
        appearances:
          result.appearances + (game?.appearanceCounted ? 1 : 0),
        pts: result.pts + Number(game?.pts || 0),
        reb: result.reb + Number(game?.reb || 0),
        ast: result.ast + Number(game?.ast || 0),
        stl: result.stl + Number(game?.stl || 0),
        blk: result.blk + Number(game?.blk || 0),
      }),
      { games: 0, appearances: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 },
    );
    const ppg =
      totals.appearances > 0
        ? (totals.pts / totals.appearances).toFixed(1)
        : "0.0";
    const avgStats =
      totals.appearances > 0
        ? (totals.pts + totals.reb + totals.ast + totals.stl + totals.blk) /
          totals.appearances
        : 0;

    return {
      ...stat,
      ...totals,
      ppg,
      avgStats: avgStats.toFixed(1),
      appearanceBonus: totals.appearances * 0.75,
      mvpScore: calculateMvpScore(totals),
    };
  });

  return {
    available: true,
    rows: rows.filter((stat) => Number(stat.games || 0) > 0),
  };
};

export const sortMvpRanking = (rows = []) =>
  [...rows]
    .filter((stat) => Number(stat.mvpScore || 0) > 0)
    .sort((a, b) => {
      if (Number(b.mvpScore || 0) !== Number(a.mvpScore || 0)) {
        return Number(b.mvpScore || 0) - Number(a.mvpScore || 0);
      }
      if (Number(b.pts || 0) !== Number(a.pts || 0)) {
        return Number(b.pts || 0) - Number(a.pts || 0);
      }
      return Number(b.appearances || 0) - Number(a.appearances || 0);
    });
