import {
  getSeasonRosterPlayerIdentity,
  getSeasonRosterPlayers,
  hasReliableSeasonTeamRosters,
} from "./seasonRosterService";
import { sortMvpRanking } from "../stats/regularSeasonMvpService";

const cleanIdentityValue = (value) => String(value || "").trim();
const getIdentityValues = (player = {}) => ({
  id: cleanIdentityValue(player.id || player.playerId),
  bamPlayerId: cleanIdentityValue(player.bamPlayerId),
});

export const isSamePublicPlayerIdentity = (left, right) => {
  const leftIdentity = getIdentityValues(left);
  const rightIdentity = getIdentityValues(right);
  if (
    leftIdentity.id &&
    rightIdentity.id &&
    leftIdentity.id === rightIdentity.id
  ) {
    return true;
  }
  return Boolean(
    leftIdentity.bamPlayerId &&
      rightIdentity.bamPlayerId &&
      leftIdentity.bamPlayerId === rightIdentity.bamPlayerId,
  );
};

const findExactPlayer = (rows, player) =>
  (Array.isArray(rows) ? rows : []).find((row) =>
    isSamePublicPlayerIdentity(row, player),
  );
const numberValue = (value) => Number(value || 0);
const buildSeasonStats = (stat) => {
  const appearances = numberValue(stat?.appearances || stat?.games);
  const pts = numberValue(stat?.pts);
  return {
    appearances,
    games: numberValue(stat?.games || appearances),
    pts,
    ppg: appearances > 0 ? (pts / appearances).toFixed(1) : "0.0",
    reb: numberValue(stat?.reb),
    ast: numberValue(stat?.ast),
    stl: numberValue(stat?.stl),
    blk: numberValue(stat?.blk),
  };
};

export const buildPublicPlayerDirectory = ({
  teams,
  playerSnapshots = [],
  seasonStatRows = [],
  regularSeasonRows = [],
  regularSeasonAvailable = true,
  awardTargets = [],
} = {}) => {
  if (Array.isArray(teams) && teams.length === 0) {
    return { available: true, players: [] };
  }
  if (!hasReliableSeasonTeamRosters(teams)) {
    return { available: false, players: [] };
  }
  const rosterPlayers = getSeasonRosterPlayers(teams);
  const rankedPlayers = regularSeasonAvailable
    ? sortMvpRanking(regularSeasonRows)
    : [];
  const players = rosterPlayers.map((rosterPlayer) => {
    const snapshot = findExactPlayer(playerSnapshots, rosterPlayer);
    const seasonStat = findExactPlayer(seasonStatRows, rosterPlayer);
    const regularSeasonStat = findExactPlayer(
      regularSeasonRows,
      rosterPlayer,
    );
    const rankIndex = rankedPlayers.findIndex((row) =>
      isSamePublicPlayerIdentity(row, rosterPlayer),
    );
    const identity = getSeasonRosterPlayerIdentity(rosterPlayer);
    const player = {
      ...(snapshot || {}),
      ...rosterPlayer,
      teamName: rosterPlayer.teamName || snapshot?.teamName || "",
      photoUrl: rosterPlayer.photoUrl || snapshot?.photoUrl || "",
    };
    const awards = awardTargets
      .filter(
        (award) =>
          award?.player &&
          isSamePublicPlayerIdentity(award.player, rosterPlayer),
      )
      .map((award) => award.label);
    return {
      ...player,
      directoryKey: identity.key,
      stats: buildSeasonStats(seasonStat),
      hasSeasonStats: Boolean(seasonStat),
      regularSeasonAvailable: Boolean(regularSeasonAvailable),
      regularSeasonMvpScore: regularSeasonAvailable
        ? numberValue(regularSeasonStat?.mvpScore)
        : null,
      mvpRank:
        regularSeasonAvailable && rankIndex >= 0 ? rankIndex + 1 : null,
      awards,
      profileSource: {
        playerId: rosterPlayer.id,
        bamPlayerId: rosterPlayer.bamPlayerId,
        playerName: rosterPlayer.name,
        name: rosterPlayer.name,
        teamName: rosterPlayer.teamName,
      },
    };
  });
  return { available: true, players };
};

const compareNames = (left, right) =>
  String(left?.name || "").localeCompare(String(right?.name || ""), [
    "th",
    "en",
  ]);

export const sortPublicPlayerDirectory = (players = [], sortBy = "mvp") => {
  const rows = [...players];
  if (sortBy === "pts") {
    return rows.sort(
      (left, right) =>
        Number(right.stats?.pts || 0) - Number(left.stats?.pts || 0) ||
        compareNames(left, right),
    );
  }
  if (sortBy === "ppg") {
    return rows.sort(
      (left, right) =>
        Number(right.stats?.ppg || 0) - Number(left.stats?.ppg || 0) ||
        compareNames(left, right),
    );
  }
  if (sortBy === "name") return rows.sort(compareNames);
  if (sortBy === "team") {
    return rows.sort(
      (left, right) =>
        String(left.teamName || "").localeCompare(
          String(right.teamName || ""),
          ["th", "en"],
        ) || compareNames(left, right),
    );
  }
  return rows.sort((left, right) => {
    const leftRank = left.mvpRank || Number.POSITIVE_INFINITY;
    const rightRank = right.mvpRank || Number.POSITIVE_INFINITY;
    return leftRank - rightRank || compareNames(left, right);
  });
};

export const filterPublicPlayerDirectory = (
  players = [],
  { search = "", team = "ALL" } = {},
) => {
  const normalizedSearch = String(search).trim().toLowerCase();
  return players.filter((player) => {
    if (team !== "ALL" && String(player.teamName || "") !== String(team)) {
      return false;
    }
    if (!normalizedSearch) return true;
    return [player.name, player.bamPlayerId, player.teamName].some((value) =>
      String(value || "").toLowerCase().includes(normalizedSearch),
    );
  });
};
