import {
  collection,
  deleteDoc,
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
  createPayloadChecksum,
  createSchemaV3MigrationPlan,
  estimateFirestorePayloadBytes,
  FIRESTORE_BLOCK_BYTES,
  mergeSchemaV3SeasonIndexes,
  normalizeSchemaV3Backup,
  validateRecoverySource,
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

const withoutPayloadChecksum = (value) => {
  const clone = { ...(value || {}) };
  delete clone.payloadChecksum;
  return clone;
};

const assertIndexedSeasonsComplete = (mainPayload, seasonDocuments) => {
  const documentsById = new Map(
    seasonDocuments.map((entry) => [entry.documentId, entry.data]),
  );
  const missingIds = mainPayload.data.seasonIndex
    .map((entry) => entry.documentId)
    .filter((documentId) => !documentsById.has(documentId));

  if (missingIds.length > 0) {
    throw new Error(
      `Schema V3 Cloud history is incomplete. Missing: ${missingIds.join(", ")}`,
    );
  }

  mainPayload.data.seasonIndex.forEach((entry) => {
    const seasonDocument = documentsById.get(entry.documentId);
    if (
      Number(seasonDocument?.schemaVersion) !== SCHEMA_V3 ||
      String(seasonDocument?.documentId || "") !== String(entry.documentId)
    ) {
      throw new Error(
        `Malformed indexed season document: ${entry.documentId}`,
      );
    }
    if (
      !seasonDocument.payloadChecksum ||
      createPayloadChecksum(withoutPayloadChecksum(seasonDocument)) !==
        seasonDocument.payloadChecksum
    ) {
      throw new Error(
        `Indexed season checksum mismatch: ${entry.documentId}`,
      );
    }
  });
};

const verifyExpectedSeasonWrites = (expectedDocuments, actualDocuments) => {
  const actualById = new Map(
    actualDocuments.map((entry) => [entry.documentId, entry.data]),
  );

  expectedDocuments.forEach((entry) => {
    const actual = actualById.get(entry.documentId);
    if (!actual) {
      throw new Error(`Season read-back missing: ${entry.documentId}`);
    }
    const actualChecksum = createPayloadChecksum(
      withoutPayloadChecksum(actual),
    );
    if (
      actual.payloadChecksum !== entry.data.payloadChecksum ||
      actualChecksum !== entry.data.payloadChecksum
    ) {
      throw new Error(`Season read-back checksum mismatch: ${entry.documentId}`);
    }
  });
};

const verifyReplayReadBack = (expectedReplay, actualReplay) => {
  if (!actualReplay) throw new Error("Admin replay read-back is missing.");
  const actualChecksum = createPayloadChecksum(
    withoutPayloadChecksum(actualReplay),
  );
  if (
    actualReplay.payloadChecksum !== expectedReplay.payloadChecksum ||
    actualChecksum !== expectedReplay.payloadChecksum
  ) {
    throw new Error("Admin replay read-back checksum mismatch.");
  }
  const expectedSourceDraftSessionId =
    expectedReplay.liveScheduleConfirmedReplay?.sourceDraftSessionId || "";
  const actualSourceDraftSessionId =
    actualReplay.liveScheduleConfirmedReplay?.sourceDraftSessionId || "";
  if (actualSourceDraftSessionId !== expectedSourceDraftSessionId) {
    throw new Error("Admin replay sourceDraftSessionId mismatch.");
  }
};

const writeSchemaV3MainDocument = async (mainPayload) => {
  await setDoc(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.league,
      FIREBASE_CONFIG_META.documents.main,
    ),
    mainPayload,
  );
};

const verifyMainReadBack = (expectedMain, actualMain) => {
  if (detectCloudSchemaVersion(actualMain) !== SCHEMA_V3) {
    throw new Error("Schema V3 main read-back is malformed.");
  }
  if (
    createPayloadChecksum(actualMain) !== createPayloadChecksum(expectedMain)
  ) {
    throw new Error("Schema V3 main read-back checksum mismatch.");
  }
};

export const uploadSchemaV3Backup = async (logicalBackup) => {
  const freshMain = await downloadSchemaV3Main();
  if (!freshMain || detectCloudSchemaVersion(freshMain) !== SCHEMA_V3) {
    throw new Error("V3 upload requires an existing Schema V3 main document.");
  }

  const existingSeasonDocuments = await downloadAllSchemaV3Seasons();
  assertIndexedSeasonsComplete(freshMain, existingSeasonDocuments);

  const localPlan = createSchemaV3MigrationPlan(logicalBackup);
  if (!localPlan.validation.ready) {
    throw new Error(localPlan.validation.errors.join(" "));
  }

  const mergedSeasonIndex = mergeSchemaV3SeasonIndexes(
    freshMain.data.seasonIndex,
    localPlan.mainPayload.data.seasonIndex,
  );
  const operationalMain = {
    ...localPlan.mainPayload,
    data: {
      ...localPlan.mainPayload.data,
      seasonIndex: mergedSeasonIndex,
    },
  };
  const mainBytes = estimateFirestorePayloadBytes(operationalMain);
  if (mainBytes >= FIRESTORE_BLOCK_BYTES) {
    throw new Error(`Schema V3 main is blocked at ${mainBytes} bytes.`);
  }

  await stageSchemaV3SeasonDocuments(localPlan.seasonDocuments);
  const seasonReadBack = await downloadAllSchemaV3Seasons();
  verifyExpectedSeasonWrites(localPlan.seasonDocuments, seasonReadBack);
  assertIndexedSeasonsComplete(operationalMain, seasonReadBack);

  await stageSchemaV3ReplayDocument(localPlan.replayDocument);
  const replayReadBack = await downloadSchemaV3AdminReplay();
  verifyReplayReadBack(localPlan.replayDocument, replayReadBack);

  await writeSchemaV3MainDocument(operationalMain);
  const mainReadBack = await downloadSchemaV3Main();
  verifyMainReadBack(operationalMain, mainReadBack);

  return {
    schemaVersion: SCHEMA_V3,
    seasonCount: mergedSeasonIndex.length,
    warnings: localPlan.validation.warnings,
  };
};

export const promoteSchemaV3Main = async () => {
  const [freshMain, recoveryDocument, migrationState] = await Promise.all([
    downloadSchemaV3Main(),
    downloadSchemaV2RecoveryDocument(),
    downloadSchemaV3MigrationState(),
  ]);
  if (!freshMain || detectCloudSchemaVersion(freshMain) === SCHEMA_V3) {
    throw new Error("Promotion requires the current Cloud main to be Legacy/V2.");
  }
  if (!recoveryDocument) throw new Error("Schema V2 recovery is missing.");
  const recoveryCheck = validateRecoverySource(recoveryDocument, freshMain);
  if (!recoveryCheck.matches) throw new Error(recoveryCheck.error);

  const plan = createSchemaV3MigrationPlan(freshMain);
  if (
    migrationState?.status !== "verified" ||
    migrationState.sourceChecksum !== plan.sourceChecksum
  ) {
    throw new Error("Promotion requires a verified migration state.");
  }
  const verification = await verifySchemaV3Staging(plan);
  if (!verification.verified) {
    throw new Error(verification.errors.join(" "));
  }

  await writeSchemaV3MainDocument(plan.mainPayload);
  const mainReadBack = await downloadSchemaV3Main();
  verifyMainReadBack(plan.mainPayload, mainReadBack);
  await writeSchemaV3MigrationState({
    ...migrationState,
    status: "promoted",
    promotedAt: new Date().toISOString(),
  });

  return { plan, verification };
};

export const rollbackToSchemaV2Main = async () => {
  const [freshMain, recoveryDocument, migrationState] = await Promise.all([
    downloadSchemaV3Main(),
    downloadSchemaV2RecoveryDocument(),
    downloadSchemaV3MigrationState(),
  ]);
  if (!freshMain || detectCloudSchemaVersion(freshMain) !== SCHEMA_V3) {
    throw new Error("Rollback requires the current Cloud main to be Schema V3.");
  }
  if (!recoveryDocument?.payload) {
    throw new Error("Schema V2 recovery payload is missing.");
  }
  if (
    createPayloadChecksum(recoveryDocument.payload) !==
    recoveryDocument.sourceChecksum
  ) {
    throw new Error("Schema V2 recovery checksum mismatch.");
  }
  if (detectCloudSchemaVersion(recoveryDocument.payload) === SCHEMA_V3) {
    throw new Error("Recovery payload is not Legacy/V2.");
  }

  await setDoc(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.league,
      FIREBASE_CONFIG_META.documents.main,
    ),
    recoveryDocument.payload,
  );
  const restoredMain = await downloadSchemaV3Main();
  if (
    !restoredMain ||
    detectCloudSchemaVersion(restoredMain) === SCHEMA_V3 ||
    createPayloadChecksum(restoredMain) !== recoveryDocument.sourceChecksum
  ) {
    throw new Error("Schema V2 rollback read-back verification failed.");
  }
  await writeSchemaV3MigrationState({
    ...(migrationState || {}),
    schemaVersion: SCHEMA_V3,
    status: "rolledBack",
    rolledBackAt: new Date().toISOString(),
  });
};

export const clearSchemaV3Backup = async () => {
  const freshMain = await downloadSchemaV3Main();
  if (!freshMain || detectCloudSchemaVersion(freshMain) !== SCHEMA_V3) {
    throw new Error("V3 clear requires an existing Schema V3 main document.");
  }
  const seasonDocuments = await downloadAllSchemaV3Seasons();

  await deleteDoc(
    doc(
      db,
      FIREBASE_CONFIG_META.collections.league,
      FIREBASE_CONFIG_META.documents.main,
    ),
  );

  const deleteTargets = [
    ...seasonDocuments.map((entry) =>
      doc(
        db,
        FIREBASE_CONFIG_META.collections.seasonsV3,
        entry.documentId,
      ),
    ),
    doc(
      db,
      FIREBASE_CONFIG_META.collections.adminV3,
      FIREBASE_CONFIG_META.documents.liveReplays,
    ),
    doc(
      db,
      FIREBASE_CONFIG_META.collections.adminV3,
      FIREBASE_CONFIG_META.documents.schemaV3Migration,
    ),
    doc(
      db,
      FIREBASE_CONFIG_META.collections.adminV3,
      FIREBASE_CONFIG_META.documents.schemaV2Backup,
    ),
  ];

  for (
    let offset = 0;
    offset < deleteTargets.length;
    offset += SCHEMA_V3_BATCH_OPERATION_LIMIT
  ) {
    const batch = writeBatch(db);
    deleteTargets
      .slice(offset, offset + SCHEMA_V3_BATCH_OPERATION_LIMIT)
      .forEach((reference) => batch.delete(reference));
    await batch.commit();
  }

  const [mainReadBack, seasonsReadBack, replayReadBack, migrationReadBack, recoveryReadBack] =
    await Promise.all([
      downloadSchemaV3Main(),
      downloadAllSchemaV3Seasons(),
      downloadSchemaV3AdminReplay(),
      downloadSchemaV3MigrationState(),
      downloadSchemaV2RecoveryDocument(),
    ]);
  const orphanLabels = [];
  if (mainReadBack) orphanLabels.push("main");
  if (seasonsReadBack.length > 0) {
    orphanLabels.push(`${seasonsReadBack.length} season documents`);
  }
  if (replayReadBack) orphanLabels.push("liveReplays");
  if (migrationReadBack) orphanLabels.push("schemaV3Migration");
  if (recoveryReadBack) orphanLabels.push("schemaV2Backup");
  if (orphanLabels.length > 0) {
    throw new Error(`V3 clear incomplete. Remaining: ${orphanLabels.join(", ")}`);
  }

  return { cleared: true, deletedSeasonCount: seasonDocuments.length };
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
