import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { APP_CONFIG } from "../../config/app";
import { FIREBASE_CONFIG_META } from "../../config/firebase";

const isBase64Image = (value) => {
  return typeof value === "string" && value.startsWith("data:image/");
};

const removeBase64FromPlayer = (player) => {
  if (!player || typeof player !== "object") return player;

  return {
    ...player,
    photoUrl: isBase64Image(player.photoUrl) ? "" : player.photoUrl || "",
  };
};

const removeBase64FromTeam = (team) => {
  if (!team || typeof team !== "object") return team;

  return {
    ...team,
    players: Array.isArray(team.players)
      ? team.players.map(removeBase64FromPlayer)
      : [],
  };
};

const removeBase64FromTeamLogos = (teamLogos = {}) => {
  return Object.fromEntries(
    Object.entries(teamLogos).map(([teamName, logoUrl]) => [
      teamName,
      isBase64Image(logoUrl) ? "" : logoUrl,
    ])
  );
};

export const sanitizeBackupData = (data = {}) => {
  return {
    ...data,
    players: Array.isArray(data.players)
      ? data.players.map(removeBase64FromPlayer)
      : [],
    teams: Array.isArray(data.teams)
      ? data.teams.map(removeBase64FromTeam)
      : [],
    teamLogos: removeBase64FromTeamLogos(data.teamLogos || {}),
  };
};

export const createBackupPayload = (data) => {
  return {
    app: "BAM_LEAGUE_SYSTEM",
    appName: APP_CONFIG.name,
    version: APP_CONFIG.version,
    phase: APP_CONFIG.phase,
    updatedAt: new Date().toISOString(),
    data: sanitizeBackupData(data),
  };
};

export const uploadLeagueBackup = async (data) => {
  const payload = createBackupPayload(data);

  await setDoc(
    doc(db, FIREBASE_CONFIG_META.collections.league, "main"),
    JSON.parse(JSON.stringify(payload))
  );

  return payload;
};

export const downloadLeagueBackup = async () => {
  const snap = await getDoc(
    doc(db, FIREBASE_CONFIG_META.collections.league, "main")
  );

  if (!snap.exists()) return null;

  return snap.data();
};

export const clearLeagueBackup = async () => {
  await deleteDoc(doc(db, FIREBASE_CONFIG_META.collections.league, "main"));
};
