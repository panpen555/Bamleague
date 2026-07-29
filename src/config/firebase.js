export const SCHEMA_V3 = 3;
export const MAIN_DOCUMENT_PATH = "/bamLeague/main";
export const SEASONS_COLLECTION = "bamLeagueSeasons";
export const ADMIN_REPLAY_PATH = "/bamLeagueAdmin/liveReplays";

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
  },
  paths: {
    main: MAIN_DOCUMENT_PATH,
    adminReplay: ADMIN_REPLAY_PATH,
  },
};
