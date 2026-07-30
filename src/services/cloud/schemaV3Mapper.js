import { SCHEMA_V3 } from "../../config/firebase";

export const FIRESTORE_WARNING_BYTES = 800 * 1024;
export const FIRESTORE_BLOCK_BYTES = 950 * 1024;

const normalizeCompetitionType = (value) =>
  String(value || "").toUpperCase() === "3X3" ? "3x3" : "5x5";

const sanitizeDocumentIdSegment = (value) =>
  String(value || "")
    .trim()
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const stableHash = (value) => {
  let hash = 2166136261;
  const source = String(value || "");

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const canonicalizeForChecksum = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalizeForChecksum);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalizeForChecksum(value[key]);
        return result;
      }, {});
  }
  return value;
};

export const createPayloadChecksum = (value) => {
  const sanitized = deepSanitizeForFirestore(value);
  const canonical = JSON.stringify(canonicalizeForChecksum(sanitized));
  const forwardHash = stableHash(canonical);
  const reverseHash = stableHash(canonical.split("").reverse().join(""));
  return `bam-fnv1a-${forwardHash}${reverseHash}`;
};

export const deepSanitizeForFirestore = (value) => {
  const ancestors = new WeakSet();

  const visit = (current, inArray = false) => {
    if (current === undefined) return inArray ? null : undefined;
    if (current === null) return null;

    if (typeof current === "string") {
      return /^data:image\//i.test(current) ? "" : current;
    }

    if (
      typeof current === "number" ||
      typeof current === "boolean"
    ) {
      return current;
    }

    if (typeof current === "bigint") return current.toString();
    if (typeof current === "function" || typeof current === "symbol") {
      return inArray ? null : undefined;
    }
    if (current instanceof Date) return current.toISOString();
    if (typeof current !== "object") return current;
    if (ancestors.has(current)) return null;

    ancestors.add(current);
    let sanitized;

    if (Array.isArray(current)) {
      sanitized = current.map((item) => visit(item, true));
    } else {
      sanitized = {};
      Object.entries(current).forEach(([key, item]) => {
        const nextValue = visit(item, false);
        if (nextValue !== undefined) sanitized[key] = nextValue;
      });
    }

    ancestors.delete(current);
    return sanitized;
  };

  return visit(value);
};

const RECOVERY_SECRET_KEYS = new Set([
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "credential",
  "credentials",
  "authtoken",
  "serviceaccount",
  "privatekey",
]);

const removeRecoveryCredentials = (value) => {
  if (Array.isArray(value)) return value.map(removeRecoveryCredentials);
  if (!value || typeof value !== "object") return value;

  return Object.entries(value).reduce((result, [key, item]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (
      RECOVERY_SECRET_KEYS.has(normalizedKey) ||
      normalizedKey === "uid" ||
      normalizedKey === "auth"
    ) {
      return result;
    }
    result[key] = removeRecoveryCredentials(item);
    return result;
  }, {});
};

export const createSchemaV2RecoveryArtifact = (
  cloudPayload,
  exportedAt = new Date().toISOString(),
) => {
  const detectedSchema = detectCloudSchemaVersion(cloudPayload);
  if (detectedSchema === SCHEMA_V3) {
    throw new Error("Recovery backup is blocked because Cloud main is already V3.");
  }

  const sanitizedPayload = removeRecoveryCredentials(
    deepSanitizeForFirestore(cloudPayload),
  );
  const sourceChecksum = createPayloadChecksum(sanitizedPayload);

  return {
    format: "BAM_SCHEMA_V2_RECOVERY_V1",
    sourceSchemaVersion: detectedSchema,
    sourceUpdatedAt: String(cloudPayload?.updatedAt || ""),
    sourceChecksum,
    exportedAt,
    payload: sanitizedPayload,
  };
};

export const validateRecoverySource = (recoveryArtifact, cloudPayload) => {
  if (!recoveryArtifact || typeof recoveryArtifact !== "object") {
    return { matches: false, error: "Recovery backup has not been downloaded." };
  }

  const currentArtifact = createSchemaV2RecoveryArtifact(
    cloudPayload,
    recoveryArtifact.exportedAt,
  );
  const matches =
    recoveryArtifact.sourceChecksum === currentArtifact.sourceChecksum &&
    String(recoveryArtifact.sourceUpdatedAt || "") ===
      String(currentArtifact.sourceUpdatedAt || "");

  return {
    matches,
    currentChecksum: currentArtifact.sourceChecksum,
    error: matches
      ? ""
      : "Cloud main changed after the recovery download. Download a new recovery backup.",
  };
};

export const estimateFirestorePayloadBytes = (value) => {
  const serialized = JSON.stringify(deepSanitizeForFirestore(value));
  return new TextEncoder().encode(serialized === undefined ? "null" : serialized)
    .length;
};

export const createSeasonDocumentId = (seasonRecord = {}) => {
  const competitionType = normalizeCompetitionType(
    seasonRecord.competitionType ||
      seasonRecord.archivedData?.competitionType,
  );
  const originalSeasonId = sanitizeDocumentIdSegment(seasonRecord.id);

  if (originalSeasonId) {
    return `v3_${competitionType}_${originalSeasonId}`;
  }

  const season = Number(
    seasonRecord.season || seasonRecord.archivedData?.season || 1,
  );
  const canonicalFallback = [
    competitionType,
    Number.isFinite(season) ? season : 1,
    String(seasonRecord.closedAt || ""),
    String(
      seasonRecord.projectName ||
        seasonRecord.archivedData?.projectName ||
        "",
    ),
  ].join("|");

  return `v3_${competitionType}_s${
    Number.isFinite(season) ? season : 1
  }_${stableHash(canonicalFallback)}`;
};

export const createSeasonIndexEntry = (seasonRecord = {}) => ({
  documentId: createSeasonDocumentId(seasonRecord),
  originalSeasonId:
    seasonRecord.id === undefined || seasonRecord.id === null
      ? null
      : seasonRecord.id,
  competitionType:
    String(
      seasonRecord.competitionType ||
        seasonRecord.archivedData?.competitionType ||
        "5X5",
    ).toUpperCase() === "3X3"
      ? "3X3"
      : "5X5",
  season: Number(
    seasonRecord.season || seasonRecord.archivedData?.season || 1,
  ),
  projectName: String(
    seasonRecord.projectName ||
      seasonRecord.archivedData?.projectName ||
      "",
  ),
  closedAt: String(seasonRecord.closedAt || ""),
  closedAtText: String(seasonRecord.closedAtText || ""),
  champion: String(seasonRecord.champion || "-"),
});

export const mergeSchemaV3SeasonIndexes = (
  existingIndex = [],
  localIndex = [],
) => {
  const mergedById = new Map();

  [existingIndex, localIndex].forEach((indexEntries) => {
    if (!Array.isArray(indexEntries)) {
      throw new Error("Schema V3 season index must be an array.");
    }
    const seenInSource = new Set();
    indexEntries.forEach((entry) => {
      const documentId = String(entry?.documentId || "").trim();
      if (!documentId || documentId.includes("/")) {
        throw new Error("Schema V3 season index contains an invalid document ID.");
      }
      if (seenInSource.has(documentId)) {
        throw new Error(`Duplicate season document ID: ${documentId}`);
      }
      seenInSource.add(documentId);
      mergedById.set(documentId, deepSanitizeForFirestore(entry));
    });
  });

  return [...mergedById.values()];
};

export const normalizeLegacyBackup = (payload) => {
  const data =
    payload?.data && typeof payload.data === "object" ? payload.data : payload;
  return deepSanitizeForFirestore(
    data && typeof data === "object" ? data : {},
  );
};

export const detectCloudSchemaVersion = (payload) => {
  if (Number(payload?.schemaVersion) !== SCHEMA_V3) return 2;

  if (!Array.isArray(payload?.data?.seasonIndex)) {
    throw new Error(
      "Schema V3 main document is malformed: data.seasonIndex must be an array.",
    );
  }

  const documentIds = new Set();
  payload.data.seasonIndex.forEach((entry, index) => {
    const documentId = String(entry?.documentId || "").trim();
    if (!documentId || documentId.includes("/")) {
      throw new Error(
        `Schema V3 main document is malformed: invalid seasonIndex entry ${index + 1}.`,
      );
    }
    if (documentIds.has(documentId)) {
      throw new Error(
        `Schema V3 main document is malformed: duplicate season document ID ${documentId}.`,
      );
    }
    documentIds.add(documentId);
  });

  return SCHEMA_V3;
};

export const createSchemaV3MainPayload = (logicalBackup = {}) => {
  const logicalData = normalizeLegacyBackup(logicalBackup);
  const seasonHistory = Array.isArray(logicalData.seasonHistory)
    ? logicalData.seasonHistory
    : [];
  const {
    seasonHistory: ignoredSeasonHistory,
    liveDraftConfirmedReplay: ignoredDraftReplay,
    liveScheduleConfirmedReplay: ignoredScheduleReplay,
    ...currentData
  } = logicalData;

  return deepSanitizeForFirestore({
    schemaVersion: SCHEMA_V3,
    app: logicalBackup.app || "BAM_LEAGUE_SYSTEM",
    appName: logicalBackup.appName || "",
    version: logicalBackup.version || "",
    phase: logicalBackup.phase || "",
    updatedAt: logicalBackup.updatedAt || "",
    data: {
      ...currentData,
      seasonIndex: seasonHistory.map(createSeasonIndexEntry),
    },
  });
};

export const createSchemaV3SeasonDocuments = (seasonHistory = []) =>
  (Array.isArray(seasonHistory) ? seasonHistory : []).map((seasonRecord) => {
    const indexEntry = createSeasonIndexEntry(seasonRecord);
    const seasonDocument = deepSanitizeForFirestore({
      ...seasonRecord,
      schemaVersion: SCHEMA_V3,
      documentId: indexEntry.documentId,
      originalSeasonId: indexEntry.originalSeasonId,
    });
    return {
      documentId: indexEntry.documentId,
      data: {
        ...seasonDocument,
        payloadChecksum: createPayloadChecksum(seasonDocument),
      },
    };
  });

export const createSchemaV3ReplayDocument = (logicalBackup = {}) => {
  const logicalData = normalizeLegacyBackup(logicalBackup);
  const replayDocument = deepSanitizeForFirestore({
    schemaVersion: SCHEMA_V3,
    updatedAt: logicalBackup.updatedAt || "",
    liveDraftConfirmedReplay:
      logicalData.liveDraftConfirmedReplay ?? null,
    liveScheduleConfirmedReplay:
      logicalData.liveScheduleConfirmedReplay ?? null,
  });
  return {
    ...replayDocument,
    payloadChecksum: createPayloadChecksum(replayDocument),
  };
};

const normalizeSeasonDocumentList = (seasonDocuments) => {
  if (Array.isArray(seasonDocuments)) return seasonDocuments;
  if (!seasonDocuments || typeof seasonDocuments !== "object") return [];

  return Object.entries(seasonDocuments).map(([documentId, data]) => ({
    documentId,
    data,
  }));
};

export const normalizeSchemaV3SeasonDocument = (
  seasonDocument,
  expectedDocumentId = "",
) => {
  if (!seasonDocument || typeof seasonDocument !== "object") {
    throw new Error(
      `Missing Schema V3 season document: ${expectedDocumentId || "unknown"}`,
    );
  }
  if (Number(seasonDocument.schemaVersion) !== SCHEMA_V3) {
    throw new Error(
      `Malformed Schema V3 season document: ${
        expectedDocumentId || seasonDocument.documentId || "unknown"
      }`,
    );
  }
  if (
    expectedDocumentId &&
    seasonDocument.documentId &&
    String(seasonDocument.documentId) !== String(expectedDocumentId)
  ) {
    throw new Error(
      `Schema V3 season document ID mismatch: ${expectedDocumentId}`,
    );
  }

  const normalized = { ...seasonDocument };
  const originalSeasonId = normalized.originalSeasonId;
  delete normalized.schemaVersion;
  delete normalized.documentId;
  delete normalized.originalSeasonId;

  return deepSanitizeForFirestore({
    ...normalized,
    id:
      originalSeasonId === null || originalSeasonId === undefined
        ? normalized.id
        : originalSeasonId,
  });
};

export const normalizeSchemaV3Backup = (
  mainPayload,
  seasonDocuments,
  replayDocument,
) => {
  detectCloudSchemaVersion(mainPayload);
  const index = mainPayload.data.seasonIndex;
  const documentsById = new Map(
    normalizeSeasonDocumentList(seasonDocuments).map((entry) => [
      String(entry.documentId || entry.data?.documentId || ""),
      entry.data || entry,
    ]),
  );

  const seasonHistory = index.map((entry) => {
    const documentId = String(entry?.documentId || "");
    const seasonDocument = documentsById.get(documentId);
    return normalizeSchemaV3SeasonDocument(seasonDocument, documentId);
  });

  const logicalData = {
    ...mainPayload.data,
    seasonHistory,
  };
  delete logicalData.seasonIndex;

  if (replayDocument && typeof replayDocument === "object") {
    logicalData.liveDraftConfirmedReplay =
      replayDocument.liveDraftConfirmedReplay ?? null;
    logicalData.liveScheduleConfirmedReplay =
      replayDocument.liveScheduleConfirmedReplay ?? null;
  }

  return deepSanitizeForFirestore({
    app: mainPayload.app,
    appName: mainPayload.appName,
    version: mainPayload.version,
    phase: mainPayload.phase,
    updatedAt: mainPayload.updatedAt,
    data: logicalData,
  });
};

const getSizeStatus = (bytes) => ({
  bytes,
  warning: bytes >= FIRESTORE_WARNING_BYTES,
  blocker: bytes >= FIRESTORE_BLOCK_BYTES,
});

export const validateSchemaV3Plan = (plan = {}) => {
  const mainPayload = plan.mainPayload || {};
  const seasonDocuments = Array.isArray(plan.seasonDocuments)
    ? plan.seasonDocuments
    : [];
  const replayDocument = plan.replayDocument || {};
  const errors = [];
  const warnings = [];
  const seenDocumentIds = new Set();

  seasonDocuments.forEach((entry, index) => {
    const documentId = String(entry?.documentId || "");
    if (!documentId) {
      errors.push(`Season ${index + 1} has no document ID.`);
      return;
    }
    if (seenDocumentIds.has(documentId)) {
      errors.push(`Duplicate season document ID: ${documentId}`);
    }
    seenDocumentIds.add(documentId);
    if (entry?.data?.originalSeasonId === null) {
      warnings.push(
        `${documentId} uses a deterministic fallback because the original season ID is missing.`,
      );
    }
  });

  const documents = [
    { label: "main", ...getSizeStatus(estimateFirestorePayloadBytes(mainPayload)) },
    ...seasonDocuments.map((entry) => ({
      label: entry.documentId,
      ...getSizeStatus(estimateFirestorePayloadBytes(entry.data)),
    })),
    {
      label: "adminReplay",
      ...getSizeStatus(estimateFirestorePayloadBytes(replayDocument)),
    },
  ];

  documents.forEach((document) => {
    if (document.blocker) {
      errors.push(
        `${document.label} is ${document.bytes} bytes (950 KB blocker).`,
      );
    } else if (document.warning) {
      warnings.push(
        `${document.label} is ${document.bytes} bytes (800 KB warning).`,
      );
    }
  });

  const expectedIndex = Array.isArray(mainPayload?.data?.seasonIndex)
    ? mainPayload.data.seasonIndex
    : [];
  if (expectedIndex.length !== seasonDocuments.length) {
    errors.push(
      `Season index count (${expectedIndex.length}) does not match season document count (${seasonDocuments.length}).`,
    );
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    documents,
    seasonCount: seasonDocuments.length,
  };
};

const withoutPayloadChecksum = (value) => {
  const clone = { ...(value || {}) };
  delete clone.payloadChecksum;
  return clone;
};

export const verifySchemaV3StagingSnapshot = (
  plan,
  {
    recoveryDocument,
    seasonDocuments = [],
    replayDocument,
  } = {},
) => {
  const errors = [];
  const expectedDocuments = Array.isArray(plan?.seasonDocuments)
    ? plan.seasonDocuments
    : [];
  const actualDocuments = Array.isArray(seasonDocuments)
    ? seasonDocuments
    : [];
  const expectedById = new Map(
    expectedDocuments.map((entry) => [entry.documentId, entry.data]),
  );
  const actualById = new Map(
    actualDocuments.map((entry) => [
      entry.documentId || entry.data?.documentId,
      entry.data || entry,
    ]),
  );
  const expectedIds = [...expectedById.keys()].sort();
  const actualIds = [...actualById.keys()].filter(Boolean).sort();
  const missingIds = expectedIds.filter((id) => !actualById.has(id));
  const extraIds = actualIds.filter((id) => !expectedById.has(id));

  if (missingIds.length > 0) {
    errors.push(`Missing staged season documents: ${missingIds.join(", ")}`);
  }
  if (extraIds.length > 0) {
    errors.push(`Extra staged season documents: ${extraIds.join(", ")}`);
  }

  expectedById.forEach((expected, documentId) => {
    const actual = actualById.get(documentId);
    if (!actual) return;

    [
      "originalSeasonId",
      "competitionType",
      "season",
      "projectName",
    ].forEach((field) => {
      if (String(actual[field] ?? "") !== String(expected[field] ?? "")) {
        errors.push(`${documentId} field mismatch: ${field}`);
      }
    });

    const actualChecksum = createPayloadChecksum(
      withoutPayloadChecksum(actual),
    );
    if (
      actual.payloadChecksum !== expected.payloadChecksum ||
      actualChecksum !== expected.payloadChecksum
    ) {
      errors.push(`${documentId} checksum mismatch.`);
    }
  });

  if (
    !recoveryDocument ||
    recoveryDocument.sourceChecksum !== plan?.sourceChecksum
  ) {
    errors.push("Recovery document checksum mismatch.");
  }

  const expectedReplay = plan?.replayDocument || {};
  let replayVerified = true;
  if (!replayDocument) {
    errors.push("Admin replay document is missing.");
    replayVerified = false;
  } else {
    const actualReplayChecksum = createPayloadChecksum(
      withoutPayloadChecksum(replayDocument),
    );
    if (
      replayDocument.payloadChecksum !== expectedReplay.payloadChecksum ||
      actualReplayChecksum !== expectedReplay.payloadChecksum
    ) {
      errors.push("Admin replay document checksum mismatch.");
      replayVerified = false;
    }
    const expectedSourceDraftSessionId =
      expectedReplay.liveScheduleConfirmedReplay?.sourceDraftSessionId || "";
    const actualSourceDraftSessionId =
      replayDocument.liveScheduleConfirmedReplay?.sourceDraftSessionId || "";
    if (actualSourceDraftSessionId !== expectedSourceDraftSessionId) {
      errors.push("Replay sourceDraftSessionId mismatch.");
      replayVerified = false;
    }
  }

  return {
    verified: errors.length === 0,
    errors,
    expectedSeasonCount: expectedIds.length,
    stagedSeasonCount: actualIds.length,
    verifiedSeasonCount: expectedIds.filter((id) => actualById.has(id)).length,
    missingIds,
    extraIds,
    replayVerified,
  };
};

export const createSchemaV3MigrationPlan = (logicalBackup = {}) => {
  const logicalData = normalizeLegacyBackup(logicalBackup);
  const mainPayload = createSchemaV3MainPayload(logicalBackup);
  const seasonDocuments = createSchemaV3SeasonDocuments(
    logicalData.seasonHistory,
  );
  const replayDocument = createSchemaV3ReplayDocument(logicalBackup);
  const plan = {
    detectedSchema: detectCloudSchemaVersion(logicalBackup),
    sourceChecksum: createPayloadChecksum(logicalBackup),
    mainPayload,
    seasonDocuments,
    replayDocument,
  };

  return {
    ...plan,
    validation: validateSchemaV3Plan(plan),
  };
};
