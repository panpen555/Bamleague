import { TextEncoder } from "util";
import {
  createSchemaV3MainPayload,
  createSchemaV3MigrationPlan,
  createSchemaV3SeasonDocuments,
  createSeasonDocumentId,
  deepSanitizeForFirestore,
  detectCloudSchemaVersion,
  normalizeLegacyBackup,
  normalizeSchemaV3Backup,
  validateSchemaV3Plan,
} from "./schemaV3Mapper";

global.TextEncoder = TextEncoder;

const createSeason = (overrides = {}) => ({
  id: 1700000000000,
  competitionType: "5X5",
  season: 1,
  projectName: "5X5 Season 1",
  closedAt: "2026-01-01T00:00:00.000Z",
  archivedData: {
    players: [],
    teams: [],
    schedule: [],
    playerStats: {},
  },
  ...overrides,
});

describe("Schema V3 mapper", () => {
  test("creates deterministic season document IDs", () => {
    const season = createSeason();
    expect(createSeasonDocumentId(season)).toBe(
      createSeasonDocumentId({ ...season }),
    );
    expect(createSeasonDocumentId(season)).toBe("v3_5x5_1700000000000");
  });

  test("keeps 3X3 and 5X5 season IDs distinct", () => {
    const fiveOnFive = createSeason({ competitionType: "5X5" });
    const threeOnThree = createSeason({ competitionType: "3X3" });
    expect(createSeasonDocumentId(fiveOnFive)).not.toBe(
      createSeasonDocumentId(threeOnThree),
    );
  });

  test("blocks duplicate season document IDs", () => {
    const duplicateSeason = createSeason();
    const plan = {
      mainPayload: createSchemaV3MainPayload({
        seasonHistory: [duplicateSeason, duplicateSeason],
      }),
      seasonDocuments: createSchemaV3SeasonDocuments([
        duplicateSeason,
        duplicateSeason,
      ]),
      replayDocument: {},
    };
    const validation = validateSchemaV3Plan(plan);
    expect(validation.ready).toBe(false);
    expect(validation.errors.join(" ")).toMatch(/Duplicate season document ID/);
  });

  test("uses a deterministic fallback for legacy seasons without IDs", () => {
    const season = createSeason({ id: undefined });
    expect(createSeasonDocumentId(season)).toBe(
      createSeasonDocumentId({ ...season }),
    );
    expect(createSeasonDocumentId(season)).toMatch(/^v3_5x5_s1_/);
  });

  test("normalizes legacy envelope and raw logical backups", () => {
    expect(normalizeLegacyBackup({ data: { players: [{ id: 1 }] } })).toEqual({
      players: [{ id: 1 }],
    });
    expect(normalizeLegacyBackup({ players: [{ id: 2 }] })).toEqual({
      players: [{ id: 2 }],
    });
    expect(detectCloudSchemaVersion({ data: {} })).toBe(2);
  });

  test("rejects malformed or duplicate V3 season index entries", () => {
    expect(() =>
      detectCloudSchemaVersion({
        schemaVersion: 3,
        data: { seasonIndex: [{ documentId: "" }] },
      }),
    ).toThrow(/invalid seasonIndex entry/);
    expect(() =>
      detectCloudSchemaVersion({
        schemaVersion: 3,
        data: {
          seasonIndex: [
            { documentId: "v3_5x5_1" },
            { documentId: "v3_5x5_1" },
          ],
        },
      }),
    ).toThrow(/duplicate season document ID/);
  });

  test("assembles V3 main, seasons, and replay into one logical backup", () => {
    const season = createSeason();
    const logicalBackup = {
      players: [{ id: "p1" }],
      seasonHistory: [season],
      liveDraftConfirmedReplay: { sessionId: "draft-1" },
    };
    const mainPayload = createSchemaV3MainPayload(logicalBackup);
    const seasonDocuments = createSchemaV3SeasonDocuments([season]);
    const assembled = normalizeSchemaV3Backup(
      mainPayload,
      seasonDocuments,
      {
        liveDraftConfirmedReplay: { sessionId: "draft-1" },
        liveScheduleConfirmedReplay: null,
      },
    );

    expect(assembled.data.players).toEqual([{ id: "p1" }]);
    expect(assembled.data.seasonHistory).toHaveLength(1);
    expect(assembled.data.liveDraftConfirmedReplay.sessionId).toBe("draft-1");
  });

  test("recursively removes image data URLs from archived and branding data", () => {
    const sanitized = deepSanitizeForFirestore({
      seasonHistory: [
        {
          archivedData: {
            players: [{ photoUrl: "data:image/png;base64,abc" }],
            teamLogos: { A: "data:image/jpeg;base64,def" },
          },
        },
      ],
      publicBranding: {
        highlightSlides: [
          { imageUrl: "data:image/webp;base64,ghi" },
          { imageUrl: "https://example.com/highlight.webp" },
        ],
      },
    });

    expect(
      sanitized.seasonHistory[0].archivedData.players[0].photoUrl,
    ).toBe("");
    expect(sanitized.seasonHistory[0].archivedData.teamLogos.A).toBe("");
    expect(sanitized.publicBranding.highlightSlides[0].imageUrl).toBe("");
    expect(sanitized.publicBranding.highlightSlides[1].imageUrl).toBe(
      "https://example.com/highlight.webp",
    );
  });

  test("preserves zero, false, null, and empty arrays", () => {
    expect(
      deepSanitizeForFirestore({
        score: 0,
        enabled: false,
        empty: [],
        nullable: null,
        ignored: undefined,
      }),
    ).toEqual({
      score: 0,
      enabled: false,
      empty: [],
      nullable: null,
    });
  });

  test("reports size warnings and blockers", () => {
    const warningPlan = validateSchemaV3Plan({
      mainPayload: { value: "x".repeat(810 * 1024) },
      seasonDocuments: [],
      replayDocument: {},
    });
    const blockedPlan = validateSchemaV3Plan({
      mainPayload: { value: "x".repeat(951 * 1024) },
      seasonDocuments: [],
      replayDocument: {},
    });

    expect(warningPlan.ready).toBe(true);
    expect(warningPlan.warnings.length).toBeGreaterThan(0);
    expect(blockedPlan.ready).toBe(false);
    expect(blockedPlan.errors.length).toBeGreaterThan(0);
  });

  test("uses V3 season documents instead of concatenating legacy history", () => {
    const v3Season = createSeason({ id: 2, projectName: "V3 Season" });
    const mainPayload = createSchemaV3MainPayload({
      players: [],
      seasonHistory: [v3Season],
    });
    mainPayload.data.seasonHistory = [
      createSeason({ id: 1, projectName: "Legacy Duplicate" }),
    ];
    const seasonDocuments = createSchemaV3SeasonDocuments([v3Season]);
    const assembled = normalizeSchemaV3Backup(
      mainPayload,
      seasonDocuments,
      null,
    );

    expect(assembled.data.seasonHistory).toHaveLength(1);
    expect(assembled.data.seasonHistory[0].projectName).toBe("V3 Season");
  });

  test("migration preview remains pure and produces a validated plan", () => {
    const plan = createSchemaV3MigrationPlan({
      players: [],
      seasonHistory: [createSeason()],
    });
    expect(plan.validation.ready).toBe(true);
    expect(plan.seasonDocuments).toHaveLength(1);
  });
});
