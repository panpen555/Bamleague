export const shuffleScheduleTeamNames = (
  teamNames,
  random = Math.random,
) => {
  const shuffledNames = [...teamNames];

  for (let index = shuffledNames.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffledNames[index], shuffledNames[randomIndex]] = [
      shuffledNames[randomIndex],
      shuffledNames[index],
    ];
  }

  return shuffledNames;
};

export const buildScheduleResult = ({
  sourceTeamNames,
  random = Math.random,
}) => {
  const names = shuffleScheduleTeamNames(sourceTeamNames, random);
  const roundRobinNames =
    names.length % 2 === 0 ? [...names] : [...names, "BYE"];
  const totalRounds = roundRobinNames.length - 1;
  const matchesPerRound = roundRobinNames.length / 2;
  const rotated = [...roundRobinNames];
  const newSchedule = [];
  let matchId = 1;

  for (let round = 1; round <= totalRounds; round += 1) {
    for (let matchIndex = 0; matchIndex < matchesPerRound; matchIndex += 1) {
      const teamA = rotated[matchIndex];
      const teamB = rotated[rotated.length - 1 - matchIndex];

      if (teamA !== "BYE" && teamB !== "BYE") {
        newSchedule.push({
          id: matchId,
          week: round,
          label: "League",
          teamA,
          teamB,
          scoreA: "",
          scoreB: "",
          status: "Pending",
        });
        matchId += 1;
      }
    }

    const fixedTeam = rotated[0];
    const restTeams = rotated.slice(1);
    restTeams.unshift(restTeams.pop());
    rotated.splice(0, rotated.length, fixedTeam, ...restTeams);
  }

  const playoffStartWeek = totalRounds + 1;

  if (names.length === 3) {
    newSchedule.push({
      id: matchId,
      week: playoffStartWeek,
      label: "Final",
      playoffType: "final_1v2",
      teamA: "Rank 1",
      teamB: "Rank 2",
      scoreA: "",
      scoreB: "",
      status: "Pending",
    });
  }

  if (names.length >= 4) {
    newSchedule.push(
      {
        id: matchId,
        week: playoffStartWeek,
        label: "Semi Final",
        playoffType: "sf1",
        teamA: "Rank 1",
        teamB: "Rank 4",
        scoreA: "",
        scoreB: "",
        status: "Pending",
      },
      {
        id: matchId + 1,
        week: playoffStartWeek,
        label: "Semi Final",
        playoffType: "sf2",
        teamA: "Rank 2",
        teamB: "Rank 3",
        scoreA: "",
        scoreB: "",
        status: "Pending",
      },
      {
        id: matchId + 2,
        week: playoffStartWeek + 1,
        label: "3rd Place",
        playoffType: "third_place",
        teamA: "Loser SF1",
        teamB: "Loser SF2",
        scoreA: "",
        scoreB: "",
        status: "Pending",
      },
      {
        id: matchId + 3,
        week: playoffStartWeek + 1,
        label: "Final",
        playoffType: "final",
        teamA: "Winner SF1",
        teamB: "Winner SF2",
        scoreA: "",
        scoreB: "",
        status: "Pending",
      },
    );
  }

  return newSchedule;
};

export const createManualScheduleDraft = (schedule = []) =>
  (Array.isArray(schedule) ? schedule : []).map((match) => ({ ...match }));

export const normalizeManualWeek = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const week = Number(value);
  return Number.isSafeInteger(week) && week >= 1 ? week : null;
};

export const updateManualScheduleWeek = (schedule, matchId, weekValue) => {
  const week = normalizeManualWeek(weekValue);
  if (week === null) {
    return {
      schedule: createManualScheduleDraft(schedule),
      error: "Week must be a whole number of 1 or greater",
    };
  }
  return {
    schedule: (schedule || []).map((match) =>
      String(match.id) === String(matchId) ? { ...match, week } : { ...match },
    ),
    error: "",
  };
};

export const projectPublicSchedule = (schedule = []) =>
  (Array.isArray(schedule) ? schedule : []).map((match, index) => ({
    ...match,
    displayOrder: index + 1,
  }));

export const groupPublicScheduleInSavedOrder = (schedule = []) =>
  projectPublicSchedule(schedule).reduce((groups, match) => {
    const week = match.week ?? "-";
    const previousGroup = groups[groups.length - 1];
    if (previousGroup && String(previousGroup.week) === String(week)) {
      previousGroup.matches.push(match);
      return groups;
    }
    groups.push({
      key: `${String(week)}-${groups.length}`,
      week,
      matches: [match],
    });
    return groups;
  }, []);

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value || {}, String(key));

export const matchHasCompetitionData = (
  match,
  { matchRosters = {}, playerStats = {}, matchStatInputs = {} } = {},
) => {
  const matchId = String(match?.id ?? "");
  const hasScore =
    match?.scoreA !== "" &&
    match?.scoreA !== null &&
    match?.scoreA !== undefined;
  const hasOtherScore =
    match?.scoreB !== "" &&
    match?.scoreB !== null &&
    match?.scoreB !== undefined;
  const hasResult =
    String(match?.status || "Pending").toLowerCase() !== "pending";
  const hasRoster = hasOwn(matchRosters, matchId);
  const hasInputs = Object.values(matchStatInputs || {}).some(
    (input) => String(input?.matchId ?? "") === matchId,
  );
  const hasStats = Object.values(playerStats || {}).some((playerStat) => {
    if (hasOwn(playerStat?.gamesByMatch, matchId)) return true;
    return Object.values(playerStat?.gamesByMatch || {}).some(
      (game) => String(game?.matchId ?? "") === matchId,
    );
  });

  return hasScore || hasOtherScore || hasResult || hasRoster || hasInputs || hasStats;
};

export const removeMatchDependentData = (
  { matchRosters = {}, playerStats = {}, matchStatInputs = {} } = {},
  matchIds = [],
) => {
  const targetIds = new Set(matchIds.map((id) => String(id)));
  const nextMatchRosters = Object.fromEntries(
    Object.entries(matchRosters || {}).filter(
      ([matchId]) => !targetIds.has(String(matchId)),
    ),
  );
  const nextMatchStatInputs = Object.fromEntries(
    Object.entries(matchStatInputs || {}).filter(([key, input]) => {
      if (targetIds.has(String(input?.matchId ?? ""))) return false;
      return ![...targetIds].some((matchId) =>
        String(key).startsWith(`${matchId}_`),
      );
    }),
  );
  const nextPlayerStats = Object.fromEntries(
    Object.entries(playerStats || {}).map(([playerId, stat]) => {
      const originalGames = Object.entries(stat?.gamesByMatch || {});
      const remainingGames = originalGames.filter(
        ([matchId, game]) =>
          !targetIds.has(String(matchId)) &&
          !targetIds.has(String(game?.matchId ?? "")),
      );
      if (remainingGames.length === originalGames.length) return [playerId, stat];
      const gamesByMatch = Object.fromEntries(remainingGames);
      const games = Object.values(gamesByMatch);
      return [
        playerId,
        {
          ...stat,
          gamesByMatch,
          games: games.filter((game) => game?.gameCounted).length,
          appearances: games.filter((game) => game?.appearanceCounted).length,
          pts: games.reduce((sum, game) => sum + Number(game?.pts || 0), 0),
          reb: games.reduce((sum, game) => sum + Number(game?.reb || 0), 0),
          ast: games.reduce((sum, game) => sum + Number(game?.ast || 0), 0),
          stl: games.reduce((sum, game) => sum + Number(game?.stl || 0), 0),
          blk: games.reduce((sum, game) => sum + Number(game?.blk || 0), 0),
        },
      ];
    }),
  );

  return {
    matchRosters: nextMatchRosters,
    playerStats: nextPlayerStats,
    matchStatInputs: nextMatchStatInputs,
  };
};
export const moveManualScheduleMatch = (
  schedule,
  matchId,
  targetIndex,
) => {
  const nextSchedule = createManualScheduleDraft(schedule);
  const sourceIndex = nextSchedule.findIndex(
    (match) => String(match.id) === String(matchId),
  );
  const boundedTarget = Math.max(
    0,
    Math.min(Number(targetIndex), nextSchedule.length - 1),
  );
  if (sourceIndex < 0 || sourceIndex === boundedTarget) return nextSchedule;

  const [match] = nextSchedule.splice(sourceIndex, 1);
  nextSchedule.splice(boundedTarget, 0, match);
  return nextSchedule;
};

export const createNextManualMatchId = (schedule = []) => {
  const usedIds = new Set(schedule.map((match) => String(match.id)));
  const numericIds = schedule
    .map((match) => Number(match.id))
    .filter((id) => Number.isSafeInteger(id) && id >= 0);
  let candidate = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
  while (usedIds.has(String(candidate))) candidate += 1;
  return candidate;
};

export const addManualScheduleMatch = (schedule, teamNames = [], requestedWeek) => {
  const names = teamNames.filter(Boolean);
  const teamA = names[0] || "";
  const teamB = names.find((name) => name !== teamA) || "";
  const maxWeek = Math.max(
    0,
    ...(schedule || []).map((match) => Number(match.week) || 0),
  );
  const suggestedWeek = maxWeek || 1;
  const requestedWeekNumber = normalizeManualWeek(requestedWeek);

  return [
    ...createManualScheduleDraft(schedule),
    {
      id: createNextManualMatchId(schedule),
      week: requestedWeekNumber ?? suggestedWeek,
      label: "League",
      teamA,
      teamB,
      scoreA: "",
      scoreB: "",
      status: "Pending",
    },
  ];
};

export const updateManualScheduleTeams = (
  schedule,
  matchId,
  field,
  teamName,
  dependentData,
) => {
  const match = schedule.find(
    (item) => String(item.id) === String(matchId),
  );
  if (!match) return { schedule: createManualScheduleDraft(schedule), error: "ไม่พบเกมที่ต้องการแก้ไข" };
  if (
    matchHasCompetitionData(match, dependentData) &&
    !dependentData?.allowProtectedChange
  ) {
    return {
      schedule: createManualScheduleDraft(schedule),
      error: "เกมนี้มี roster, score, stats หรือผลการแข่งขันแล้ว จึงเปลี่ยนทีมไม่ได้",
    };
  }
  const otherField = field === "teamA" ? "teamB" : "teamA";
  if (String(teamName) === String(match[otherField])) {
    return {
      schedule: createManualScheduleDraft(schedule),
      error: "ทีมเดียวกันไม่สามารถพบตัวเองได้",
    };
  }

  return {
    schedule: schedule.map((item) =>
      String(item.id) === String(matchId)
        ? { ...item, [field]: teamName }
        : { ...item },
    ),
    error: "",
  };
};

export const removeManualScheduleMatch = (
  schedule,
  matchId,
  dependentData,
) => {
  const match = schedule.find(
    (item) => String(item.id) === String(matchId),
  );
  if (!match) return { schedule: createManualScheduleDraft(schedule), error: "ไม่พบเกมที่ต้องการลบ" };
  if (
    matchHasCompetitionData(match, dependentData) &&
    !dependentData?.allowProtectedChange
  ) {
    return {
      schedule: createManualScheduleDraft(schedule),
      error: "เกมนี้มี roster, score, stats หรือผลการแข่งขันแล้ว จึงลบไม่ได้",
    };
  }
  return {
    schedule: schedule
      .filter((item) => String(item.id) !== String(matchId))
      .map((item) => ({ ...item })),
    error: "",
  };
};

export const validateManualSchedule = (schedule = []) => {
  const errors = [];
  const seenIds = new Set();

  schedule.forEach((match, index) => {
    const matchId = String(match?.id ?? "");
    if (!matchId || seenIds.has(matchId)) {
      errors.push(`คู่ที่ ${index + 1} มี matchId ไม่ถูกต้องหรือซ้ำ`);
    }
    seenIds.add(matchId);
    if (normalizeManualWeek(match?.week) === null) {
      errors.push(`Match ${index + 1} must have a whole-number Week of 1 or greater`);
    }
    if (!match?.teamA || !match?.teamB) {
      errors.push(`คู่ที่ ${index + 1} ต้องเลือกทีมให้ครบ`);
    } else if (
      String(match.teamA) === String(match.teamB) &&
      !(match.manualPlayoff === true && match.teamA === "TBD")
    ) {
      errors.push(`คู่ที่ ${index + 1} เป็นทีมเดียวกัน`);
    }
  });

  return { valid: errors.length === 0, errors };
};

export const validateManualScheduleChanges = (
  originalSchedule,
  draftSchedule,
  dependentData,
) => {
  const baseValidation = validateManualSchedule(draftSchedule);
  const errors = [...baseValidation.errors];
  const destructiveMatchIds = [];
  const draftById = new Map(
    draftSchedule.map((match) => [String(match.id), match]),
  );

  originalSchedule.forEach((originalMatch) => {
    if (!matchHasCompetitionData(originalMatch, dependentData)) return;
    const draftMatch = draftById.get(String(originalMatch.id));
    if (!draftMatch) {
      if (dependentData?.allowDestructiveChanges) {
        destructiveMatchIds.push(String(originalMatch.id));
      } else {
        errors.push(`Protected match ${originalMatch.id} cannot be deleted`);
      }
      return;
    }
    if (
      String(draftMatch.teamA) !== String(originalMatch.teamA) ||
      String(draftMatch.teamB) !== String(originalMatch.teamB)
    ) {
      if (dependentData?.allowDestructiveChanges) {
        destructiveMatchIds.push(String(originalMatch.id));
      } else {
        errors.push(`Protected match ${originalMatch.id} cannot change teams`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    destructiveMatchIds: [...new Set(destructiveMatchIds)],
  };
};
