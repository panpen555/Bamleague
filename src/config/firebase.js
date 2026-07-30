export const SCHEMA_V3 = 3;
export const MAIN_DOCUMENT_PATH = "/bamLeague/main";
export const SEASONS_COLLECTION = "bamLeagueSeasons";
export const ADMIN_REPLAY_PATH = "/bamLeagueAdmin/liveReplays";
export const ADMIN_SCHEMA_V2_BACKUP_PATH =
  "/bamLeagueAdmin/schemaV2Backup";
export const ADMIN_SCHEMA_V3_MIGRATION_PATH =
  "/bamLeagueAdmin/schemaV3Migration";

export const FIREBASE_CONFIG_META = {
  projectId: "bam-league",
  appName: "BAM League",
  collections: {
    league: "bamLeague",
    seasonsV3: SEASONS_COLLECTION,
    adminV3: "bamLeagueAdmin",
    seasons: "seasons",
    players: "players",
    drafts: "drafts",
    media: "media",
  },
  documents: {
    main: "main",
    liveReplays: "liveReplays",
    schemaV2Backup: "schemaV2Backup",
    schemaV3Migration: "schemaV3Migration",
  },
  paths: {
    main: MAIN_DOCUMENT_PATH,
    adminReplay: ADMIN_REPLAY_PATH,
    adminSchemaV2Backup: ADMIN_SCHEMA_V2_BACKUP_PATH,
    adminSchemaV3Migration: ADMIN_SCHEMA_V3_MIGRATION_PATH,
  },
};
