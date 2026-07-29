import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
  FIREBASE_CONFIG_META,
  SCHEMA_V3,
} from "../../config/firebase";
import {
  detectCloudSchemaVersion,
  normalizeSchemaV3Backup,
} from "./schemaV3Mapper";

const getExistingDocumentData = async (documentReference) => {
  const snapshot = await getDoc(documentReference);
  return snapshot.exists() ? snapshot.data() : null;
};

export const downloadSchemaV3Main = async () =>
  getExistingDocumentData(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.league,
      FIREBASE_CONFIG_META.documents.main,
    ),
  );

export const downloadSchemaV3Season = async (documentId) => {
  const normalizedDocumentId = String(documentId || "").trim();
  if (!normalizedDocumentId || normalizedDocumentId.includes("/")) {
    throw new Error("Invalid Schema V3 season document ID.");
  }

  return getExistingDocumentData(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.seasonsV3,
      normalizedDocumentId,
    ),
  );
};

export const downloadAllSchemaV3Seasons = async () => {
  const snapshot = await getDocs(
    collection(db, FIREBASE_CONFIG_META.collections.seasonsV3),
  );

  return snapshot.docs.map((seasonDocument) => ({
    documentId: seasonDocument.id,
    data: seasonDocument.data(),
  }));
};

export const downloadSchemaV3AdminReplay = async () =>
  getExistingDocumentData(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.adminV3,
      FIREBASE_CONFIG_META.documents.liveReplays,
    ),
  );

export const assembleSchemaV3LogicalBackup = async (
  mainPayload,
  { includeAdminReplay = false } = {},
) => {
  if (detectCloudSchemaVersion(mainPayload) !== SCHEMA_V3) {
    throw new Error("Cannot assemble Schema V3 backup from a legacy payload.");
  }

  const seasonDocuments = await downloadAllSchemaV3Seasons();
  const replayDocument = includeAdminReplay
    ? await downloadSchemaV3AdminReplay()
    : null;

  return normalizeSchemaV3Backup(
    mainPayload,
    seasonDocuments,
    replayDocument,
  );
};
