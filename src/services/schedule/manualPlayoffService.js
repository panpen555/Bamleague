import {
  createNextManualMatchId,
  matchHasCompetitionData,
  normalizeManualWeek,
} from "./scheduleService";

export const PLAYOFF_MODE_STANDARD = "standard";
export const PLAYOFF_MODE_MANUAL = "manual";
export const TEAM_SOURCE_TYPES = [
  "team",
  "seed",
  "winner",
  "loser",
  "bestLoser",
  "tbd",
];

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

export const getPlayoffTypeFromLabel = (label) => {
  const normalized = normalizeText(label);
  if (normalized === "play in" || normalized === "playin") return "play_in";
  if (normalized === "quarterfinal" || normalized === "quarter final") return "quarterfinal";
  if (normalized === "semi final" || normalized === "semifinal") return "semi_final";
  if (normalized === "final" || normalized === "finals") return "final";
  if (normalized === "3rd place" || normalized === "third place") return "third_place";
  return "custom_postseason";
};

export const createTbdTeamSource = () => ({ type: "tbd" });

export const normalizeTeamSource = (source) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return createTbdTeamSource();
  }
  const type = TEAM_SOURCE_TYPES.includes(source.type) ? source.type : "tbd";
  if (type === "team") return { type, teamName: String(source.teamName || "") };
  if (type === "seed") return { type, seed: Number(source.seed || 1) };
  if (type === "winner" || type === "loser") {
    return { type, matchId: source.matchId ?? "" };
  }
  if (type === "bestLoser") {
    return {
      type,
      matchIds: Array.isArray(source.matchIds)
        ? [...new Set(source.matchIds.map((id) => String(id)).filter(Boolean))]
        : [],
      selectedTeam: String(source.selectedTeam || ""),
    };
  }
  return createTbdTeamSource();
};

export const createManualPlayoffMatch = (
  schedule = [],
  { week, label = "Play-in" } = {},
) => {
  const maxWeek = Math.max(0, ...schedule.map((match) => Number(match.week) || 0));
  const safeWeek = normalizeManualWeek(week) ?? Math.max(1, maxWeek);
  return {
    id: createNextManualMatchId(schedule),
    week: safeWeek,
    label,
    phase: "postseason",
    playoffType: getPlayoffTypeFromLabel(label),
    manualPlayoff: true,
    teamASource: createTbdTeamSource(),
    teamBSource: createTbdTeamSource(),
    teamA: "TBD",
    teamB: "TBD",
    scoreA: "",
    scoreB: "",
    status: "Pending",
  };
};

export const getFinishedMatchOutcome = (match) => {
  if (
    !match ||
    match.status !== "Finished" ||
    match.scoreA === "" ||
    match.scoreB === ""
  ) {
    return { status: "pending", winner: "", loser: "" };
  }
  const scoreA = Number(match.scoreA);
  const scoreB = Number(match.scoreB);
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB) {
    return { status: "tie", winner: "", loser: "" };
  }
  return {
    status: "resolved",
    winner: scoreA > scoreB ? match.teamA : match.teamB,
    loser: scoreA > scoreB ? match.teamB : match.teamA,
  };
};

export const getBestLoserCandidates = (source, schedule = []) => {
  const normalized = normalizeTeamSource(source);
  if (normalized.type !== "bestLoser" || normalized.matchIds.length === 0) {
    return { ready: false, candidates: [], error: "Select the source matches first" };
  }
  const scheduleById = new Map(schedule.map((match) => [String(match.id), match]));
  const candidates = [];
  for (const matchId of normalized.matchIds) {
    const match = scheduleById.get(String(matchId));
    if (!match) return { ready: false, candidates: [], error: `Source match ${matchId} was not found` };
    const outcome = getFinishedMatchOutcome(match);
    if (outcome.status === "pending") {
      return { ready: false, candidates: [], error: "All selected source matches must be Finished" };
    }
    if (outcome.status === "tie") {
      return { ready: false, candidates: [], error: `Source match ${matchId} is tied` };
    }
    if (outcome.loser && !candidates.includes(outcome.loser)) candidates.push(outcome.loser);
  }
  return { ready: true, candidates, error: "" };
};

export const resolveTeamSource = (
  source,
  { schedule = [], standings = [] } = {},
) => {
  const normalized = normalizeTeamSource(source);
  if (normalized.type === "tbd") return { teamName: "TBD", status: "pending", error: "" };
  if (normalized.type === "team") {
    return normalized.teamName
      ? { teamName: normalized.teamName, status: "resolved", error: "" }
      : { teamName: "TBD", status: "pending", error: "Select a team" };
  }
  if (normalized.type === "seed") {
    const seed = Number(normalized.seed);
    const teamName = standings[seed - 1]?.team || "";
    return teamName
      ? { teamName, status: "resolved", error: "" }
      : { teamName: "TBD", status: "pending", error: `Seed ${seed} is not available` };
  }
  if (normalized.type === "bestLoser") {
    const result = getBestLoserCandidates(normalized, schedule);
    if (!result.ready) return { teamName: "TBD", status: "pending", error: result.error, candidates: [] };
    if (!normalized.selectedTeam) {
      return { teamName: "TBD", status: "pending", error: "Admin must select the Best Loser", candidates: result.candidates };
    }
    if (!result.candidates.includes(normalized.selectedTeam)) {
      return { teamName: "TBD", status: "invalid", error: "The selected Best Loser is no longer eligible", candidates: result.candidates };
    }
    return { teamName: normalized.selectedTeam, status: "resolved", error: "", candidates: result.candidates };
  }

  const sourceMatch = schedule.find(
    (match) => String(match.id) === String(normalized.matchId),
  );
  if (!sourceMatch) return { teamName: "TBD", status: "invalid", error: "Source match was not found" };
  const outcome = getFinishedMatchOutcome(sourceMatch);
  if (outcome.status === "pending") return { teamName: "TBD", status: "pending", error: "Source match is not Finished" };
  if (outcome.status === "tie") return { teamName: "TBD", status: "invalid", error: "Playoff source match cannot end in a tie" };
  return {
    teamName: normalized.type === "winner" ? outcome.winner : outcome.loser,
    status: "resolved",
    error: "",
  };
};

export const validateManualPlayoffSchedule = (schedule = []) => {
  const errors = [];
  const ids = new Set(schedule.map((match) => String(match.id)));
  const manualMatches = schedule.filter((match) => match.manualPlayoff === true);
  const dependencies = new Map();

  manualMatches.forEach((match) => {
    if (match.phase !== "postseason") errors.push(`Match ${match.id} must be marked as postseason`);
    if (normalizeManualWeek(match.week) === null) errors.push(`Match ${match.id} has an invalid Week`);
    if (!String(match.label || "").trim()) errors.push(`Match ${match.id} needs a phase/label`);
    const refs = [];
    [match.teamASource, match.teamBSource].forEach((rawSource) => {
      const source = normalizeTeamSource(rawSource);
      const sourceIds = source.type === "bestLoser" ? source.matchIds : [source.matchId];
      if (["winner", "loser", "bestLoser"].includes(source.type)) {
        sourceIds.filter(Boolean).forEach((sourceId) => {
          if (!ids.has(String(sourceId))) errors.push(`Match ${match.id} references missing match ${sourceId}`);
          if (String(sourceId) === String(match.id)) errors.push(`Match ${match.id} cannot reference itself`);
          refs.push(String(sourceId));
        });
      }
    });
    dependencies.set(String(match.id), refs);
  });

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) { errors.push(`Playoff source cycle detected at match ${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    (dependencies.get(id) || []).forEach((dependencyId) => {
      if (dependencies.has(dependencyId)) visit(dependencyId);
    });
    visiting.delete(id);
    visited.add(id);
  };
  dependencies.forEach((_, id) => visit(id));
  return { valid: errors.length === 0, errors };
};

export const resolveManualPlayoffSchedule = (
  schedule = [],
  standings = [],
  dependentData = {},
) => {
  const validation = validateManualPlayoffSchedule(schedule);
  if (!validation.valid) return { schedule: schedule.map((match) => ({ ...match })), errors: validation.errors, blockedMatchIds: [] };
  let resolvedSchedule = schedule.map((match) => ({ ...match }));
  const errors = [];
  const blockedMatchIds = [];

  for (let pass = 0; pass < Math.max(1, schedule.length); pass += 1) {
    let changed = false;
    resolvedSchedule = resolvedSchedule.map((match) => {
      if (match.manualPlayoff !== true) return match;
      const sourceA = resolveTeamSource(match.teamASource, { schedule: resolvedSchedule, standings });
      const sourceB = resolveTeamSource(match.teamBSource, { schedule: resolvedSchedule, standings });
      const nextTeamA = sourceA.teamName || "TBD";
      const nextTeamB = sourceB.teamName || "TBD";
      if (sourceA.error && sourceA.status === "invalid") errors.push(`Match ${match.id} Team A: ${sourceA.error}`);
      if (sourceB.error && sourceB.status === "invalid") errors.push(`Match ${match.id} Team B: ${sourceB.error}`);
      if (nextTeamA === match.teamA && nextTeamB === match.teamB) return match;
      if (matchHasCompetitionData(match, dependentData)) {
        blockedMatchIds.push(String(match.id));
        return match;
      }
      changed = true;
      return { ...match, teamA: nextTeamA, teamB: nextTeamB };
    });
    if (!changed) break;
  }

  if (blockedMatchIds.length > 0) {
    errors.push(`Clear the roster, score, and stats for match ${[...new Set(blockedMatchIds)].join(", ")} before changing its resolved teams`);
  }
  return {
    schedule: resolvedSchedule,
    errors: [...new Set(errors)],
    blockedMatchIds: [...new Set(blockedMatchIds)],
  };
};