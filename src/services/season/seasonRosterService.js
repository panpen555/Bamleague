const getRosterIdentity = (player = {}) => {
  const id = String(player.id || "").trim();
  const bamPlayerId = String(player.bamPlayerId || "").trim();

  if (id) {
    return { key: `id:${id}`, id, bamPlayerId };
  }

  if (bamPlayerId) {
    return { key: `bam:${bamPlayerId}`, id, bamPlayerId };
  }

  return { key: "", id: "", bamPlayerId: "" };
};

export const hasReliableSeasonTeamRosters = (teams) =>
  Array.isArray(teams) &&
  teams.length > 0 &&
  teams.every((team) => Array.isArray(team?.players));

export const getSeasonRosterPlayerIds = (teams = []) => {
  if (!Array.isArray(teams)) return [];

  const seenKeys = new Set();
  const seenIds = new Set();
  const seenBamPlayerIds = new Set();
  const rosterPlayerIds = [];

  teams.forEach((team) => {
    if (!Array.isArray(team?.players)) return;

    team.players.forEach((player) => {
      const identity = getRosterIdentity(player);
      if (!identity.key) return;

      const alreadySeenById = identity.id && seenIds.has(identity.id);
      const alreadySeenByBamId =
        identity.bamPlayerId && seenBamPlayerIds.has(identity.bamPlayerId);

      if (
        seenKeys.has(identity.key) ||
        alreadySeenById ||
        alreadySeenByBamId
      ) {
        return;
      }

      seenKeys.add(identity.key);
      if (identity.id) seenIds.add(identity.id);
      if (identity.bamPlayerId) seenBamPlayerIds.add(identity.bamPlayerId);
      rosterPlayerIds.push(identity.key);
    });
  });

  return rosterPlayerIds;
};

export const getSeasonRosterPlayerCount = (teams = []) =>
  getSeasonRosterPlayerIds(teams).length;

export const getSeasonRosterPlayerCountState = (teams) => {
  if (!hasReliableSeasonTeamRosters(teams)) {
    return {
      available: false,
      count: null,
      playerIds: [],
    };
  }

  const playerIds = getSeasonRosterPlayerIds(teams);
  return {
    available: true,
    count: playerIds.length,
    playerIds,
  };
};
