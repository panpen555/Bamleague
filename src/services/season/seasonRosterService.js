export const getSeasonRosterPlayerIdentity = (player = {}) => {
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

export const getSeasonRosterPlayers = (teams = []) => {
  if (!Array.isArray(teams)) return [];

  const seenKeys = new Set();
  const seenIds = new Set();
  const seenBamPlayerIds = new Set();
  const rosterPlayers = [];

  teams.forEach((team) => {
    if (!Array.isArray(team?.players)) return;

    team.players.forEach((player) => {
      const identity = getSeasonRosterPlayerIdentity(player);
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
      rosterPlayers.push({
        ...player,
        teamName: team?.name || player.teamName || "",
        seasonRosterKey: identity.key,
      });
    });
  });

  return rosterPlayers;
};

export const getSeasonRosterPlayerIds = (teams = []) =>
  getSeasonRosterPlayers(teams).map(
    (player) => getSeasonRosterPlayerIdentity(player).key,
  );

export const getSeasonRosterPlayerCount = (teams = []) =>
  getSeasonRosterPlayers(teams).length;

export const getSeasonRosterPlayerCountState = (teams) => {
  if (Array.isArray(teams) && teams.length === 0) {
    return {
      available: true,
      count: 0,
      playerIds: [],
    };
  }
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
