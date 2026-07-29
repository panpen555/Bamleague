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
    return {
      documentId: indexEntry.documentId,
      data: deepSanitizeForFirestore({
        ...seasonRecord,
        schemaVersion: SCHEMA_V3,
        documentId: indexEntry.documentId,
        originalSeasonId: indexEntry.originalSeasonId,
      }),
    };
  });

export const createSchemaV3ReplayDocument = (logicalBackup = {}) => {
  const logicalData = normalizeLegacyBackup(logicalBackup);
  return deepSanitizeForFirestore({
    schemaVersion: SCHEMA_V3,
    updatedAt: logicalBackup.updatedAt || "",
    liveDraftConfirmedReplay:
      logicalData.liveDraftConfirmedReplay ?? null,
    liveScheduleConfirmedReplay:
      logicalData.liveScheduleConfirmedReplay ?? null,
  });
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

export const createSchemaV3MigrationPlan = (logicalBackup = {}) => {
  const logicalData = normalizeLegacyBackup(logicalBackup);
  const mainPayload = createSchemaV3MainPayload(logicalBackup);
  const seasonDocuments = createSchemaV3SeasonDocuments(
    logicalData.seasonHistory,
  );
  const replayDocument = createSchemaV3ReplayDocument(logicalBackup);
  const plan = {
    detectedSchema: detectCloudSchemaVersion(logicalBackup),
    mainPayload,
    seasonDocuments,
    replayDocument,
  };

  return {
    ...plan,
    validation: validateSchemaV3Plan(plan),
  };
};
