import { TextEncoder } from "util";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  createPayloadChecksum,
  createSchemaV3MigrationPlan,
  createSchemaV2RecoveryArtifact,
} from "./schemaV3Mapper";
import {
  clearSchemaV3Backup,
  promoteSchemaV3Main,
  rollbackToSchemaV2Main,
  stageSchemaV3ReplayDocument,
  stageSchemaV3SeasonDocuments,
  uploadSchemaV3Backup,
  writeSchemaV2RecoveryDocument,
  writeSchemaV3MigrationState,
} from "./schemaV3Service";

global.TextEncoder = TextEncoder;

const mockStore = new Map();
const mockOperationLog = [];
const mockBatchCommit = jest.fn();

jest.mock("../../firebase", () => ({ db: { name: "mock-db" } }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((database, name) => ({ database, path: name })),
  doc: jest.fn((database, ...segments) => ({
    database,
    path: segments.join("/"),
  })),
  getDoc: jest.fn(async (reference) => ({
    exists: () => mockStore.has(reference.path),
    data: () => mockStore.get(reference.path),
  })),
  getDocs: jest.fn(async (reference) => {
    const prefix = `${reference.path}/`;
    const docs = [...mockStore.entries()]
      .filter(([path]) => {
        const suffix = path.slice(prefix.length);
        return path.startsWith(prefix) && suffix && !suffix.includes("/");
      })
      .map(([path, value]) => ({
        id: path.slice(prefix.length),
        data: () => value,
      }));
    return { docs };
  }),
  setDoc: jest.fn(async (reference, value) => {
    mockOperationLog.push(`set:${reference.path}`);
    mockStore.set(reference.path, value);
  }),
  deleteDoc: jest.fn(async (reference) => {
    mockOperationLog.push(`delete:${reference.path}`);
    mockStore.delete(reference.path);
  }),
  writeBatch: jest.fn(() => {
    const operations = [];
    return {
      set: (reference, value) => operations.push(["set", reference, value]),
      delete: (reference) => operations.push(["delete", reference]),
      commit: async () => {
        mockBatchCommit(operations);
        operations.forEach(([operation, reference, value]) => {
          mockOperationLog.push(`${operation}:${reference.path}`);
          if (operation === "set") mockStore.set(reference.path, value);
          else mockStore.delete(reference.path);
        });
      },
    };
  }),
}));

const createSeason = (id, projectName = `Season ${id}`) => ({
  id,
  competitionType: "5X5",
  season: id,
  projectName,
  archivedData: {
    players: [],
    teams: [],
    schedule: [],
    playerStats: {},
  },
});

const createLogicalBackup = (seasonHistory = []) => ({
  players: [{ id: "p1", name: "Player One" }],
  teams: [],
  schedule: [],
  seasonHistory,
  liveDraftConfirmedReplay: { sessionId: "draft-1" },
  liveScheduleConfirmedReplay: {
    sessionId: "schedule-1",
    sourceDraftSessionId: "draft-1",
  },
});

const seedPlan = (logicalBackup) => {
  const plan = createSchemaV3MigrationPlan(logicalBackup);
  mockStore.set("bamLeague/main", plan.mainPayload);
  plan.seasonDocuments.forEach((entry) => {
    mockStore.set(`bamLeagueSeasons/${entry.documentId}`, entry.data);
  });
  mockStore.set("bamLeagueAdmin/liveReplays", plan.replayDocument);
  return plan;
};

describe("Schema V3 write service safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
    mockOperationLog.length = 0;
    collection.mockImplementation((database, name) => ({
      database,
      path: name,
    }));
    doc.mockImplementation((database, ...segments) => ({
      database,
      path: segments.join("/"),
    }));
    getDoc.mockImplementation(async (reference) => ({
      exists: () => mockStore.has(reference.path),
      data: () => mockStore.get(reference.path),
    }));
    getDocs.mockImplementation(async (reference) => {
      const prefix = `${reference.path}/`;
      return {
        docs: [...mockStore.entries()]
          .filter(([path]) => {
            const suffix = path.slice(prefix.length);
            return path.startsWith(prefix) && suffix && !suffix.includes("/");
          })
          .map(([path, value]) => ({
            id: path.slice(prefix.length),
            data: () => value,
          })),
      };
    });
    setDoc.mockImplementation(async (reference, value) => {
      mockOperationLog.push(`set:${reference.path}`);
      mockStore.set(reference.path, value);
    });
    deleteDoc.mockImplementation(async (reference) => {
      mockOperationLog.push(`delete:${reference.path}`);
      mockStore.delete(reference.path);
    });
    writeBatch.mockImplementation(() => {
      const operations = [];
      return {
        set: (reference, value) => operations.push(["set", reference, value]),
        delete: (reference) => operations.push(["delete", reference]),
        commit: async () => {
          mockBatchCommit(operations);
          operations.forEach(([operation, reference, value]) => {
            mockOperationLog.push(`${operation}:${reference.path}`);
            if (operation === "set") mockStore.set(reference.path, value);
            else mockStore.delete(reference.path);
          });
        },
      };
    });
  });

  test("explicit stage helpers never write /bamLeague/main", async () => {
    await writeSchemaV2RecoveryDocument({
      sourceChecksum: "checksum",
      payload: { data: {} },
    });
    await stageSchemaV3SeasonDocuments([
      {
        documentId: "v3_5x5_1",
        data: { schemaVersion: 3, documentId: "v3_5x5_1" },
      },
    ]);
    await stageSchemaV3ReplayDocument({
      schemaVersion: 3,
      payloadChecksum: "replay-checksum",
    });
    await writeSchemaV3MigrationState({
      schemaVersion: 3,
      status: "staged",
    });

    expect([...mockStore.keys()]).toEqual(
      expect.arrayContaining([
        "bamLeagueAdmin/schemaV2Backup",
        "bamLeagueSeasons/v3_5x5_1",
        "bamLeagueAdmin/liveReplays",
        "bamLeagueAdmin/schemaV3Migration",
      ]),
    );
    expect(mockStore.has("bamLeague/main")).toBe(false);
  });

  test("operational upload preserves cloud-only seasons and writes main last", async () => {
    const cloudSeason = createSeason(1, "Cloud Season");
    seedPlan(createLogicalBackup([cloudSeason]));
    mockOperationLog.length = 0;

    await uploadSchemaV3Backup(
      createLogicalBackup([createSeason(2, "Local Season")]),
    );

    const main = mockStore.get("bamLeague/main");
    expect(main.data.seasonIndex.map((entry) => entry.season)).toEqual([1, 2]);
    expect(mockOperationLog.at(-1)).toBe("set:bamLeague/main");
    expect(
      mockOperationLog.indexOf("set:bamLeagueAdmin/liveReplays"),
    ).toBeLessThan(mockOperationLog.indexOf("set:bamLeague/main"));
    expect(main.data.seasonHistory).toBeUndefined();
    expect(main.data.liveDraftConfirmedReplay).toBeUndefined();
  });

  test("operational upload blocks incomplete indexed Cloud history before writes", async () => {
    const plan = createSchemaV3MigrationPlan(
      createLogicalBackup([createSeason(1)]),
    );
    mockStore.set("bamLeague/main", plan.mainPayload);
    mockOperationLog.length = 0;

    await expect(
      uploadSchemaV3Backup(createLogicalBackup([])),
    ).rejects.toThrow(/incomplete/i);
    expect(mockOperationLog).toEqual([]);
  });

  test("promotion requires verified staging and writes V3 main", async () => {
    const legacyMain = { data: createLogicalBackup([createSeason(1)]) };
    const plan = createSchemaV3MigrationPlan(legacyMain);
    const recovery = createSchemaV2RecoveryArtifact(legacyMain);
    mockStore.set("bamLeague/main", legacyMain);
    mockStore.set("bamLeagueAdmin/schemaV2Backup", recovery);
    mockStore.set("bamLeagueAdmin/liveReplays", plan.replayDocument);
    mockStore.set("bamLeagueAdmin/schemaV3Migration", {
      schemaVersion: 3,
      status: "verified",
      sourceChecksum: plan.sourceChecksum,
    });
    plan.seasonDocuments.forEach((entry) =>
      mockStore.set(`bamLeagueSeasons/${entry.documentId}`, entry.data),
    );

    await promoteSchemaV3Main();

    expect(mockStore.get("bamLeague/main").schemaVersion).toBe(3);
    expect(mockStore.get("bamLeagueAdmin/schemaV3Migration").status).toBe(
      "promoted",
    );
  });

  test("promotion blocks a recovery source mismatch", async () => {
    const legacyMain = { data: createLogicalBackup([]) };
    const recovery = createSchemaV2RecoveryArtifact({ data: { players: [] } });
    mockStore.set("bamLeague/main", legacyMain);
    mockStore.set("bamLeagueAdmin/schemaV2Backup", recovery);
    mockStore.set("bamLeagueAdmin/schemaV3Migration", {
      schemaVersion: 3,
      status: "verified",
      sourceChecksum: createPayloadChecksum(legacyMain),
    });

    await expect(promoteSchemaV3Main()).rejects.toThrow(
      /checksum|source|Cloud main changed/i,
    );
    expect(mockStore.get("bamLeague/main")).toEqual(legacyMain);
  });

  test("rollback restores exact V2 main without deleting staged V3 documents", async () => {
    const legacyMain = { data: createLogicalBackup([createSeason(1)]) };
    const recovery = createSchemaV2RecoveryArtifact(legacyMain);
    seedPlan(createLogicalBackup([createSeason(1)]));
    mockStore.set("bamLeagueAdmin/schemaV2Backup", recovery);
    mockStore.set("bamLeagueAdmin/schemaV3Migration", {
      schemaVersion: 3,
      status: "promoted",
    });
    const seasonPaths = [...mockStore.keys()].filter((path) =>
      path.startsWith("bamLeagueSeasons/"),
    );

    await rollbackToSchemaV2Main();

    expect(mockStore.get("bamLeague/main")).toEqual(legacyMain);
    seasonPaths.forEach((path) => expect(mockStore.has(path)).toBe(true));
    expect(mockStore.get("bamLeagueAdmin/schemaV3Migration").status).toBe(
      "rolledBack",
    );
  });

  test("clear deletes main first and removes V3 season/admin documents", async () => {
    seedPlan(createLogicalBackup([createSeason(1), createSeason(2)]));
    mockStore.set("bamLeagueAdmin/schemaV2Backup", {
      sourceChecksum: "recovery",
    });
    mockStore.set("bamLeagueAdmin/schemaV3Migration", { status: "promoted" });
    mockOperationLog.length = 0;

    await clearSchemaV3Backup();

    expect(mockOperationLog[0]).toBe("delete:bamLeague/main");
    expect([...mockStore.keys()]).toEqual([]);
  });

  test("clear batches more than 400 delete operations", async () => {
    seedPlan(createLogicalBackup([]));
    for (let index = 0; index < 401; index += 1) {
      mockStore.set(`bamLeagueSeasons/v3_5x5_${index}`, {
        schemaVersion: 3,
        documentId: `v3_5x5_${index}`,
      });
    }

    await clearSchemaV3Backup();

    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
  });

  test("clear reports a partial failure instead of success", async () => {
    seedPlan(createLogicalBackup([createSeason(1)]));
    writeBatch.mockImplementationOnce(() => ({
      set: jest.fn(),
      delete: jest.fn(),
      commit: async () => {
        throw new Error("mock batch failure");
      },
    }));

    await expect(clearSchemaV3Backup()).rejects.toThrow("mock batch failure");
    expect(mockStore.has("bamLeague/main")).toBe(false);
    expect(
      [...mockStore.keys()].some((path) =>
        path.startsWith("bamLeagueSeasons/"),
      ),
    ).toBe(true);
  });

  test("size blocker prevents operational writes", async () => {
    seedPlan(createLogicalBackup([]));
    mockOperationLog.length = 0;
    const oversizedBackup = {
      ...createLogicalBackup([]),
      publicBranding: { followDescription: "x".repeat(951 * 1024) },
    };

    await expect(uploadSchemaV3Backup(oversizedBackup)).rejects.toThrow(
      /blocked|bytes/i,
    );
    expect(mockOperationLog).toEqual([]);
  });
});
