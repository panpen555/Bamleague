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

export const addManualScheduleMatch = (schedule, teamNames = []) => {
  const names = teamNames.filter(Boolean);
  const teamA = names[0] || "";
  const teamB = names.find((name) => name !== teamA) || "";
  const maxWeek = Math.max(
    0,
    ...(schedule || []).map((match) => Number(match.week) || 0),
  );

  return [
    ...createManualScheduleDraft(schedule),
    {
      id: createNextManualMatchId(schedule),
      week: maxWeek + 1 || 1,
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
  if (matchHasCompetitionData(match, dependentData)) {
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
  if (matchHasCompetitionData(match, dependentData)) {
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
    if (!match?.teamA || !match?.teamB) {
      errors.push(`คู่ที่ ${index + 1} ต้องเลือกทีมให้ครบ`);
    } else if (String(match.teamA) === String(match.teamB)) {
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
  const draftById = new Map(
    draftSchedule.map((match) => [String(match.id), match]),
  );

  originalSchedule.forEach((originalMatch) => {
    if (!matchHasCompetitionData(originalMatch, dependentData)) return;
    const draftMatch = draftById.get(String(originalMatch.id));
    if (!draftMatch) {
      errors.push(
        `เกม ${originalMatch.id} มีข้อมูลการแข่งขันแล้ว จึงลบไม่ได้`,
      );
      return;
    }
    if (
      String(draftMatch.teamA) !== String(originalMatch.teamA) ||
      String(draftMatch.teamB) !== String(originalMatch.teamB)
    ) {
      errors.push(
        `เกม ${originalMatch.id} มีข้อมูลการแข่งขันแล้ว จึงเปลี่ยนทีมไม่ได้`,
      );
    }
  });

  return { valid: errors.length === 0, errors };
};
