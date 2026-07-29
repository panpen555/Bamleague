import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { APP_CONFIG } from "../../config/app";
import { FIREBASE_CONFIG_META } from "../../config/firebase";
import { deepSanitizeForFirestore } from "./schemaV3Mapper";

export const sanitizeBackupData = (data = {}) => {
  return deepSanitizeForFirestore(data);
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
    doc(
      db,
      FIREBASE_CONFIG_META.collections.league,
      FIREBASE_CONFIG_META.documents.main,
    ),
    JSON.parse(JSON.stringify(payload)),
  );

  return payload;
};

export const downloadLeagueBackup = async () => {
  const snap = await getDoc(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.league,
      FIREBASE_CONFIG_META.documents.main,
    ),
  );

  if (!snap.exists()) return null;

  return snap.data();
};

export const clearLeagueBackup = async () => {
  await deleteDoc(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.league,
      FIREBASE_CONFIG_META.documents.main,
    ),
  );
};
