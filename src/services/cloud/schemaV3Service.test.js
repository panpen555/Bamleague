import { TextEncoder } from "util";
import {
  doc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  stageSchemaV3ReplayDocument,
  stageSchemaV3SeasonDocuments,
  writeSchemaV2RecoveryDocument,
  writeSchemaV3MigrationState,
} from "./schemaV3Service";

global.TextEncoder = TextEncoder;

const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn(() => Promise.resolve());

jest.mock("../../firebase", () => ({ db: { name: "mock-db" } }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((database, name) => ({ database, path: name })),
  doc: jest.fn((database, ...segments) => ({
    database,
    path: segments.join("/"),
  })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  writeBatch: jest.fn(() => ({
    set: (...args) => mockBatchSet(...args),
    commit: (...args) => mockBatchCommit(...args),
  })),
}));

describe("Schema V3 write service safety", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchSet.mockClear();
    mockBatchCommit.mockClear();
    doc.mockImplementation((database, ...segments) => ({
      database,
      path: segments.join("/"),
    }));
    setDoc.mockResolvedValue(undefined);
    writeBatch.mockImplementation(() => ({
      set: (...args) => mockBatchSet(...args),
      commit: (...args) => mockBatchCommit(...args),
    }));
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

    const directWritePaths = setDoc.mock.calls.map(
      ([reference]) => reference.path,
    );
    const batchWritePaths = mockBatchSet.mock.calls.map(
      ([reference]) => reference.path,
    );
    const allWritePaths = [...directWritePaths, ...batchWritePaths];

    expect(allWritePaths).toContain("bamLeagueAdmin/schemaV2Backup");
    expect(allWritePaths).toContain("bamLeagueSeasons/v3_5x5_1");
    expect(allWritePaths).toContain("bamLeagueAdmin/liveReplays");
    expect(allWritePaths).toContain("bamLeagueAdmin/schemaV3Migration");
    expect(allWritePaths).not.toContain("bamLeague/main");
    expect(doc).toHaveBeenCalled();
    expect(writeBatch).toHaveBeenCalled();
  });
});
