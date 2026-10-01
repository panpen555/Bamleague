import { normalizeTeamSource } from "./manualPlayoffService";
import { classifyScheduleMatchPhase } from "../stats/regularSeasonMvpService";
import { calculateStandingsFromMatches } from "../standings/standingsService";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

const isValidWeek = (week) => {
  const value = Number(week);
  return Number.isInteger(value) && value > 0;
};

export const isReliableFinishedMatch = (match) =>
  match?.status === "Finished" &&
  String(match?.scoreA ?? "").trim() !== "" &&
  match?.scoreA !== null &&
  match?.scoreA !== undefined &&
  String(match?.scoreB ?? "").trim() !== "" &&
  match?.scoreB !== null &&
  match?.scoreB !== undefined &&
  Number.isFinite(Number(match.scoreA)) &&
  Number.isFinite(Number(match.scoreB));

export const splitPublicScheduleByPhase = (schedule = []) => {
  const regularMatches = [];
  const postseasonMatches = [];
  const unknownMatches = [];

  (Array.isArray(schedule) ? schedule : []).forEach((match, index) => {
    const projected = { ...match, displayOrder: index + 1 };
    const phase = classifyScheduleMatchPhase(match);
    if (phase === "regular") regularMatches.push(projected);
    else if (phase === "postseason") postseasonMatches.push(projected);
    else unknownMatches.push(projected);
  });

  return { regularMatches, postseasonMatches, unknownMatches };
};

export const groupRegularScheduleByWeek = (matches = []) => {
  const groups = [];
  matches.forEach((match, index) => {
    const legacy = !isValidWeek(match.week);
    const week = legacy ? null : Number(match.week);
    const previous = groups[groups.length - 1];
    if (previous && previous.legacy === legacy && previous.week === week) {
      previous.matches.push(match);
      return;
    }
    groups.push({
      key: `${legacy ? "legacy" : `week-${week}`}-${index}`,
      week,
      matches: [match],
      legacy,
    });
  });

  return groups;
};

const buildRankMap = (standings = []) =>
  standings.reduce((result, row, index) => {
    result[row.team] = index + 1;
    return result;
  }, {});

const buildMovementMap = (rankByTeam, previousRankByTeam) =>
  Object.keys(rankByTeam).reduce((result, teamName) => {
    const rank = rankByTeam[teamName];
    const previousRank = previousRankByTeam[teamName];
    result[teamName] =
      previousRank === undefined
        ? "new"
        : rank < previousRank
          ? "up"
          : rank > previousRank
            ? "down"
            : "same";
    return result;
  }, {});

export const buildWeeklyStandingsSnapshots = (schedule = [], teams = []) => {
  const regularMatches = (Array.isArray(schedule) ? schedule : []).filter(
    (match) => classifyScheduleMatchPhase(match) === "regular",
  );
  if (regularMatches.some((match) => !isValidWeek(match.week))) {
    return { available: false, reason: "legacy-week", snapshotsByWeek: {} };
  }

  const weeks = [...new Set(regularMatches.map((match) => Number(match.week)))].sort(
    (a, b) => a - b,
  );
  const snapshotsByWeek = {};
  let previousAvailableRankByTeam = {};

  weeks.forEach((week, weekIndex) => {
    const earlierMatches = regularMatches.filter(
      (match) => Number(match.week) < week,
    );
    const incompleteMatch = earlierMatches.find(
      (match) => !isReliableFinishedMatch(match),
    );
    const incompleteWeek = incompleteMatch ? Number(incompleteMatch.week) : null;

    if (weekIndex === 0) {
      snapshotsByWeek[week] = {
        week,
        available: false,
        reason: "first-week",
        waitingForWeek: null,
        standings: [],
        rankByTeam: {},
        previousRankByTeam: {},
        movementByTeam: {},
      };
      return;
    }

    if (incompleteMatch) {
      snapshotsByWeek[week] = {
        week,
        available: false,
        reason: "waiting-for-results",
        waitingForWeek: incompleteWeek,
        standings: [],
        rankByTeam: {},
        previousRankByTeam: { ...previousAvailableRankByTeam },
        movementByTeam: {},
      };
      return;
    }

    const standings = calculateStandingsFromMatches(teams, earlierMatches);
    const rankByTeam = buildRankMap(standings);
    const previousRankByTeam = { ...previousAvailableRankByTeam };
    snapshotsByWeek[week] = {
      week,
      available: true,
      reason: "complete",
      waitingForWeek: null,
      standings,
      rankByTeam,
      previousRankByTeam,
      movementByTeam: buildMovementMap(rankByTeam, previousRankByTeam),
    };
    previousAvailableRankByTeam = rankByTeam;
  });

  return { available: true, reason: "", snapshotsByWeek };
};

const PHASE_ORDER = {
  "play in": 10,
  playin: 10,
  quarterfinal: 20,
  "quarter final": 20,
  playoff: 30,
  "semi final": 40,
  semifinal: 40,
  final: 50,
  finals: 50,
  "3rd place": 60,
  "third place": 60,
};

const getPostseasonPhase = (match) => {
  const normalized = normalizeText(match.playoffType || match.label);
  const displayLabel = String(match.label || match.playoffType || "Postseason");
  return {
    key: normalized || "postseason",
    label: displayLabel,
    order: PHASE_ORDER[normalized] ?? 45,
    isFinal: ["final", "finals"].includes(normalized),
    isThirdPlace: ["3rd place", "third place"].includes(normalized),
  };
};

const getExplicitSources = (match) => [
  { side: "teamA", source: match.teamASource },
  { side: "teamB", source: match.teamBSource },
];

export const buildPostseasonBracketModel = (schedule = []) => {
  const { postseasonMatches } = splitPublicScheduleByPhase(schedule);
  const phasesByKey = new Map();
  const edges = [];
  let hasExplicitRelationships = false;

  postseasonMatches.forEach((match) => {
    const phase = getPostseasonPhase(match);
    if (!phasesByKey.has(phase.key)) {
      phasesByKey.set(phase.key, {
        ...phase,
        firstDisplayOrder: match.displayOrder,
        matches: [],
      });
    }
    const sources = getExplicitSources(match).map(({ side, source }) => ({
      side,
      source: normalizeTeamSource(source),
    }));
    phasesByKey.get(phase.key).matches.push({ ...match, sources });

    sources.forEach(({ side, source }) => {
      if (["winner", "loser"].includes(source.type) && source.matchId !== "") {
        hasExplicitRelationships = true;
        edges.push({
          fromMatchId: String(source.matchId),
          toMatchId: String(match.id),
          toSide: side,
          sourceType: source.type,
        });
      } else if (source.type === "bestLoser" && source.matchIds.length > 0) {
        hasExplicitRelationships = true;
        source.matchIds.forEach((sourceId) => {
          edges.push({
            fromMatchId: String(sourceId),
            toMatchId: String(match.id),
            toSide: side,
            sourceType: "bestLoser",
          });
        });
      }
    });
  });

  const phases = [...phasesByKey.values()].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.firstDisplayOrder - b.firstDisplayOrder;
  });

  return {
    matches: postseasonMatches,
    phases,
    edges: hasExplicitRelationships ? edges : [],
    hasExplicitRelationships,
  };
};

export const getWeekStatus = (matches = [], snapshot = null) => {
  if (snapshot?.reason === "waiting-for-results") return "Waiting for previous results";
  const finished = matches.filter(isReliableFinishedMatch).length;
  if (finished === matches.length && matches.length > 0) return "Completed";
  if (finished > 0) return "In Progress";
  return "Upcoming";
};

