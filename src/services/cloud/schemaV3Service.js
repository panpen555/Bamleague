import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  FIREBASE_CONFIG_META,
  SCHEMA_V3,
} from "../../config/firebase";
import {
  detectCloudSchemaVersion,
  estimateFirestorePayloadBytes,
  FIRESTORE_BLOCK_BYTES,
  normalizeSchemaV3Backup,
  verifySchemaV3StagingSnapshot,
} from "./schemaV3Mapper";

export const SCHEMA_V3_BATCH_OPERATION_LIMIT = 400;

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

export const downloadSchemaV2RecoveryDocument = async () =>
  getExistingDocumentData(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.adminV3,
      FIREBASE_CONFIG_META.documents.schemaV2Backup,
    ),
  );

export const downloadSchemaV3MigrationState = async () =>
  getExistingDocumentData(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.adminV3,
      FIREBASE_CONFIG_META.documents.schemaV3Migration,
    ),
  );

export const writeSchemaV2RecoveryDocument = async (recoveryDocument) => {
  const estimatedBytes = estimateFirestorePayloadBytes(recoveryDocument);
  if (estimatedBytes >= FIRESTORE_BLOCK_BYTES) {
    throw new Error(
      `Cloud recovery document is blocked at ${estimatedBytes} bytes.`,
    );
  }

  await setDoc(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.adminV3,
      FIREBASE_CONFIG_META.documents.schemaV2Backup,
    ),
    recoveryDocument,
  );

  return { estimatedBytes };
};

export const stageSchemaV3SeasonDocuments = async (seasonDocuments = []) => {
  const entries = Array.isArray(seasonDocuments) ? seasonDocuments : [];

  for (
    let offset = 0;
    offset < entries.length;
    offset += SCHEMA_V3_BATCH_OPERATION_LIMIT
  ) {
    const batch = writeBatch(db);
    entries
      .slice(offset, offset + SCHEMA_V3_BATCH_OPERATION_LIMIT)
      .forEach((entry) => {
        batch.set(
          doc(
            db,
            FIREBASE_CONFIG_META.collections.seasonsV3,
            entry.documentId,
          ),
          entry.data,
        );
      });
    await batch.commit();
  }

  return { stagedCount: entries.length };
};

export const stageSchemaV3ReplayDocument = async (replayDocument) => {
  await setDoc(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.adminV3,
      FIREBASE_CONFIG_META.documents.liveReplays,
    ),
    replayDocument,
  );
};

export const writeSchemaV3MigrationState = async (migrationState) => {
  await setDoc(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.adminV3,
      FIREBASE_CONFIG_META.documents.schemaV3Migration,
    ),
    migrationState,
  );
};

export const verifySchemaV3Staging = async (plan) => {
  const [recoveryDocument, seasonDocuments, replayDocument] =
    await Promise.all([
      downloadSchemaV2RecoveryDocument(),
      downloadAllSchemaV3Seasons(),
      downloadSchemaV3AdminReplay(),
    ]);

  return verifySchemaV3StagingSnapshot(plan, {
    recoveryDocument,
    seasonDocuments,
    replayDocument,
  });
};

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
