import React, { useEffect, useState } from "react";
import CloudTools from "../components/cloud/CloudTools";
import BackupRestoreTools from "../components/cloud/BackupRestoreTools";
import SeasonManagementTools from "../components/season/SeasonManagementTools";
import DangerZoneTools from "../components/system/DangerZoneTools";
import PlayerImportExport from "../components/players/PlayerImportExport";
import PlayerForm from "../components/players/PlayerForm";
import PlayerList from "../components/players/PlayerList";
import AdminHeader from "../components/admin/AdminHeader";
import AdminNavigation from "../components/admin/AdminNavigation";
import TeamDashboard from "../components/teams/TeamDashboard";
import DraftHistory from "../components/drafts/DraftHistory";
import SchedulePanel from "../components/schedule/SchedulePanel";
import MatchRosterModal from "../components/matches/MatchRosterModal";
import MatchStatsModal from "../components/matches/MatchStatsModal";
import StandingsPanel from "../components/standings/StandingsPanel";
import MvpRankingPanel from "../components/stats/MvpRankingPanel";
import PlayerStatLeadersPanel from "../components/stats/PlayerStatLeadersPanel";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase";

import {
  uploadPlayerPhoto,
  uploadTeamLogo as uploadTeamLogoToCloud,
} from "../storage";

import "../styles/public-dashboard.css";

import {
  uploadLeagueBackup,
  downloadLeagueBackup,
  clearLeagueBackup,
} from "../services/cloud/backupService";

/*
======================================================
BAM LEAGUE SYSTEM - PLAYERS PAGE
======================================================

V1 FINAL REFACTOR NOTES
- This file is intentionally kept as a single main page while CodeSandbox
  limits creating many new files/folders.
- UI widgets already extracted: CloudTools, BackupRestoreTools,
  SeasonManagementTools, DangerZoneTools, PlayerImportExport.
- Business logic is organized into numbered regions so future features
  can be added safely without hunting across the whole file.
- Do not change multiple high-risk systems in one update.

TABLE OF CONTENTS
01. Core Constants / Base Config
02. State: League Setup
03. State: Player Form / Player Management
04. State: Match Roster / Match Stats
05. State: Team Logos / Lock Groups
06. State: Season / Dashboard / UI Mode
07. Local Storage Sync
08. League Setup Handlers
09. Player Rating / Tier Helpers
10. Media / Image Helpers
11. Player CRUD Handlers
12. CSV Import / Export Helpers
13. Draft Engine Helpers
14. Draft Actions
15. Team Roster Management
16. Draft Save / Load / Export
17. Schedule / Match Results
18. Match Roster Helpers
19. Player Stats Engine
20. Season Management
21. Local Backup / Restore
22. Cloud Backup / Restore
23. Render: Public Dashboard
24. Main Page Render
25. Season History Manual Ordering
26. Awards System V2
27. Season History Editor V1
28. Player Career Engine V1
29. Core Database Engine V4

HIGH-RISK AREAS
- Draft Engine: affects team generation balance.
- Match Roster: affects who plays and loan logic.
- Player Stats Engine: affects season records and awards.
- Season Management: affects historical data.

SAFE FEATURE STRATEGY
1. Export backup first.
2. Change one area only.
3. Run npm run build.
4. Test the affected UI.
5. Commit before moving on.
======================================================
*/

function Players() {
  // ======================================================
  // 01. CORE CONSTANTS / BASE CONFIG
  // ======================================================
  const validTiers = ["SSS+", "S+", "S-", "A+", "A-", "B+", "B-", "C"];
  const validPositions = ["PG", "SG", "SF", "PF", "C"];
  const defaultTeamCount = 4;
  const createDefaultTeamNames = (count) =>
    Array.from(
      { length: count },
      (_, index) => `Team ${String.fromCharCode(65 + index)}`,
    );

  // ======================================================
  // 29. CORE DATABASE ENGINE V4
  // Database rules:
  // 1) Player Identity is permanent.
  // 2) Old data must auto-migrate forward.
  // 3) Career / Records are rebuilt from Season History.
  // ======================================================

  const CORE_DATABASE_VERSION = "4.0.0";
  const BAM_PLAYER_ID_PREFIX = "BAM";

  // ======================================================
  // 02. STATE: LEAGUE SETUP
  // ======================================================

  const [teamCount, setTeamCount] = useState(() => {
    const saved = localStorage.getItem("teamCount");
    const parsed = saved ? Number(saved) : defaultTeamCount;
    return Number.isFinite(parsed) && parsed >= 3 ? parsed : defaultTeamCount;
  });

  const [competitionType, setCompetitionType] = useState(() => {
    const saved = localStorage.getItem("competitionType");
    return saved === "3X3" ? "3X3" : "5X5";
  });

  const defaultTeamNames = createDefaultTeamNames(teamCount);

  const [teamNames, setTeamNames] = useState(() => {
    const saved = localStorage.getItem("teamNames");
    return saved ? JSON.parse(saved) : createDefaultTeamNames(defaultTeamCount);
  });

  const [players, setPlayers] = useState(() => {
    const saved = localStorage.getItem("players");
    return saved ? JSON.parse(saved) : [];
  });

  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem("teams");
    return saved ? JSON.parse(saved) : [];
  });
  const [schedule, setSchedule] = useState(() => {
    const saved = localStorage.getItem("schedule");
    return saved ? JSON.parse(saved) : [];
  });

  const [drafts, setDrafts] = useState(() => {
    const saved = localStorage.getItem("drafts");
    return saved ? JSON.parse(saved) : [];
  });

  // ======================================================
  // 03. STATE: PLAYER FORM / PLAYER MANAGEMENT
  // ======================================================

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    tier: "",
    pos1: "PG",
    pos2: "",
    dribbling: 3,
    insideScoring: 3,
    shooting: 3,
    defense: 3,
    passing: 3,
    available: true,
    lockedTeam: "",
    photoUrl: "",
  });

  const [rosterExistingPlayerId, setRosterExistingPlayerId] = useState("");
  const [rosterTargetTeam, setRosterTargetTeam] = useState("");

  const [newRosterForm, setNewRosterForm] = useState({
    name: "",
    tier: "",
    pos1: "PG",
    pos2: "",
    dribbling: 3,
    insideScoring: 3,
    shooting: 3,
    defense: 3,
    passing: 3,
    targetTeam: "",
    photoUrl: "",
  });

  // ======================================================
  // 04. STATE: MATCH ROSTER / MATCH STATS
  // ======================================================

  const [matchRosters, setMatchRosters] = useState(() => {
    const saved = localStorage.getItem("matchRosters");
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedRosterMatchId, setSelectedRosterMatchId] = useState("");

  const [loanForm, setLoanForm] = useState({
    side: "teamA",
    playerId: "",
  });

  const [playerStats, setPlayerStats] = useState(() => {
    const saved = localStorage.getItem("playerStats");
    return saved ? JSON.parse(saved) : {};
  });

  const [matchStatInputs, setMatchStatInputs] = useState(() => {
    const saved = localStorage.getItem("matchStatInputs");
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedStatsMatchId, setSelectedStatsMatchId] = useState("");
  const [selectedProfilePlayerId, setSelectedProfilePlayerId] = useState("");
  const [profileCardView, setProfileCardView] = useState("current");
  const [publicProfileSeasonContext, setPublicProfileSeasonContext] =
    useState(null);

  // ======================================================
  // 05. STATE: TEAM LOGOS / LOCK GROUPS
  // ======================================================

  const [teamLogos, setTeamLogos] = useState(() => {
    const saved = localStorage.getItem("teamLogos");
    return saved ? JSON.parse(saved) : {};
  });

  const [lockGroups, setLockGroups] = useState(() => {
    const saved = localStorage.getItem("lockGroups");
    return saved ? JSON.parse(saved) : [];
  });

  const [lockGroupName, setLockGroupName] = useState("");
  const [selectedLockPlayerIds, setSelectedLockPlayerIds] = useState([]);

  // ======================================================
  // 06. STATE: SEASON / DASHBOARD / UI MODE
  // ======================================================

  const [seasonByType, setSeasonByType] = useState(() => {
    const saved = localStorage.getItem("seasonByType");

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          "3X3": Number(parsed?.["3X3"] || 1),
          "5X5": Number(parsed?.["5X5"] || 1),
        };
      } catch (error) {
        return { "3X3": 1, "5X5": 1 };
      }
    }

    const legacySeason = Number(localStorage.getItem("currentSeason") || 1);

    return {
      "3X3": 1,
      "5X5":
        Number.isFinite(legacySeason) && legacySeason >= 1 ? legacySeason : 1,
    };
  });

  const currentSeason = seasonByType[competitionType] || 1;

  const [seasonProjectName, setSeasonProjectName] = useState(() => {
    return localStorage.getItem("seasonProjectName") || "";
  });

  const getDefaultSeasonProjectName = (
    type = competitionType,
    season = currentSeason,
  ) => `${type} Season ${season}`;

  const getCurrentSeasonTitle = () =>
    seasonProjectName.trim() || getDefaultSeasonProjectName();

  const [seasonHistory, setSeasonHistory] = useState(() => {
    const saved = localStorage.getItem("seasonHistory");
    return saved ? JSON.parse(saved) : [];
  });

  const [hallOfFameFilter, setHallOfFameFilter] = useState("ALL");
  const [publicSeasonId, setPublicSeasonId] = useState("CURRENT");
  const isPublicOnlyRoute = window.location.hash === "#/public";
  const [viewMode, setViewMode] = useState(() =>
    isPublicOnlyRoute ? "PUBLIC" : "ADMIN",
  );
  const [selectedPublicTeam, setSelectedPublicTeam] = useState("");
  const [publicDashboardTab, setPublicDashboardTab] = useState("overview");
  const [selectedPublicPlayer, setSelectedPublicPlayer] = useState(null);
  const [selectedPublicMatch, setSelectedPublicMatch] = useState(null);
  const [cloudStatus, setCloudStatus] = useState("Saved");
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [activeAdminMenu, setActiveAdminMenu] = useState("players");
  const [expandedTeamDashboard, setExpandedTeamDashboard] = useState("");
  const [selectedFinalsMvpId, setSelectedFinalsMvpId] = useState("");
  const [editingSeasonHistoryId, setEditingSeasonHistoryId] = useState(null);
  const [seasonHistoryEditForm, setSeasonHistoryEditForm] = useState({
    projectName: "",
    competitionType: "5X5",
    season: 1,
    closedAtText: "",
    champion: "",
    runnerUp: "",
    thirdPlace: "",
    regularSeasonMvp: "",
    finalsMvp: "",
    topScorer: "",
    topScorerPts: 0,
    reboundLeader: "",
    reboundLeaderReb: 0,
    assistLeader: "",
    assistLeaderAst: 0,
    notes: "",
  });

  const [databaseMeta, setDatabaseMeta] = useState(() => {
    const saved = localStorage.getItem("bamDatabaseMeta");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        return { version: "legacy", lastMigrationAt: "" };
      }
    }

    return { version: "legacy", lastMigrationAt: "" };
  });

  const [publishMeta, setPublishMeta] = useState(() => {
    const saved = localStorage.getItem("bamPublishMeta");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        return {
          lastValidatedAt: "",
          lastPublishedAt: "",
          validationPassed: false,
          validationScore: 0,
          issues: [],
        };
      }
    }

    return {
      lastValidatedAt: "",
      lastPublishedAt: "",
      validationPassed: false,
      validationScore: 0,
      issues: [],
    };
  });

  // ======================================================
  // 07. LOCAL STORAGE SYNC
  // ======================================================

  useEffect(() => {
    localStorage.setItem("players", JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem("drafts", JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    localStorage.setItem("schedule", JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    localStorage.setItem("teamNames", JSON.stringify(teamNames));
  }, [teamNames]);

  useEffect(() => {
    localStorage.setItem("teamCount", String(teamCount));
  }, [teamCount]);

  useEffect(() => {
    localStorage.setItem("competitionType", competitionType);
  }, [competitionType]);

  useEffect(() => {
    localStorage.setItem("teamLogos", JSON.stringify(teamLogos));
  }, [teamLogos]);

  useEffect(() => {
    localStorage.setItem("lockGroups", JSON.stringify(lockGroups));
  }, [lockGroups]);

  useEffect(() => {
    localStorage.setItem("seasonByType", JSON.stringify(seasonByType));
  }, [seasonByType]);

  useEffect(() => {
    localStorage.setItem("seasonProjectName", seasonProjectName);
  }, [seasonProjectName]);

  useEffect(() => {
    localStorage.setItem("seasonHistory", JSON.stringify(seasonHistory));
  }, [seasonHistory]);

  useEffect(() => {
    localStorage.setItem("matchRosters", JSON.stringify(matchRosters));
  }, [matchRosters]);

  useEffect(() => {
    localStorage.setItem("teams", JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    localStorage.setItem("playerStats", JSON.stringify(playerStats));
  }, [playerStats]);

  useEffect(() => {
    localStorage.setItem("matchStatInputs", JSON.stringify(matchStatInputs));
  }, [matchStatInputs]);

  useEffect(() => {
    localStorage.setItem("bamDatabaseMeta", JSON.stringify(databaseMeta));
  }, [databaseMeta]);

  useEffect(() => {
    localStorage.setItem("bamPublishMeta", JSON.stringify(publishMeta));
  }, [publishMeta]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setAdminUser(user);
        setAuthLoading(false);
        setAuthError("");
      },
      (error) => {
        console.error("Firebase Auth Error:", error);
        setAdminUser(null);
        setAuthLoading(false);
        setAuthError("Firebase Auth ??????????????");
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (selectedProfilePlayerId && !publicProfileSeasonContext) {
      setProfileCardView("current");
    }
  }, [selectedProfilePlayerId, publicProfileSeasonContext]);

  useEffect(() => {
    if (!selectedPublicMatch) return undefined;

    const handlePublicMatchEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedPublicMatch(null);
      }
    };

    window.addEventListener("keydown", handlePublicMatchEscape);
    return () => {
      window.removeEventListener("keydown", handlePublicMatchEscape);
    };
  }, [selectedPublicMatch]);

  useEffect(() => {
    const hasLegacyLocks =
      players.some((player) => player.lockedTeam) ||
      teams.some((team) =>
        (team.players || []).some((player) => player.lockedTeam),
      );

    if (!hasLegacyLocks) return;

    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => ({ ...player, lockedTeam: "" })),
    );

    setTeams((prevTeams) =>
      prevTeams.map((team) => ({
        ...team,
        players: (team.players || []).map((player) => ({
          ...player,
          lockedTeam: "",
        })),
      })),
    );
  }, []);

  const parseBamPlayerNumber = (bamPlayerId) => {
    const match = String(bamPlayerId || "").match(/^BAM-(\d+)$/);
    return match ? Number(match[1]) : 0;
  };

  const formatBamPlayerId = (number) =>
    `${BAM_PLAYER_ID_PREFIX}-${String(number).padStart(6, "0")}`;

  const getHighestBamPlayerNumber = (playerList = players) =>
    playerList.reduce(
      (max, player) => Math.max(max, parseBamPlayerNumber(player.bamPlayerId)),
      0,
    );

  const getNextBamPlayerId = (offset = 1, playerList = players) =>
    formatBamPlayerId(getHighestBamPlayerNumber(playerList) + offset);

  const getPlayerDisplayId = (player) =>
    player?.bamPlayerId || player?.playerCode || player?.id || "-";

  const findPlayerByBamId = (bamPlayerId) =>
    players.find(
      (player) =>
        String(player.bamPlayerId || "") === String(bamPlayerId || ""),
    );

  const findPlayerByName = (playerName) => {
    const target = String(playerName || "")
      .trim()
      .toLowerCase();
    if (!target) return null;
    return players.find(
      (player) =>
        String(player.name || "")
          .trim()
          .toLowerCase() === target,
    );
  };

  const getPlayerIdentityFromName = (playerName) => {
    const matchedPlayer = findPlayerByName(playerName);
    if (!matchedPlayer) {
      return {
        key: getCareerPlayerKey(playerName),
        bamPlayerId: "",
        playerName: String(playerName || "").trim(),
      };
    }

    return {
      key: matchedPlayer.bamPlayerId || getCareerPlayerKey(matchedPlayer.name),
      bamPlayerId: matchedPlayer.bamPlayerId || "",
      playerName: matchedPlayer.name || playerName,
    };
  };

  const ensureBamPlayerIds = (playerList = []) => {
    let nextNumber = getHighestBamPlayerNumber(playerList);
    return playerList.map((player) => {
      if (player.bamPlayerId) return player;
      nextNumber += 1;
      return {
        ...player,
        bamPlayerId: formatBamPlayerId(nextNumber),
        identityVersion: CORE_DATABASE_VERSION,
      };
    });
  };

  const syncTeamPlayerIdentities = (teamList, playerList) => {
    const identityMap = new Map(
      playerList.map((player) => [String(player.id), player.bamPlayerId || ""]),
    );

    return teamList.map((team) => ({
      ...team,
      players: (team.players || []).map((player) => ({
        ...player,
        bamPlayerId:
          player.bamPlayerId || identityMap.get(String(player.id)) || "",
        identityVersion: player.identityVersion || CORE_DATABASE_VERSION,
      })),
    }));
  };

  const migrateCoreDatabase = () => {
    const migratedPlayers = ensureBamPlayerIds(players);
    const hasPlayerMigration = migratedPlayers.some(
      (player, index) => player.bamPlayerId !== players[index]?.bamPlayerId,
    );
    const migratedTeams = syncTeamPlayerIdentities(teams, migratedPlayers);
    const hasTeamMigration =
      JSON.stringify(migratedTeams) !== JSON.stringify(teams);

    if (hasPlayerMigration) setPlayers(migratedPlayers);
    if (hasTeamMigration) setTeams(migratedTeams);

    setDatabaseMeta((prevMeta) => ({
      ...prevMeta,
      version: CORE_DATABASE_VERSION,
      lastMigrationAt: new Date().toISOString(),
      lastMigrationText: new Date().toLocaleString(),
    }));

    if (hasPlayerMigration || hasTeamMigration) {
      alert(
        "Core Database upgraded: BAM Player ID ถูกสร้างให้ผู้เล่นเดิมเรียบร้อย",
      );
    } else {
      alert("Core Database already healthy: ข้อมูลเป็นเวอร์ชันล่าสุดแล้ว");
    }
  };

  const getDatabaseHealthReport = () => {
    const duplicateBamIds = players
      .map((player) => player.bamPlayerId)
      .filter(Boolean)
      .filter((id, index, list) => list.indexOf(id) !== index);

    const missingBamIds = players.filter(
      (player) => !player.bamPlayerId,
    ).length;
    const seasonRecordsWithoutVersion = seasonHistory.filter(
      (season) => !season.dataVersion && !season.version,
    ).length;
    const careerRows = buildPlayerCareerData();

    const checks = [
      {
        label: "Database Version",
        ok: databaseMeta.version === CORE_DATABASE_VERSION,
      },
      { label: "Player Identity", ok: missingBamIds === 0 },
      { label: "Duplicate BAM ID", ok: duplicateBamIds.length === 0 },
      { label: "Career Rebuild", ok: Array.isArray(careerRows) },
      { label: "Season History", ok: seasonHistory.length >= 0 },
    ];

    const passed = checks.filter((check) => check.ok).length;
    const healthScore = Math.round((passed / checks.length) * 100);

    return {
      checks,
      healthScore,
      duplicateBamIds,
      missingBamIds,
      seasonRecordsWithoutVersion,
      careerPlayers: careerRows.length,
    };
  };

  const renderSystemHealthCard = () => {
    const report = getDatabaseHealthReport();
    const statusColor = report.healthScore >= 90 ? "#15803d" : "#b45309";

    return (
      <div
        style={{
          border: "1px solid #bbf7d0",
          borderRadius: "14px",
          padding: "14px",
          background: "#f0fdf4",
        }}
      >
        <h3 style={{ marginTop: 0 }}>🧠 Core Database Engine V4</h3>
        <div
          style={{ fontSize: "28px", fontWeight: "bold", color: statusColor }}
        >
          System Health {report.healthScore}%
        </div>
        <p style={{ marginTop: "6px", color: "#166534" }}>
          Database Version: <strong>{databaseMeta.version}</strong> / Target:{" "}
          <strong>{CORE_DATABASE_VERSION}</strong>
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <div>
            🆔 Players: <strong>{players.length}</strong>
          </div>
          <div>
            ✅ Missing BAM ID: <strong>{report.missingBamIds}</strong>
          </div>
          <div>
            ⚠️ Duplicate ID: <strong>{report.duplicateBamIds.length}</strong>
          </div>
          <div>
            🏀 Career Players: <strong>{report.careerPlayers}</strong>
          </div>
        </div>
        <ul style={{ margin: "0 0 12px", paddingLeft: "20px" }}>
          {report.checks.map((check) => (
            <li key={check.label} style={{ marginBottom: "4px" }}>
              {check.ok ? "✅" : "⚠️"} {check.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={migrateCoreDatabase}
          style={{ marginRight: "8px" }}
        >
          Run Core Migration / Health Check
        </button>
        <button
          type="button"
          onClick={() =>
            alert(`Career rebuilt from ${seasonHistory.length} season records.`)
          }
        >
          Rebuild Career Preview
        </button>
        <p style={{ marginBottom: 0, color: "#166534", fontSize: "12px" }}>
          Last Migration: {databaseMeta.lastMigrationText || "-"}
        </p>
      </div>
    );
  };

  useEffect(() => {
    if (databaseMeta.version === CORE_DATABASE_VERSION) return;
    const migratedPlayers = ensureBamPlayerIds(players);
    const migratedTeams = syncTeamPlayerIdentities(teams, migratedPlayers);

    if (JSON.stringify(migratedPlayers) !== JSON.stringify(players)) {
      setPlayers(migratedPlayers);
    }

    if (JSON.stringify(migratedTeams) !== JSON.stringify(teams)) {
      setTeams(migratedTeams);
    }

    setDatabaseMeta((prevMeta) => ({
      ...prevMeta,
      version: CORE_DATABASE_VERSION,
      lastMigrationAt: new Date().toISOString(),
      lastMigrationText: new Date().toLocaleString(),
      autoMigrated: true,
    }));
  }, []);

  // ======================================================
  // 08. LEAGUE SETUP HANDLERS
  // ======================================================

  const handleTeamCountChange = (value) => {
    const nextCount = Number(value);

    if (!Number.isFinite(nextCount) || nextCount < 3) return;

    const hasLeagueData =
      teams.length > 0 ||
      schedule.length > 0 ||
      drafts.length > 0 ||
      Object.keys(matchRosters).length > 0 ||
      Object.keys(playerStats).length > 0 ||
      Object.keys(matchStatInputs).length > 0;

    if (hasLeagueData) {
      const confirmChange = window.confirm(
        "การเปลี่ยนจำนวนทีมจะล้างทีม ตารางแข่ง Draft Match Roster และสถิติเดิม แต่จะไม่ลบรายชื่อผู้เล่น ต้องการดำเนินการต่อไหม?",
      );

      if (!confirmChange) return;
    }

    const nextTeamNames = createDefaultTeamNames(nextCount);

    setTeamCount(nextCount);
    setTeamNames(nextTeamNames);
    setTeams([]);
    setSchedule([]);
    setDrafts([]);
    setLockGroups([]);
    setSelectedLockPlayerIds([]);
    setLockGroupName("");
    setMatchRosters({});
    setPlayerStats({});
    setMatchStatInputs({});
    setSelectedRosterMatchId("");
    setSelectedStatsMatchId("");
    setSelectedProfilePlayerId("");
    setSelectedFinalsMvpId("");
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => ({ ...player, teamName: "" })),
    );
  };

  const handleCompetitionTypeChange = (value) => {
    const nextType = value === "3X3" ? "3X3" : "5X5";

    if (nextType === competitionType) return;

    const hasLeagueData =
      teams.length > 0 ||
      schedule.length > 0 ||
      drafts.length > 0 ||
      Object.keys(matchRosters).length > 0 ||
      Object.keys(playerStats).length > 0 ||
      Object.keys(matchStatInputs).length > 0;

    if (hasLeagueData) {
      const confirmChange = window.confirm(
        "การเปลี่ยนประเภทการแข่งขันจะล้างทีม ตารางแข่ง Draft Match Roster และสถิติเดิม แต่จะไม่ลบรายชื่อผู้เล่น ต้องการดำเนินการต่อไหม?",
      );

      if (!confirmChange) return;
    }

    setCompetitionType(nextType);
    setTeams([]);
    setSchedule([]);
    setDrafts([]);
    setLockGroups([]);
    setSelectedLockPlayerIds([]);
    setLockGroupName("");
    setMatchRosters({});
    setPlayerStats({});
    setMatchStatInputs({});
    setSelectedRosterMatchId("");
    setSelectedStatsMatchId("");
    setSelectedProfilePlayerId("");
    setSelectedFinalsMvpId("");
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => ({ ...player, teamName: "" })),
    );
  };

  const getMinPlayersPerGame = () => {
    return competitionType === "3X3" ? 3 : 5;
  };

  const updateTeamName = (index, newName) => {
    const oldName =
      teams[index]?.name || teamNames[index] || defaultTeamNames[index];

    setTeamNames((prevNames) => {
      const updated = [...prevNames];
      updated[index] = newName;
      return updated;
    });

    setTeams((prevTeams) =>
      prevTeams.map((team, i) =>
        i === index
          ? {
              ...team,
              name: newName,
              players: team.players.map((player) => ({
                ...player,
                teamName: newName,
              })),
            }
          : team,
      ),
    );

    setPlayers((prevPlayers) =>
      prevPlayers.map((player) =>
        player.teamName === oldName
          ? {
              ...player,
              teamName: newName,
            }
          : player,
      ),
    );

    setSchedule((prevSchedule) =>
      prevSchedule.map((match) => ({
        ...match,
        teamA: match.teamA === oldName ? newName : match.teamA,
        teamB: match.teamB === oldName ? newName : match.teamB,
      })),
    );

    setTeamLogos((prevLogos) => {
      if (!prevLogos[oldName] || oldName === newName) return prevLogos;
      const updated = { ...prevLogos, [newName]: prevLogos[oldName] };
      delete updated[oldName];
      return updated;
    });
  };

  // ======================================================
  // 09. PLAYER RATING / TIER HELPERS
  // ======================================================

  const clampSkill = (value) => Math.min(5, Math.max(1, Number(value || 3)));

  const calculateRatingFromSkills = (player) => {
    const skills = [
      Number(player.dribbling || 3),
      Number(player.insideScoring || 3),
      Number(player.shooting || 3),
      Number(player.defense || 3),
      Number(player.passing || 3),
    ];

    return Math.round((skills.reduce((a, b) => a + b, 0) / 5) * 20);
  };

  const calculateTierFromRating = (rating) => {
    const score = Number(rating || 0);
    if (score >= 90) return "SSS+";
    if (score >= 80) return "S+";
    if (score >= 70) return "S-";
    if (score >= 60) return "A+";
    if (score >= 50) return "A-";
    if (score >= 45) return "B+";
    if (score >= 40) return "B-";
    return "C";
  };

  const getFinalTier = (tier, rating) => {
    const cleanTier = String(tier || "")
      .trim()
      .toUpperCase();
    return validTiers.includes(cleanTier)
      ? cleanTier
      : calculateTierFromRating(rating);
  };

  const getPlayerScore = (player) =>
    Number(player.rating || calculateRatingFromSkills(player));

  // ======================================================
  // 10. MEDIA / IMAGE HELPERS
  // ======================================================

  const readImageAsDataUrl = (file, callback) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    const maxSizeMB = 2;
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`ไฟล์รูปใหญ่เกิน ${maxSizeMB}MB กรุณาเลือกรูปที่เล็กลง`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => callback(reader.result);
    reader.readAsDataURL(file);
  };

  const handlePlayerPhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCloudStatus("Uploading player photo...");
      const imageUrl = await uploadPlayerPhoto(file, editingId || "new");

      setForm((prevForm) => ({
        ...prevForm,
        photoUrl: imageUrl,
      }));

      setCloudStatus("Saved");
    } catch (error) {
      console.error(error);
      alert(error.message || "อัปโหลดรูปผู้เล่นไม่สำเร็จ");
      setCloudStatus("Upload failed");
    } finally {
      event.target.value = "";
    }
  };

  const handleNewRosterPhotoUpload = (event) => {
    const file = event.target.files?.[0];
    readImageAsDataUrl(file, (imageUrl) => {
      setNewRosterForm((prevForm) => ({
        ...prevForm,
        photoUrl: imageUrl,
      }));
    });
    event.target.value = "";
  };

  const uploadTeamLogo = async (teamName, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCloudStatus("Uploading team logo...");
      const imageUrl = await uploadTeamLogoToCloud(file, teamName);

      setTeamLogos((prevLogos) => ({
        ...prevLogos,
        [teamName]: imageUrl,
      }));

      setCloudStatus("Saved");
    } catch (error) {
      console.error(error);
      alert(error.message || "อัปโหลดโลโก้ทีมไม่สำเร็จ");
      setCloudStatus("Upload failed");
    } finally {
      event.target.value = "";
    }
  };

  const removeTeamLogo = (teamName) => {
    setTeamLogos((prevLogos) => {
      const updated = { ...prevLogos };
      delete updated[teamName];
      return updated;
    });
  };

  const uploadExistingPlayerPhoto = async (playerId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCloudStatus("Uploading player photo...");
      const imageUrl = await uploadPlayerPhoto(file, playerId);

      setPlayers((prevPlayers) =>
        prevPlayers.map((player) =>
          player.id === playerId
            ? {
                ...player,
                photoUrl: imageUrl,
              }
            : player,
        ),
      );

      setTeams((prevTeams) =>
        buildFinalTeams(
          prevTeams.map((team) => ({
            ...team,
            players: (team.players || []).map((player) =>
              player.id === playerId
                ? {
                    ...player,
                    photoUrl: imageUrl,
                  }
                : player,
            ),
          })),
        ),
      );

      setCloudStatus("Saved");
    } catch (error) {
      console.error(error);
      alert(error.message || "อัปโหลดรูปผู้เล่นไม่สำเร็จ");
      setCloudStatus("Upload failed");
    } finally {
      event.target.value = "";
    }
  };

  const removeExistingPlayerPhoto = (playerId) => {
    if (!window.confirm("ต้องการลบรูปผู้เล่นนี้ใช่ไหม?")) return;

    setPlayers((prevPlayers) =>
      prevPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              photoUrl: "",
            }
          : player,
      ),
    );

    setTeams((prevTeams) =>
      buildFinalTeams(
        prevTeams.map((team) => ({
          ...team,
          players: (team.players || []).map((player) =>
            player.id === playerId
              ? {
                  ...player,
                  photoUrl: "",
                }
              : player,
          ),
        })),
      ),
    );
  };

  const getPlayerPhotoUrl = (playerId) => {
    const player = players.find((item) => String(item.id) === String(playerId));
    return player?.photoUrl || "";
  };

  const getPlayerPhotoByName = (playerName) => {
    const player = players.find((item) => item.name === playerName);
    return player?.photoUrl || "";
  };

  const renderPlayerAvatar = (photoUrl, size = 42) =>
    photoUrl ? (
      <img
        src={photoUrl}
        alt="player"
        width={size}
        height={size}
        style={{
          borderRadius: "50%",
          objectFit: "cover",
          border: "1px solid #ddd",
          verticalAlign: "middle",
        }}
      />
    ) : (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#eee",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.max(12, Math.round(size * 0.35)),
          border: "1px solid #ddd",
          verticalAlign: "middle",
        }}
      >
        🏀
      </div>
    );

  const renderTeamLogo = (teamName, size = 42) =>
    teamLogos[teamName] ? (
      <img
        src={teamLogos[teamName]}
        alt={teamName}
        width={size}
        height={size}
        style={{
          objectFit: "contain",
          borderRadius: "8px",
          border: "1px solid #ddd",
          background: "white",
          verticalAlign: "middle",
        }}
      />
    ) : (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "8px",
          background: "#eee",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.max(12, Math.round(size * 0.35)),
          border: "1px solid #ddd",
          verticalAlign: "middle",
        }}
      >
        🛡️
      </div>
    );

  const renderTeamWithLogo = (teamName, size = 32) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      {renderTeamLogo(teamName, size)}
      <span>{teamName}</span>
    </span>
  );

  // ======================================================
  // 11. PLAYER CRUD HANDLERS
  // ======================================================

  const resetForm = () => {
    setForm({
      name: "",
      tier: "",
      pos1: "PG",
      pos2: "",
      dribbling: 3,
      insideScoring: 3,
      shooting: 3,
      defense: 3,
      passing: 3,
      available: true,
      lockedTeam: "",
      photoUrl: "",
    });
    setEditingId(null);
  };

  const addOrUpdatePlayer = () => {
    if (!form.name.trim()) {
      alert("กรุณากรอกชื่อผู้เล่น");
      return;
    }

    const rating = calculateRatingFromSkills(form);

    const playerData = {
      bamPlayerId: editingId
        ? players.find((player) => player.id === editingId)?.bamPlayerId ||
          getNextBamPlayerId()
        : getNextBamPlayerId(),
      identityVersion: CORE_DATABASE_VERSION,
      name: form.name.trim(),
      tier: getFinalTier(form.tier, rating),
      rating,
      pos1: form.pos1,
      pos2: form.pos2,
      dribbling: clampSkill(form.dribbling),
      insideScoring: clampSkill(form.insideScoring),
      shooting: clampSkill(form.shooting),
      defense: clampSkill(form.defense),
      passing: clampSkill(form.passing),
      available: form.available,
      lockedTeam: "",
      photoUrl: form.photoUrl || "",
    };

    if (editingId) {
      setPlayers(
        players.map((p) => (p.id === editingId ? { ...p, ...playerData } : p)),
      );

      setTeams((prevTeams) =>
        buildFinalTeams(
          prevTeams.map((team) => ({
            ...team,
            players: (team.players || []).map((player) =>
              player.id === editingId ? { ...player, ...playerData } : player,
            ),
          })),
        ),
      );
    } else {
      setPlayers([...players, { id: Date.now(), ...playerData }]);
    }

    resetForm();
  };

  const startEditPlayer = (player) => {
    setEditingId(player.id);
    setForm({
      name: player.name || "",
      tier: "",
      pos1: player.pos1 || "PG",
      pos2: player.pos2 || "",
      dribbling: player.dribbling || 3,
      insideScoring: player.insideScoring || 3,
      shooting: player.shooting || 3,
      defense: player.defense || 3,
      passing: player.passing || 3,
      available: player.available ?? true,
      lockedTeam: "",
      photoUrl: player.photoUrl || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deletePlayer = (id) => {
    setPlayers(players.filter((p) => p.id !== id));
  };

  const toggleAvailable = (id) => {
    setPlayers(
      players.map((p) => (p.id === id ? { ...p, available: !p.available } : p)),
    );
  };

  const updateLockedTeam = (id) => {
    setPlayers((prevPlayers) =>
      prevPlayers.map((p) => (p.id === id ? { ...p, lockedTeam: "" } : p)),
    );

    setTeams((prevTeams) =>
      prevTeams.map((team) => ({
        ...team,
        players: team.players.map((p) =>
          p.id === id ? { ...p, lockedTeam: "" } : p,
        ),
      })),
    );
  };

  const clearAllPlayers = () => {
    if (!window.confirm("ต้องการลบผู้เล่นทั้งหมดใช่ไหม?")) return;
    setTeamCount(defaultTeamCount);
    setCompetitionType("5X5");
    setPlayers([]);
    setTeams([]);
    setSchedule([]);
    setTeamLogos({});
    setLockGroups([]);
    setSeasonProjectName("");
    setSelectedLockPlayerIds([]);
    setLockGroupName("");
    setSelectedProfilePlayerId("");
    resetForm();
    localStorage.removeItem("teamCount");
    localStorage.removeItem("teamCount");
    localStorage.removeItem("competitionType");
    localStorage.removeItem("players");
    localStorage.removeItem("teams");
    localStorage.removeItem("schedule");
    localStorage.removeItem("drafts");
    localStorage.removeItem("teamNames");
    localStorage.removeItem("matchRosters");
    localStorage.removeItem("playerStats");
    localStorage.removeItem("matchStatInputs");
    localStorage.removeItem("teamLogos");
    localStorage.removeItem("lockGroups");
    localStorage.removeItem("seasonProjectName");
  };

  // ======================================================
  // 12. CSV IMPORT / EXPORT HELPERS
  // NOTE: Keep this internal while CodeSandbox limits file creation.
  // Later migrate this region to src/services/csv/playerCsvService.js.
  // ======================================================

  const downloadCSV = (filename, rows) => {
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const downloadTemplate = () => {
    downloadCSV("bam_players_template.csv", [
      [
        "BAM_ID",
        "Name",
        "Tier",
        "Pos1",
        "Pos2",
        "Dribbling",
        "InsideScoring",
        "Shooting",
        "Defense",
        "Passing",
      ],
      ["", "ปัญจสุทธิ์", "SSS+", "SF", "PF", "3", "4", "3", "5", "3"],
      ["", "ริรักทร", "", "PG", "SG", "5", "4", "3", "3", "5", ""],
      ["", "ธนากร", "", "C", "PF", "5", "5", "4", "5", "5", ""],
    ]);
  };

  const exportCSV = () => {
    if (players.length === 0) {
      alert("ยังไม่มีข้อมูลผู้เล่น");
      return;
    }

    downloadCSV("bam_players.csv", [
      [
        "BAM_ID",
        "Name",
        "Tier",
        "Rating",
        "Pos1",
        "Pos2",
        "Dribbling",
        "InsideScoring",
        "Shooting",
        "Defense",
        "Passing",
        "Available",
      ],
      ...players.map((p) => [
        p.bamPlayerId || "",
        p.name,
        p.tier,
        p.rating,
        p.pos1,
        p.pos2 || "",
        p.dribbling,
        p.insideScoring,
        p.shooting,
        p.defense,
        p.passing,
        p.available ? "Yes" : "No",
      ]),
    ]);
  };

  const parseCSVLine = (line) => line.split(",").map((x) => x.trim());

  const decodeCSVFile = async (file) => {
    const buffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�"))
      text = new TextDecoder("windows-874").decode(buffer);
    return text;
  };

  const importCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await decodeCSVFile(file);
    const lines = text.split(/\r?\n/).filter(Boolean);

    const imported = lines
      .slice(1)
      .map((line, index) => {
        const columns = parseCSVLine(line);
        const hasBamIdColumn = String(columns[0] || "")
          .trim()
          .toUpperCase()
          .startsWith("BAM-");
        const [
          bamIdRaw,
          name,
          tierRaw,
          pos1Raw,
          pos2Raw,
          dribblingRaw,
          insideRaw,
          shootingRaw,
          defenseRaw,
          passingRaw,
        ] = hasBamIdColumn ? columns : ["", ...columns];

        const pos1 = String(pos1Raw || "PG")
          .trim()
          .toUpperCase();
        const pos2 = String(pos2Raw || "")
          .trim()
          .toUpperCase();
        const base = {
          id: Date.now() + index,
          bamPlayerId:
            String(bamIdRaw || "").trim() || getNextBamPlayerId(index + 1),
          identityVersion: CORE_DATABASE_VERSION,
          name: String(name || "").trim(),
          pos1: validPositions.includes(pos1) ? pos1 : "PG",
          pos2: validPositions.includes(pos2) ? pos2 : "",
          dribbling: clampSkill(dribblingRaw),
          insideScoring: clampSkill(insideRaw),
          shooting: clampSkill(shootingRaw),
          defense: clampSkill(defenseRaw),
          passing: clampSkill(passingRaw),
          available: true,
          lockedTeam: "",
        };

        const rating = calculateRatingFromSkills(base);

        return {
          ...base,
          rating,
          tier: getFinalTier(tierRaw, rating),
        };
      })
      .filter((p) => p.name);

    setPlayers([...players, ...imported]);
    alert(`Import สำเร็จ ${imported.length} คน`);
    event.target.value = "";
  };

  // ======================================================
  // 13. DRAFT ENGINE HELPERS
  // NOTE: Later migrate this region to src/services/draft/draftService.js.
  // ======================================================

  const hasEliteConflict = (teamPlayers, newPlayer) => {
    const hasSSS = teamPlayers.some((p) => p.tier === "SSS+");
    const hasS = teamPlayers.some((p) => p.tier === "S+" || p.tier === "S-");

    if (newPlayer.tier === "SSS+" && hasS) return true;
    if ((newPlayer.tier === "S+" || newPlayer.tier === "S-") && hasSSS) {
      return true;
    }

    return false;
  };

  const has3x3TierConflict = (teamPlayers, newPlayer) => {
    const teamHasSSS = teamPlayers.some((p) => p.tier === "SSS+");

    if (!teamHasSSS) return false;

    const blockedTiers = ["SSS+", "S+", "S-", "A+"];
    return blockedTiers.includes(newPlayer.tier);
  };

  const getEliteWarning = (teamPlayers) => {
    const hasSSS = teamPlayers.some((p) => p.tier === "SSS+");

    if (competitionType === "3X3") {
      const hasBlockedTier = teamPlayers.some((p) =>
        ["SSS+", "S+", "S-", "A+"].includes(p.tier),
      );
      return hasSSS && hasBlockedTier && teamPlayers.length > 1;
    }

    const hasS = teamPlayers.some((p) => p.tier === "S+" || p.tier === "S-");
    return hasSSS && hasS;
  };

  const shuffleArray = (array) => {
    const cloned = [...array];
    for (let i = cloned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
    }
    return cloned;
  };

  const getRatingGroup = (player) => {
    const score = getPlayerScore(player);
    if (score >= 90) return 1;
    if (score >= 80) return 2;
    if (score >= 70) return 3;
    if (score >= 60) return 4;
    if (score >= 50) return 5;
    if (score >= 45) return 6;
    if (score >= 40) return 7;
    return 8;
  };

  const preparePlayersForDraft = (availablePlayers) => {
    const groups = {};

    availablePlayers.forEach((player) => {
      const group = getRatingGroup(player);
      if (!groups[group]) groups[group] = [];
      groups[group].push(player);
    });

    return Object.keys(groups)
      .sort((a, b) => Number(a) - Number(b))
      .flatMap((group) =>
        shuffleArray(groups[group]).sort((a, b) => {
          const diff = getPlayerScore(b) - getPlayerScore(a);
          if (Math.abs(diff) <= 5) return Math.random() - 0.5;
          return diff;
        }),
      );
  };

  const getPlayerNameById = (playerId) => {
    const player = players.find((item) => String(item.id) === String(playerId));
    return player?.name || "Unknown Player";
  };

  const createLockGroup = () => {
    if (selectedLockPlayerIds.length < 2) {
      alert("กรุณาเลือกผู้เล่นอย่างน้อย 2 คนสำหรับ Lock Group");
      return;
    }

    const alreadyLockedIds = lockGroups.flatMap(
      (group) => group.playerIds || [],
    );
    const duplicatePlayers = selectedLockPlayerIds.filter((playerId) =>
      alreadyLockedIds.map(String).includes(String(playerId)),
    );

    if (duplicatePlayers.length > 0) {
      alert(
        `ผู้เล่นต่อไปนี้อยู่ใน Lock Group แล้ว: ${duplicatePlayers
          .map(getPlayerNameById)
          .join(", ")}`,
      );
      return;
    }

    const nextGroup = {
      id: Date.now(),
      name: lockGroupName.trim() || `Lock Group ${lockGroups.length + 1}`,
      playerIds: selectedLockPlayerIds.map((id) => Number(id)),
    };

    setLockGroups((prevGroups) => [...prevGroups, nextGroup]);
    setLockGroupName("");
    setSelectedLockPlayerIds([]);
  };

  const deleteLockGroup = (groupId) => {
    if (!window.confirm("ต้องการลบ Lock Group นี้ใช่ไหม?")) return;
    setLockGroups((prevGroups) =>
      prevGroups.filter((group) => group.id !== groupId),
    );
  };

  const clearLockGroups = () => {
    if (!window.confirm("ต้องการลบ Lock Group ทั้งหมดใช่ไหม?")) return;
    setLockGroups([]);
    setSelectedLockPlayerIds([]);
    setLockGroupName("");
  };

  const calculateTeamScore = (teamPlayers) =>
    teamPlayers.reduce((sum, p) => sum + getPlayerScore(p), 0);

  const getPositionSummary = (teamPlayers) => {
    const summary = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };

    teamPlayers.forEach((p) => {
      if (summary[p.pos1] !== undefined) summary[p.pos1] += 1;
      if (p.pos2 && summary[p.pos2] !== undefined) summary[p.pos2] += 0.5;
    });

    return summary;
  };

  const getMissingPositions = (summary) =>
    validPositions.filter((pos) => summary[pos] === 0);

  const getTeamSkillTotals = (teamPlayers) => ({
    dribbling: teamPlayers.reduce((s, p) => s + Number(p.dribbling || 0), 0),
    insideScoring: teamPlayers.reduce(
      (s, p) => s + Number(p.insideScoring || 0),
      0,
    ),
    shooting: teamPlayers.reduce((s, p) => s + Number(p.shooting || 0), 0),
    defense: teamPlayers.reduce((s, p) => s + Number(p.defense || 0), 0),
    passing: teamPlayers.reduce((s, p) => s + Number(p.passing || 0), 0),
  });

  const buildFinalTeams = (baseTeams) => {
    return baseTeams.map((team) => {
      const positionSummary = getPositionSummary(team.players);

      return {
        ...team,
        totalScore: calculateTeamScore(team.players),
        skillTotals: getTeamSkillTotals(team.players),
        positionSummary,
        missingPositions: getMissingPositions(positionSummary),
        eliteWarning: getEliteWarning(team.players),
      };
    });
  };

  const getDraftConflictPenalty = (teamPlayers, player) => {
    if (competitionType === "3X3") {
      return has3x3TierConflict(teamPlayers, player) ? 10000 : 0;
    }

    return hasEliteConflict(teamPlayers, player) ? 10000 : 0;
  };

  const getBestDraftTeam = (candidateTeams, player) => {
    return [...candidateTeams].sort((a, b) => {
      const aScore = calculateTeamScore(a.players);
      const bScore = calculateTeamScore(b.players);

      const aCount = a.players.length;
      const bCount = b.players.length;

      const aPos = getPositionSummary(a.players);
      const bPos = getPositionSummary(b.players);

      const aNeeds =
        (aPos[player.pos1] === 0 ? 40 : 0) +
        (player.pos2 && aPos[player.pos2] === 0 ? 20 : 0);

      const bNeeds =
        (bPos[player.pos1] === 0 ? 40 : 0) +
        (player.pos2 && bPos[player.pos2] === 0 ? 20 : 0);

      const aElitePenalty = getDraftConflictPenalty(a.players, player);
      const bElitePenalty = getDraftConflictPenalty(b.players, player);

      const aValue = aScore + aCount * 25 - aNeeds + aElitePenalty;
      const bValue = bScore + bCount * 25 - bNeeds + bElitePenalty;

      return aValue - bValue;
    })[0];
  };

  const getBalancedTargets = (remainingPlayersCount, teamCountForDraft) => {
    if (!teamCountForDraft || teamCountForDraft <= 0) return [];

    const base = Math.floor(remainingPlayersCount / teamCountForDraft);
    const remainder = remainingPlayersCount % teamCountForDraft;

    return Array.from({ length: teamCountForDraft }, (_, index) =>
      index < remainder ? base + 1 : base,
    );
  };

  // ======================================================
  // 14. DRAFT ACTIONS
  // ======================================================

  const generateTeams = () => {
    // Draft Flow:
    // 1) Filter available players and validate minimums.
    // 2) Reset team names to neutral Team A/B/C... before drafting.
    // 3) Place valid lock groups first.
    // 4) Draft remaining players with rating, position, and elite-tier balance.
    // 5) Build final team summaries and sync player teamName values.
    const availablePlayers = players.filter((p) => p.available);

    if (availablePlayers.length < teamCount) {
      alert(`ต้องมีผู้เล่นอย่างน้อย ${teamCount} คน`);
      return;
    }

    const minPlayers = getMinPlayersPerGame();
    if (availablePlayers.length < teamCount * minPlayers) {
      const confirmGenerate = window.confirm(
        `จำนวนผู้เล่นอาจไม่พอขั้นต่ำ ${minPlayers} คนต่อทีมสำหรับ ${competitionType}\n` +
          `ผู้เล่น Available: ${availablePlayers.length} คน / ${teamCount} ทีม\n` +
          "ต้องการสุ่มทีมต่อหรือไม่?",
      );

      if (!confirmGenerate) return;
    }

    // เริ่ม Draft ด้วยชื่อกลางก่อนเสมอ แล้วค่อยแก้ชื่อทีมหลังดราฟ
    setTeamNames(defaultTeamNames);

    const newTeams = defaultTeamNames.map((name) => ({
      name,
      players: [],
      lockedGroupName: "",
    }));

    const availablePlayerMap = new Map(
      availablePlayers.map((player) => [
        String(player.id),
        { ...player, lockedTeam: "" },
      ]),
    );

    const usedPlayerIds = new Set();

    const validLockGroups = lockGroups
      .map((group) => ({
        ...group,
        players: (group.playerIds || [])
          .map((playerId) => availablePlayerMap.get(String(playerId)))
          .filter(Boolean),
      }))
      .filter((group) => group.players.length > 0);

    validLockGroups.forEach((group) => {
      const unlockedTeams = newTeams.filter((team) => !team.lockedGroupName);
      const candidateTeams =
        unlockedTeams.length > 0 ? unlockedTeams : newTeams;

      const targetTeam = [...candidateTeams].sort((a, b) => {
        if (a.players.length !== b.players.length) {
          return a.players.length - b.players.length;
        }
        return calculateTeamScore(a.players) - calculateTeamScore(b.players);
      })[0];

      group.players.forEach((player) => {
        if (usedPlayerIds.has(String(player.id))) return;
        targetTeam.players.push({
          ...player,
          lockedGroupName: group.name,
        });
        usedPlayerIds.add(String(player.id));
      });

      targetTeam.lockedGroupName = group.name;
    });

    const remainingPlayers = availablePlayers
      .filter((player) => !usedPlayerIds.has(String(player.id)))
      .map((player) => ({
        ...player,
        lockedTeam: "",
      }));

    const sortedPlayers = preparePlayersForDraft(remainingPlayers);

    const unlockedDraftTeams = newTeams.filter((team) => !team.lockedGroupName);
    const draftCandidateTeams =
      unlockedDraftTeams.length > 0 ? unlockedDraftTeams : newTeams;

    const balancedTargets = getBalancedTargets(
      sortedPlayers.length,
      draftCandidateTeams.length,
    );

    const baseTeamCounts = new Map(
      draftCandidateTeams.map((team) => [team.name, team.players.length]),
    );

    sortedPlayers.forEach((player) => {
      const availableTeams = draftCandidateTeams.filter((team, index) => {
        const baseCount = baseTeamCounts.get(team.name) || 0;
        const addedCount = team.players.length - baseCount;
        return addedCount < balancedTargets[index];
      });

      const candidateTeams =
        availableTeams.length > 0 ? availableTeams : draftCandidateTeams;

      const targetTeam = getBestDraftTeam(candidateTeams, player);

      if (!targetTeam) return;
      targetTeam.players.push(player);
    });

    const finalTeams = buildFinalTeams(newTeams);

    const teamMap = {};
    finalTeams.forEach((team) => {
      team.players.forEach((player) => {
        teamMap[player.id] = team.name;
      });
    });

    setTeams(finalTeams);
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) =>
        teamMap[player.id]
          ? {
              ...player,
              teamName: teamMap[player.id],
            }
          : player,
      ),
    );
  };

  // ======================================================
  // 15. TEAM ROSTER MANAGEMENT
  // ======================================================

  const addExistingPlayerToTeam = () => {
    if (teams.length === 0) {
      alert("กรุณา Generate Teams ก่อน");
      return;
    }

    if (!rosterExistingPlayerId || !rosterTargetTeam) {
      alert("กรุณาเลือกผู้เล่นและทีม");
      return;
    }

    const selectedPlayer = players.find(
      (player) => String(player.id) === String(rosterExistingPlayerId),
    );

    if (!selectedPlayer) {
      alert("ไม่พบผู้เล่น");
      return;
    }

    const updatedPlayer = {
      ...selectedPlayer,
      teamName: rosterTargetTeam,
    };

    setTeams((prevTeams) => {
      const nextTeams = prevTeams.map((team) => ({
        ...team,
        players: team.players.filter(
          (player) => player.id !== selectedPlayer.id,
        ),
      }));

      return buildFinalTeams(
        nextTeams.map((team) =>
          team.name === rosterTargetTeam
            ? {
                ...team,
                players: [...team.players, updatedPlayer],
              }
            : team,
        ),
      );
    });

    setPlayers((prevPlayers) =>
      prevPlayers.map((player) =>
        player.id === selectedPlayer.id
          ? {
              ...player,
              teamName: rosterTargetTeam,
            }
          : player,
      ),
    );

    setRosterExistingPlayerId("");
    setRosterTargetTeam("");
  };

  const movePlayerToTeam = (playerId, targetTeam) => {
    if (!targetTeam) return;

    let movedPlayer = null;

    setTeams((prevTeams) => {
      const nextTeams = prevTeams.map((team) => {
        const foundPlayer = team.players.find(
          (player) => player.id === playerId,
        );
        if (foundPlayer) {
          movedPlayer = {
            ...foundPlayer,
            teamName: targetTeam,
          };
        }

        return {
          ...team,
          players: team.players.filter((player) => player.id !== playerId),
        };
      });

      if (!movedPlayer) {
        const playerFromList = players.find((player) => player.id === playerId);
        if (playerFromList) {
          movedPlayer = {
            ...playerFromList,
            teamName: targetTeam,
          };
        }
      }

      if (!movedPlayer) return prevTeams;

      return buildFinalTeams(
        nextTeams.map((team) =>
          team.name === targetTeam
            ? {
                ...team,
                players: [...team.players, movedPlayer],
              }
            : team,
        ),
      );
    });

    setPlayers((prevPlayers) =>
      prevPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              teamName: targetTeam,
            }
          : player,
      ),
    );
  };

  const removePlayerFromTeam = (playerId) => {
    if (!window.confirm("ต้องการนำผู้เล่นออกจากทีมใช่ไหม?")) return;

    setTeams((prevTeams) =>
      buildFinalTeams(
        prevTeams.map((team) => ({
          ...team,
          players: team.players.filter((player) => player.id !== playerId),
        })),
      ),
    );

    setPlayers((prevPlayers) =>
      prevPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              teamName: "",
            }
          : player,
      ),
    );
  };

  const createNewPlayerToTeam = () => {
    if (teams.length === 0) {
      alert("กรุณา Generate Teams ก่อน");
      return;
    }

    if (!newRosterForm.name.trim() || !newRosterForm.targetTeam) {
      alert("กรุณากรอกชื่อผู้เล่นและเลือกทีม");
      return;
    }

    const rating = calculateRatingFromSkills(newRosterForm);

    const newPlayer = {
      id: Date.now(),
      bamPlayerId: getNextBamPlayerId(),
      identityVersion: CORE_DATABASE_VERSION,
      name: newRosterForm.name.trim(),
      tier: getFinalTier(newRosterForm.tier, rating),
      rating,
      pos1: newRosterForm.pos1,
      pos2: newRosterForm.pos2,
      dribbling: clampSkill(newRosterForm.dribbling),
      insideScoring: clampSkill(newRosterForm.insideScoring),
      shooting: clampSkill(newRosterForm.shooting),
      defense: clampSkill(newRosterForm.defense),
      passing: clampSkill(newRosterForm.passing),
      available: true,
      lockedTeam: "",
      photoUrl: newRosterForm.photoUrl || "",
      teamName: newRosterForm.targetTeam,
    };

    setPlayers((prevPlayers) => [...prevPlayers, newPlayer]);

    setTeams((prevTeams) =>
      buildFinalTeams(
        prevTeams.map((team) =>
          team.name === newRosterForm.targetTeam
            ? {
                ...team,
                players: [...team.players, newPlayer],
              }
            : team,
        ),
      ),
    );

    setNewRosterForm({
      name: "",
      tier: "",
      pos1: "PG",
      pos2: "",
      dribbling: 3,
      insideScoring: 3,
      shooting: 3,
      defense: 3,
      passing: 3,
      targetTeam: "",
      photoUrl: "",
    });
  };

  // ======================================================
  // 16. DRAFT SAVE / LOAD / EXPORT
  // ======================================================

  const getBalancePercent = () => {
    if (teams.length === 0) return 0;
    const scores = teams.map((t) => t.totalScore);
    return ((Math.min(...scores) / Math.max(...scores)) * 100).toFixed(1);
  };

  const saveDraft = () => {
    if (teams.length === 0) {
      alert("กรุณา Generate Teams ก่อน");
      return;
    }

    const newDraft = {
      id: Date.now(),
      name: `Draft ${drafts.length + 1}`,
      createdAt: new Date().toLocaleString(),
      balanceScore: getBalancePercent(),
      teams: JSON.parse(JSON.stringify(teams)),
    };

    setDrafts([newDraft, ...drafts]);
    alert("บันทึก Draft สำเร็จ");
  };

  const loadDraft = (draft) => {
    const loadedTeams = draft.teams || [];
    const teamMap = {};

    loadedTeams.forEach((team) => {
      (team.players || []).forEach((player) => {
        teamMap[player.id] = team.name;
      });
    });

    setTeams(loadedTeams);
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) =>
        teamMap[player.id]
          ? {
              ...player,
              teamName: teamMap[player.id],
            }
          : player,
      ),
    );
  };

  const deleteDraft = (id) => {
    if (!window.confirm("ต้องการลบ Draft นี้ใช่ไหม?")) return;
    setDrafts(drafts.filter((draft) => draft.id !== id));
  };

  const renameDraft = (id) => {
    const newName = window.prompt("ตั้งชื่อ Draft ใหม่");
    if (!newName) return;

    setDrafts(
      drafts.map((draft) =>
        draft.id === id ? { ...draft, name: newName } : draft,
      ),
    );
  };

  const clearAllDrafts = () => {
    if (!window.confirm("ต้องการลบ Draft ทั้งหมดใช่ไหม?")) return;
    setDrafts([]);
    localStorage.removeItem("drafts");
  };

  const exportTeamsCSV = () => {
    if (teams.length === 0) {
      alert("ยังไม่มีทีม กรุณากด Generate ก่อน");
      return;
    }

    const rows = [
      [
        "Team",
        "Name",
        "Tier",
        "Rating",
        "Pos1",
        "Pos2",
        "Dribbling",
        "InsideScoring",
        "Shooting",
        "Defense",
        "Passing",
      ],
    ];

    teams.forEach((team) => {
      team.players.forEach((p) => {
        rows.push([
          team.name,
          p.name,
          p.tier,
          p.rating,
          p.pos1,
          p.pos2 || "",
          p.dribbling,
          p.insideScoring,
          p.shooting,
          p.defense,
          p.passing,
        ]);
      });
    });

    downloadCSV("bam_generated_teams.csv", rows);
  };

  // ======================================================
  // 17. SCHEDULE / MATCH RESULTS
  // NOTE: Later migrate this region to src/services/schedule/scheduleService.js.
  // ======================================================

  const resetScheduleDependentData = () => {
    setSchedule([]);
    setMatchRosters({});
    setPlayerStats({});
    setMatchStatInputs({});
    setSelectedRosterMatchId("");
    setSelectedStatsMatchId("");
    setSelectedFinalsMvpId("");
    localStorage.removeItem("schedule");
    localStorage.removeItem("matchRosters");
    localStorage.removeItem("playerStats");
    localStorage.removeItem("matchStatInputs");
  };

  const shuffleScheduleTeamNames = (teamNames) => {
    const shuffledNames = [...teamNames];

    for (let index = shuffledNames.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledNames[index], shuffledNames[randomIndex]] = [
        shuffledNames[randomIndex],
        shuffledNames[index],
      ];
    }

    return shuffledNames;
  };

  const createSchedule = () => {
    // Schedule Flow:
    // 1) Validate enough generated teams.
    // 2) Build a round-robin league schedule.
    // 3) Append playoff placeholders based on team count.
    // 4) Reset selected roster/stat match to avoid stale selections.
    if (teams.length < 3) {
      alert("กรุณา Generate Teams อย่างน้อย 3 ทีมก่อน");
      return;
    }

    resetScheduleDependentData();

    const names = shuffleScheduleTeamNames(teams.map((team) => team.name));
    const roundRobinNames =
      names.length % 2 === 0 ? [...names] : [...names, "BYE"];
    const totalRounds = roundRobinNames.length - 1;
    const matchesPerRound = roundRobinNames.length / 2;
    const rotated = [...roundRobinNames];
    const newSchedule = [];
    let matchId = 1;

    for (let round = 1; round <= totalRounds; round += 1) {
      for (let matchIndex = 0; matchIndex < matchesPerRound; matchIndex += 1) {
        const teamA = rotated[matchIndex];
        const teamB = rotated[rotated.length - 1 - matchIndex];

        if (teamA !== "BYE" && teamB !== "BYE") {
          newSchedule.push({
            id: matchId,
            week: round,
            label: "League",
            teamA,
            teamB,
            scoreA: "",
            scoreB: "",
            status: "Pending",
          });
          matchId += 1;
        }
      }

      const fixedTeam = rotated[0];
      const restTeams = rotated.slice(1);
      restTeams.unshift(restTeams.pop());
      rotated.splice(0, rotated.length, fixedTeam, ...restTeams);
    }

    const playoffStartWeek = totalRounds + 1;

    if (names.length === 3) {
      newSchedule.push({
        id: matchId,
        week: playoffStartWeek,
        label: "Final",
        playoffType: "final_1v2",
        teamA: "Rank 1",
        teamB: "Rank 2",
        scoreA: "",
        scoreB: "",
        status: "Pending",
      });
    }

    if (names.length >= 4) {
      newSchedule.push(
        {
          id: matchId,
          week: playoffStartWeek,
          label: "Semi Final",
          playoffType: "sf1",
          teamA: "Rank 1",
          teamB: "Rank 4",
          scoreA: "",
          scoreB: "",
          status: "Pending",
        },
        {
          id: matchId + 1,
          week: playoffStartWeek,
          label: "Semi Final",
          playoffType: "sf2",
          teamA: "Rank 2",
          teamB: "Rank 3",
          scoreA: "",
          scoreB: "",
          status: "Pending",
        },
        {
          id: matchId + 2,
          week: playoffStartWeek + 1,
          label: "3rd Place",
          playoffType: "third_place",
          teamA: "Loser SF1",
          teamB: "Loser SF2",
          scoreA: "",
          scoreB: "",
          status: "Pending",
        },
        {
          id: matchId + 3,
          week: playoffStartWeek + 1,
          label: "Final",
          playoffType: "final",
          teamA: "Winner SF1",
          teamB: "Winner SF2",
          scoreA: "",
          scoreB: "",
          status: "Pending",
        },
      );
    }

    setSchedule(newSchedule);
  };

  const updateMatchScore = (id, field, value) => {
    setSchedule(
      schedule.map((match) =>
        match.id === id
          ? {
              ...match,
              [field]: value,
              status:
                field === "scoreA" || field === "scoreB"
                  ? "Pending"
                  : match.status,
            }
          : match,
      ),
    );
  };

  const finishMatch = (id) => {
    setSchedule(
      schedule.map((match) => {
        if (match.id !== id) return match;

        if (match.scoreA === "" || match.scoreB === "") {
          alert("กรุณากรอกคะแนนให้ครบ");
          return match;
        }

        return {
          ...match,
          status: "Finished",
        };
      }),
    );
  };

  const calculateStandings = () => {
    if (teams.length === 0) return [];

    const table = {};

    teams.forEach((team) => {
      table[team.name] = {
        team: team.name,
        played: 0,
        win: 0,
        loss: 0,
        pf: 0,
        pa: 0,
        diff: 0,
      };
    });

    schedule
      .filter((m) => m.label === "League" && m.status === "Finished")
      .forEach((match) => {
        const scoreA = Number(match.scoreA);
        const scoreB = Number(match.scoreB);

        if (!table[match.teamA] || !table[match.teamB]) return;

        table[match.teamA].played += 1;
        table[match.teamB].played += 1;

        table[match.teamA].pf += scoreA;
        table[match.teamA].pa += scoreB;

        table[match.teamB].pf += scoreB;
        table[match.teamB].pa += scoreA;

        if (scoreA > scoreB) {
          table[match.teamA].win += 1;
          table[match.teamB].loss += 1;
        } else if (scoreB > scoreA) {
          table[match.teamB].win += 1;

          table[match.teamA].loss += 1;
        }
      });

    return Object.values(table)
      .map((row) => ({
        ...row,
        diff: row.pf - row.pa,
      }))
      .sort((a, b) => {
        if (b.win !== a.win) return b.win - a.win;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.pf - a.pf;
      });
  };

  // ======================================================
  // 18. MATCH ROSTER HELPERS
  // ======================================================

  const getTeamPlayers = (teamName) => {
    const team = teams.find((item) => item.name === teamName);
    if (team) return team.players || [];

    return players.filter((player) => player.teamName === teamName);
  };

  const getMatchRosterTemplate = (match) => {
    const teamAPlayers = getTeamPlayers(match.teamA).map((player) => player.id);
    const teamBPlayers = getTeamPlayers(match.teamB).map((player) => player.id);

    return {
      teamA: {
        activePlayers: teamAPlayers,
        loanPlayers: [],
      },
      teamB: {
        activePlayers: teamBPlayers,
        loanPlayers: [],
      },
    };
  };

  const getMatchRoster = (match) => {
    if (!match) {
      return {
        teamA: { activePlayers: [], loanPlayers: [] },
        teamB: { activePlayers: [], loanPlayers: [] },
      };
    }

    return matchRosters[match.id] || getMatchRosterTemplate(match);
  };

  const getSideTeamName = (match, side) => {
    return side === "teamA" ? match.teamA : match.teamB;
  };

  const toggleActivePlayer = (match, side, playerId) => {
    const currentRoster = getMatchRoster(match);
    const currentActive = currentRoster[side].activePlayers || [];
    const alreadyActive = currentActive.includes(playerId);

    const nextActive = alreadyActive
      ? currentActive.filter((id) => id !== playerId)
      : [...currentActive, playerId];

    setMatchRosters((prev) => ({
      ...prev,
      [match.id]: {
        ...currentRoster,
        [side]: {
          ...currentRoster[side],
          activePlayers: nextActive,
        },
      },
    }));
  };

  const addLoanPlayerToMatch = (match, side) => {
    if (!loanForm.playerId) {
      alert("กรุณาเลือกผู้เล่นยืมตัว");
      return;
    }

    const player = players.find(
      (item) => String(item.id) === String(loanForm.playerId),
    );

    if (!player) {
      alert("ไม่พบผู้เล่น");
      return;
    }

    const matchTeam = getSideTeamName(match, side);
    const ownerTeam = player.teamName || "No Team";

    if (ownerTeam === matchTeam) {
      alert("ผู้เล่นคนนี้อยู่ทีมนี้อยู่แล้ว ไม่ต้องยืมตัว");
      return;
    }

    const currentRoster = getMatchRoster(match);
    const currentLoans = currentRoster[side].loanPlayers || [];
    const alreadyLoaned = currentLoans.some(
      (loan) => Number(loan.playerId) === Number(player.id),
    );

    if (alreadyLoaned) {
      alert("ผู้เล่นคนนี้ถูกยืมเข้าทีมนี้แล้ว");
      return;
    }

    const activeInSameTeam = (currentRoster[side].activePlayers || []).includes(
      player.id,
    );

    if (activeInSameTeam) {
      alert("ผู้เล่นคนนี้อยู่ใน Active Roster แล้ว");
      return;
    }

    const newLoan = {
      playerId: player.id,
      playerName: player.name,
      ownerTeam,
      matchTeam,
      role: "loan",
      countPersonalStats: false,
    };

    setMatchRosters((prev) => ({
      ...prev,
      [match.id]: {
        ...currentRoster,
        [side]: {
          ...currentRoster[side],
          loanPlayers: [...currentLoans, newLoan],
        },
      },
    }));

    setLoanForm({ side, playerId: "" });
  };

  const removeLoanPlayerFromMatch = (match, side, playerId) => {
    const currentRoster = getMatchRoster(match);
    const currentLoans = currentRoster[side].loanPlayers || [];

    setMatchRosters((prev) => ({
      ...prev,
      [match.id]: {
        ...currentRoster,
        [side]: {
          ...currentRoster[side],
          loanPlayers: currentLoans.filter(
            (loan) => Number(loan.playerId) !== Number(playerId),
          ),
        },
      },
    }));
  };

  const saveMatchRoster = (match) => {
    const currentRoster = getMatchRoster(match);

    const teamACount =
      (currentRoster.teamA.activePlayers || []).length +
      (currentRoster.teamA.loanPlayers || []).length;

    const teamBCount =
      (currentRoster.teamB.activePlayers || []).length +
      (currentRoster.teamB.loanPlayers || []).length;

    const minPlayers = getMinPlayersPerGame();

    if (teamACount < minPlayers || teamBCount < minPlayers) {
      const confirmSave = window.confirm(
        `ผู้เล่นยังไม่ครบ ${minPlayers} คน\n${match.teamA}: ${teamACount} คน\n${match.teamB}: ${teamBCount} คน\nต้องการบันทึกต่อหรือไม่?`,
      );

      if (!confirmSave) return;
    }

    setMatchRosters((prev) => ({
      ...prev,
      [match.id]: currentRoster,
    }));

    alert("บันทึก Match Roster สำเร็จ");
  };

  const clearMatchRoster = (matchId) => {
    if (!window.confirm("ต้องการลบ Match Roster ของแมตช์นี้ใช่ไหม?")) return;

    setMatchRosters((prev) => {
      const updated = { ...prev };
      delete updated[matchId];
      return updated;
    });
  };

  const getLoanCandidates = (match, side) => {
    const currentRoster = getMatchRoster(match);
    const matchTeamNames = [match.teamA, match.teamB];
    const currentLoanIds = [
      ...(currentRoster.teamA.loanPlayers || []),
      ...(currentRoster.teamB.loanPlayers || []),
    ].map((loan) => Number(loan.playerId));
    const activeIds = [
      ...(currentRoster.teamA.activePlayers || []),
      ...(currentRoster.teamB.activePlayers || []),
    ].map((playerId) => Number(playerId));

    return players.filter((player) => {
      if (player.available === false) return false;
      if (matchTeamNames.includes(player.teamName)) return false;
      if (currentLoanIds.includes(Number(player.id))) return false;
      if (activeIds.includes(Number(player.id))) return false;
      return true;
    });
  };

  const getRegularActivePlayersForMatch = (match, side) => {
    const roster = getMatchRoster(match);
    const activeIds = roster[side]?.activePlayers || [];
    return activeIds
      .map((playerId) =>
        players.find((player) => Number(player.id) === Number(playerId)),
      )
      .filter(Boolean)
      .map((player) => ({
        ...player,
        role: "regular",
        countPersonalStats: true,
        matchTeam: getSideTeamName(match, side),
        ownerTeam: getSideTeamName(match, side),
      }));
  };

  const getLoanPlayersForMatch = (match, side) => {
    const roster = getMatchRoster(match);
    return (roster[side]?.loanPlayers || []).map((loan) => ({
      id: loan.playerId,
      name: loan.playerName,
      playerId: loan.playerId,
      role: "loan",
      countPersonalStats: false,
      matchTeam: loan.matchTeam,
      ownerTeam: loan.ownerTeam,
    }));
  };

  const getAllStatRowsForMatch = (match) => {
    if (!match) return [];
    return [
      ...getRegularActivePlayersForMatch(match, "teamA"),
      ...getLoanPlayersForMatch(match, "teamA"),
      ...getRegularActivePlayersForMatch(match, "teamB"),
      ...getLoanPlayersForMatch(match, "teamB"),
    ];
  };

  const getMatchStatKey = (matchId, playerId, role, matchTeam) => {
    return `${matchId}_${playerId}_${role}_${matchTeam}`;
  };

  const statFields = [
    { key: "pts", label: "PTS" },
    { key: "reb", label: "REB" },
    { key: "ast", label: "AST" },
    { key: "stl", label: "STL" },
    { key: "blk", label: "BLK" },
  ];

  const getStatInputValue = (match, player, field = "pts") => {
    const key = getMatchStatKey(
      match.id,
      player.playerId || player.id,
      player.role,
      player.matchTeam,
    );
    return matchStatInputs[key]?.[field] ?? "";
  };

  const updateMatchStatInput = (match, player, field, value) => {
    const key = getMatchStatKey(
      match.id,
      player.playerId || player.id,
      player.role,
      player.matchTeam,
    );

    setMatchStatInputs((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        matchId: match.id,
        playerId: player.playerId || player.id,
        playerName: player.name,
        ownerTeam: player.ownerTeam,
        matchTeam: player.matchTeam,
        role: player.role,
        countPersonalStats: player.countPersonalStats,
        [field]: value,
      },
    }));
  };

  const calculateTeamScoresFromMatchInputs = (match) => {
    const rows = getAllStatRowsForMatch(match);
    const totals = {
      teamA: 0,
      teamB: 0,
    };

    rows.forEach((player) => {
      const key = getMatchStatKey(
        match.id,
        player.playerId || player.id,
        player.role,
        player.matchTeam,
      );
      const input = matchStatInputs[key] || {};
      const points = Number(input.pts || 0);
      const safePoints = Number.isNaN(points) ? 0 : points;

      if (player.matchTeam === match.teamA) {
        totals.teamA += safePoints;
      }

      if (player.matchTeam === match.teamB) {
        totals.teamB += safePoints;
      }
    });

    return totals;
  };

  const getMatchScoreSyncInfo = (match) => {
    const rows = getAllStatRowsForMatch(match);
    let hasPtsInput = false;
    const expectedScores = {
      teamA: 0,
      teamB: 0,
    };

    rows.forEach((player) => {
      const key = getMatchStatKey(
        match.id,
        player.playerId || player.id,
        player.role,
        player.matchTeam,
      );
      const input = matchStatInputs[key] || {};
      const hasPlayerPtsInput = input.pts !== undefined && input.pts !== "";

      if (!hasPlayerPtsInput) return;

      hasPtsInput = true;
      const points = Number(input.pts || 0);
      const safePoints = Number.isNaN(points) ? 0 : points;

      if (player.matchTeam === match.teamA) {
        expectedScores.teamA += safePoints;
      }

      if (player.matchTeam === match.teamB) {
        expectedScores.teamB += safePoints;
      }
    });

    if (!hasPtsInput) {
      return {
        hasPtsInput: false,
        expectedScoreA: expectedScores.teamA,
        expectedScoreB: expectedScores.teamB,
        currentScoreA: match.scoreA,
        currentScoreB: match.scoreB,
        hasMismatch: false,
      };
    }

    const expectedScoreA = String(expectedScores.teamA);
    const expectedScoreB = String(expectedScores.teamB);
    const currentScoreA = String(match.scoreA ?? "");
    const currentScoreB = String(match.scoreB ?? "");

    return {
      hasPtsInput: true,
      expectedScoreA,
      expectedScoreB,
      currentScoreA,
      currentScoreB,
      hasMismatch:
        currentScoreA !== expectedScoreA || currentScoreB !== expectedScoreB,
    };
  };

  // ======================================================
  // 19. PLAYER STATS ENGINE
  // NOTE: Later migrate this region to src/services/stats/playerStatsService.js.
  // ======================================================

  const saveMatchStats = (match) => {
    // Stats Flow:
    // 1) Build all eligible stat rows from match roster.
    // 2) Count a game for every rostered team player.
    // 3) Count appearances and box score only for regular players.
    // 4) Loan players help the team but do not count personal stats.
    const rows = getAllStatRowsForMatch(match);

    if (rows.length === 0) {
      alert("ยังไม่มี Match Roster กรุณา Manage Roster ก่อน");
      return;
    }

    const nextStats = { ...playerStats };

    const teamAPlayers = getTeamPlayers(match.teamA);
    const teamBPlayers = getTeamPlayers(match.teamB);
    const allTeamPlayers = [
      ...teamAPlayers.map((p) => ({
        ...p,
        matchTeam: match.teamA,
        opponent: match.teamB,
      })),
      ...teamBPlayers.map((p) => ({
        ...p,
        matchTeam: match.teamB,
        opponent: match.teamA,
      })),
    ];

    allTeamPlayers.forEach((player) => {
      const playerId = player.id;

      if (!nextStats[playerId]) {
        nextStats[playerId] = {
          playerId,
          playerName: player.name,
          teamName: player.teamName || player.matchTeam || "",
          gamesByMatch: {},
          games: 0,
          appearances: 0,
          pts: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
        };
      }

      const previous = nextStats[playerId].gamesByMatch?.[match.id] || {};
      const wasGameCounted = Boolean(previous.gameCounted);

      nextStats[playerId] = {
        ...nextStats[playerId],
        playerName: player.name,
        teamName:
          player.teamName ||
          player.matchTeam ||
          nextStats[playerId].teamName ||
          "",
        gamesByMatch: {
          ...(nextStats[playerId].gamesByMatch || {}),
          [match.id]: {
            ...previous,
            matchId: match.id,
            week: match.week,
            opponent: player.opponent,
            matchTeam: player.matchTeam,
            gameCounted: true,
          },
        },
        games:
          Number(nextStats[playerId].games || 0) + (!wasGameCounted ? 1 : 0),
        appearances: Number(nextStats[playerId].appearances || 0),
        pts: Number(nextStats[playerId].pts || 0),
        reb: Number(nextStats[playerId].reb || 0),
        ast: Number(nextStats[playerId].ast || 0),
        stl: Number(nextStats[playerId].stl || 0),
        blk: Number(nextStats[playerId].blk || 0),
      };
    });

    rows.forEach((player) => {
      const playerId = player.playerId || player.id;
      const key = getMatchStatKey(
        match.id,
        playerId,
        player.role,
        player.matchTeam,
      );
      const input = matchStatInputs[key] || {};
      const pts = Number(input.pts || 0);
      const reb = Number(input.reb || 0);
      const ast = Number(input.ast || 0);
      const stl = Number(input.stl || 0);
      const blk = Number(input.blk || 0);

      if (!player.countPersonalStats) return;

      if (!nextStats[playerId]) {
        nextStats[playerId] = {
          playerId,
          playerName: player.name,
          teamName: player.ownerTeam || player.teamName || "",
          gamesByMatch: {},
          games: 0,
          appearances: 0,
          pts: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
        };
      }

      const previous = nextStats[playerId].gamesByMatch?.[match.id] || {};
      const previousPts = Number(previous.pts || 0);
      const previousReb = Number(previous.reb || 0);
      const previousAst = Number(previous.ast || 0);
      const previousStl = Number(previous.stl || 0);
      const previousBlk = Number(previous.blk || 0);
      const wasAppearance = Boolean(previous.appearanceCounted);

      nextStats[playerId] = {
        ...nextStats[playerId],
        playerName: player.name,
        teamName:
          player.ownerTeam ||
          player.teamName ||
          nextStats[playerId].teamName ||
          "",
        gamesByMatch: {
          ...(nextStats[playerId].gamesByMatch || {}),
          [match.id]: {
            ...previous,
            matchId: match.id,
            week: match.week,
            opponent:
              player.matchTeam === match.teamA ? match.teamB : match.teamA,
            matchTeam: player.matchTeam,
            pts,
            reb,
            ast,
            stl,
            blk,
            counted: true,
            appearanceCounted: true,
          },
        },
        pts: Number(nextStats[playerId].pts || 0) - previousPts + pts,
        reb: Number(nextStats[playerId].reb || 0) - previousReb + reb,
        ast: Number(nextStats[playerId].ast || 0) - previousAst + ast,
        stl: Number(nextStats[playerId].stl || 0) - previousStl + stl,
        blk: Number(nextStats[playerId].blk || 0) - previousBlk + blk,
        appearances:
          Number(nextStats[playerId].appearances || 0) +
          (!wasAppearance ? 1 : 0),
      };
    });

    setPlayerStats(nextStats);
    const teamScores = calculateTeamScoresFromMatchInputs(match);
    setSchedule((prevSchedule) =>
      prevSchedule.map((scheduleMatch) =>
        String(scheduleMatch.id) === String(match.id)
          ? {
              ...scheduleMatch,
              scoreA: String(teamScores.teamA),
              scoreB: String(teamScores.teamB),
              status: "Pending",
            }
          : scheduleMatch,
      ),
    );
    alert("บันทึก Player Stats สำเร็จ");
  };

  const getPlayerStatRows = () => {
    return Object.values(playerStats)
      .filter((stat) => Number(stat.games || 0) > 0)
      .map((stat) => {
        const appearances = Number(stat.appearances || 0);
        const pts = Number(stat.pts || 0);
        const reb = Number(stat.reb || 0);
        const ast = Number(stat.ast || 0);
        const stl = Number(stat.stl || 0);
        const blk = Number(stat.blk || 0);
        const ppg = appearances > 0 ? (pts / appearances).toFixed(1) : "0.0";
        const avgStats =
          appearances > 0 ? (pts + reb + ast + stl + blk) / appearances : 0;
        const appearanceBonus = appearances * 0.75;
        const mvpScore =
          pts + reb * 1.2 + ast * 1.5 + stl * 2 + blk * 2 + appearanceBonus;

        return {
          ...stat,
          appearances,
          pts,
          reb,
          ast,
          stl,
          blk,
          ppg,
          avgStats: avgStats.toFixed(1),
          appearanceBonus,
          mvpScore,
        };
      });
  };

  const getStatLeaders = (field) => {
    return getPlayerStatRows()
      .filter((stat) => Number(stat[field] || 0) > 0)
      .sort((a, b) => {
        if (Number(b[field] || 0) !== Number(a[field] || 0)) {
          return Number(b[field] || 0) - Number(a[field] || 0);
        }
        return Number(b.ppg || 0) - Number(a.ppg || 0);
      });
  };

  const getTopScorers = () => getStatLeaders("pts");

  const getMVPRanking = () => {
    return getPlayerStatRows()
      .filter((stat) => Number(stat.mvpScore || 0) > 0)
      .sort((a, b) => {
        if (Number(b.mvpScore || 0) !== Number(a.mvpScore || 0)) {
          return Number(b.mvpScore || 0) - Number(a.mvpScore || 0);
        }
        if (Number(b.pts || 0) !== Number(a.pts || 0)) {
          return Number(b.pts || 0) - Number(a.pts || 0);
        }
        return Number(b.appearances || 0) - Number(a.appearances || 0);
      });
  };

  const getRegularSeasonMvp = () => getMVPRanking()[0] || null;

  const getFinalsMvpOptions = () => {
    const statRows = getPlayerStatRows();
    const statsByPlayerId = new Map(
      statRows.map((stat) => [String(stat.playerId), stat]),
    );

    const playerOptions = players.map((player) => {
      const stat = statsByPlayerId.get(String(player.id));
      return {
        playerId: player.id,
        bamPlayerId: player.bamPlayerId || "",
        playerName: player.name,
        teamName: player.teamName || stat?.teamName || "",
        mvpScore: Number(stat?.mvpScore || 0),
        pts: Number(stat?.pts || 0),
      };
    });

    const missingStatOptions = statRows
      .filter(
        (stat) =>
          !playerOptions.some(
            (player) => String(player.playerId) === String(stat.playerId),
          ),
      )
      .map((stat) => {
        const identityPlayer = players.find(
          (player) => String(player.id) === String(stat.playerId),
        );
        return {
          playerId: stat.playerId,
          bamPlayerId: identityPlayer?.bamPlayerId || "",
          playerName: stat.playerName,
          teamName: stat.teamName || "",
          mvpScore: Number(stat.mvpScore || 0),
          pts: Number(stat.pts || 0),
        };
      });

    return [...playerOptions, ...missingStatOptions]
      .filter((player) => player.playerName)
      .sort((a, b) => {
        const teamCompare = String(a.teamName || "").localeCompare(
          String(b.teamName || ""),
        );
        if (teamCompare !== 0) return teamCompare;
        return String(a.playerName || "").localeCompare(
          String(b.playerName || ""),
        );
      });
  };

  const getSelectedFinalsMvp = () => {
    if (!selectedFinalsMvpId) return null;
    return (
      getFinalsMvpOptions().find(
        (player) => String(player.playerId) === String(selectedFinalsMvpId),
      ) || null
    );
  };

  const closePlayerProfile = () => {
    setSelectedProfilePlayerId("");
    setPublicProfileSeasonContext(null);
    setProfileCardView("current");
  };

  const getSelectedSeasonPlayerProfile = () => {
    if (!publicProfileSeasonContext?.archivedPlayerId) return null;

    const selectedSeason = seasonHistory.find(
      (season) =>
        String(season.id) === String(publicProfileSeasonContext.seasonId),
    );
    const archivedData = selectedSeason?.archivedData || {};
    const archivedPlayers = Array.isArray(archivedData.players)
      ? archivedData.players
      : [];
    const archivedPlayerStats =
      archivedData.playerStats && typeof archivedData.playerStats === "object"
        ? archivedData.playerStats
        : {};
    const archivedPlayerId = String(publicProfileSeasonContext.archivedPlayerId);

    const archivedPlayer = archivedPlayers.find(
      (player) => String(player.id) === archivedPlayerId,
    );
    const archivedStat =
      archivedPlayerStats[archivedPlayerId] ||
      Object.values(archivedPlayerStats).find(
        (stat) => String(stat?.playerId) === archivedPlayerId,
      ) ||
      {};

    if (!archivedPlayer && !archivedStat.playerId) return null;

    const appearances = Number(archivedStat.appearances || 0);
    const pts = Number(archivedStat.pts || 0);
    const reb = Number(archivedStat.reb || 0);
    const ast = Number(archivedStat.ast || 0);
    const stl = Number(archivedStat.stl || 0);
    const blk = Number(archivedStat.blk || 0);
    const ppg = appearances > 0 ? (pts / appearances).toFixed(1) : "0.0";
    const mvpScore =
      pts + reb * 1.2 + ast * 1.5 + stl * 2 + blk * 2 + appearances * 0.75;

    const currentPlayer = players.find(
      (player) =>
        String(player.id) === String(publicProfileSeasonContext.currentPlayerId),
    );
    const basePlayer = archivedPlayer || currentPlayer || {};

    return {
      ...currentPlayer,
      ...basePlayer,
      ...archivedStat,
      playerId: archivedPlayerId,
      id: archivedPlayerId,
      currentPlayerId: publicProfileSeasonContext.currentPlayerId,
      playerName:
        basePlayer.name ||
        archivedStat.playerName ||
        currentPlayer?.name ||
        "-",
      name:
        basePlayer.name ||
        archivedStat.playerName ||
        currentPlayer?.name ||
        "-",
      teamName: archivedStat.teamName || basePlayer.teamName || "",
      bamPlayerId: basePlayer.bamPlayerId || currentPlayer?.bamPlayerId || "",
      photoUrl: basePlayer.photoUrl || currentPlayer?.photoUrl || "",
      tier: basePlayer.tier || currentPlayer?.tier || "",
      rating:
        basePlayer.rating ||
        currentPlayer?.rating ||
        calculateRatingFromSkills(basePlayer),
      pos1: basePlayer.pos1 || currentPlayer?.pos1 || "-",
      pos2: basePlayer.pos2 || currentPlayer?.pos2 || "",
      dribbling: basePlayer.dribbling || currentPlayer?.dribbling || 3,
      insideScoring:
        basePlayer.insideScoring || currentPlayer?.insideScoring || 3,
      shooting: basePlayer.shooting || currentPlayer?.shooting || 3,
      defense: basePlayer.defense || currentPlayer?.defense || 3,
      passing: basePlayer.passing || currentPlayer?.passing || 3,
      gamesByMatch: archivedStat.gamesByMatch || {},
      games: Number(archivedStat.games || 0),
      appearances,
      pts,
      reb,
      ast,
      stl,
      blk,
      ppg,
      mvpScore,
      profileSeasonTitle: publicProfileSeasonContext.seasonTitle,
      isSelectedSeasonProfile: true,
    };
  };

  const getSelectedPlayerProfile = () => {
    if (!selectedProfilePlayerId) return null;

    if (publicProfileSeasonContext?.mode === "history") {
      return getSelectedSeasonPlayerProfile();
    }

    const player = players.find(
      (item) => String(item.id) === String(selectedProfilePlayerId),
    );

    const stat =
      getPlayerStatRows().find(
        (row) => String(row.playerId) === String(selectedProfilePlayerId),
      ) || {};

    if (!player && !stat.playerId) return null;

    const basePlayer = player || {};

    return {
      ...basePlayer,
      ...stat,
      playerId: basePlayer.id || stat.playerId,
      id: basePlayer.id || stat.playerId,
      playerName: basePlayer.name || stat.playerName || basePlayer.name || "-",
      name: basePlayer.name || stat.playerName || "-",
      teamName: basePlayer.teamName || stat.teamName || "",
      bamPlayerId: basePlayer.bamPlayerId || stat.bamPlayerId || "",
      photoUrl: basePlayer.photoUrl || stat.photoUrl || "",
      tier: basePlayer.tier || stat.tier || "",
      rating:
        basePlayer.rating ||
        stat.rating ||
        calculateRatingFromSkills(basePlayer),
      pos1: basePlayer.pos1 || stat.pos1 || "-",
      pos2: basePlayer.pos2 || stat.pos2 || "",
      dribbling: basePlayer.dribbling || 3,
      insideScoring: basePlayer.insideScoring || 3,
      shooting: basePlayer.shooting || 3,
      defense: basePlayer.defense || 3,
      passing: basePlayer.passing || 3,
      gamesByMatch: stat.gamesByMatch || {},
      games: stat.games || 0,
      appearances: stat.appearances || 0,
      pts: stat.pts || 0,
      reb: stat.reb || 0,
      ast: stat.ast || 0,
      stl: stat.stl || 0,
      blk: stat.blk || 0,
      ppg: stat.ppg || "0.0",
      mvpScore: stat.mvpScore || 0,
    };
  };

  const getPlayerMatchLog = (stat, sourceSchedule = schedule) => {
    if (!stat || !stat.gamesByMatch) return [];

    return Object.values(stat.gamesByMatch)
      .map((game) => {
        const match = sourceSchedule.find(
          (item) => String(item.id) === String(game.matchId),
        );

        const isAppearance = Boolean(game.appearanceCounted);
        const opponent =
          game.opponent ||
          (match
            ? game.matchTeam === match.teamA
              ? match.teamB
              : match.teamA
            : "-");

        return {
          ...game,
          week: game.week || match?.week || "-",
          label: match?.label || "League",
          opponent,
          status: match?.status || "Pending",
          score:
            match && match.scoreA !== "" && match.scoreB !== ""
              ? `${match.scoreA}-${match.scoreB}`
              : "-",
          appearance: isAppearance,
          pts: Number(game.pts || 0),
          reb: Number(game.reb || 0),
          ast: Number(game.ast || 0),
          stl: Number(game.stl || 0),
          blk: Number(game.blk || 0),
        };
      })
      .sort((a, b) => Number(a.week || 0) - Number(b.week || 0));
  };

  const getProfileCareerData = (profile) => {
    if (!profile) return null;
    const bamId = String(profile.bamPlayerId || "").trim();
    const normalizedName = String(profile.playerName || profile.name || "")
      .trim()
      .toLowerCase();

    const careerRows = buildPlayerCareerData();

    return (
      careerRows.find(
        (career) => bamId && String(career.bamPlayerId || "") === bamId,
      ) ||
      careerRows.find(
        (career) =>
          String(career.playerName || "")
            .trim()
            .toLowerCase() === normalizedName,
      ) ||
      null
    );
  };

  const getSkillGrade = (value) => {
    const score = Number(value || 0) * 20;
    if (score >= 90) return "S+";
    if (score >= 80) return "S";
    if (score >= 70) return "A";
    if (score >= 60) return "B";
    if (score >= 50) return "C";
    if (score >= 40) return "D";
    return "E";
  };

  const getProfileTitle = (profile, career) => {
    if (career?.awards?.regularSeasonMvp?.total > 0)
      return "THE MOST VALUABLE PLAYER";
    if (career?.awards?.finalsMvp?.total > 0) return "THE FINALS HERO";
    if (career?.awards?.topScorer?.total > 0) return "THE BEST SCORER";
    if (career?.awards?.champion?.total > 0) return "THE CHAMPION";
    if (Number(profile.rating || 0) >= 80) return "THE ELITE HOOPER";
    return "THE RISING PLAYER";
  };

  const animatedMangaCardStyles = `
    @keyframes bamModalFadeIn {
      from { opacity: 0; backdrop-filter: blur(0px); }
      to { opacity: 1; backdrop-filter: blur(9px); }
    }
    @keyframes bamCardEnter {
      0% { opacity: 0; transform: translateY(36px) scale(0.84) rotateX(10deg); filter: saturate(0.7); }
      65% { opacity: 1; transform: translateY(-6px) scale(1.015) rotateX(0deg); filter: saturate(1.18); }
      100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0deg); filter: saturate(1); }
    }
    @keyframes bamMangaLines {
      from { background-position: 0 0, 0 0, 0 0; }
      to { background-position: 110px 0, -90px 70px, 0 140px; }
    }
    @keyframes bamFoilSweep {
      0% { transform: translateX(-135%) skewX(-18deg); opacity: 0; }
      18% { opacity: .55; }
      45% { opacity: .15; }
      100% { transform: translateX(145%) skewX(-18deg); opacity: 0; }
    }
    @keyframes bamAvatarFloat {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-10px) scale(1.015); }
    }
    @keyframes bamGradePulse {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 7px rgba(250,204,21,.75)); }
      50% { transform: scale(1.07); filter: drop-shadow(0 0 18px rgba(250,204,21,.95)); }
    }
    @keyframes bamBadgePop {
      0% { opacity: 0; transform: translateY(18px) scale(.72) rotate(-4deg); }
      72% { opacity: 1; transform: translateY(-4px) scale(1.05) rotate(1deg); }
      100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
    }
    @keyframes bamStatRise {
      0% { opacity: 0; transform: translateY(14px) scale(.9); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes bamRadarDraw {
      0% { opacity: 0; transform: scale(.08); }
      68% { opacity: 1; transform: scale(1.06); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes bamRadarGlow {
      0%, 100% { filter: drop-shadow(0 0 4px rgba(17,24,39,.25)); }
      50% { filter: drop-shadow(0 0 14px rgba(250,204,21,.55)); }
    }
    @keyframes bamSkillBarLoad {
      from { width: 0%; }
      to { width: var(--bam-skill-width); }
    }
    .bam-profile-modal-animated { animation: bamModalFadeIn .28s ease-out both; }
    .bam-athlete-card {
      animation: bamCardEnter .58s cubic-bezier(.2,.9,.2,1.1) both;
      transform-style: preserve-3d;
      will-change: transform, filter;
      transition: transform .25s ease, box-shadow .25s ease;
    }
    .bam-athlete-card:hover { transform: translateY(-4px) rotateX(1.5deg) rotateY(-1.5deg); }
    .bam-athlete-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(32deg, rgba(255,255,255,.16) 0 2px, transparent 2px 10px),
        radial-gradient(circle at 22% 18%, rgba(255,255,255,.55), transparent 24%),
        radial-gradient(circle at 82% 22%, rgba(250,204,21,.22), transparent 18%);
      mix-blend-mode: overlay;
      pointer-events: none;
      animation: bamMangaLines 7s linear infinite;
      opacity: .72;
    }
    .bam-athlete-card::after {
      content: "";
      position: absolute;
      top: -18%;
      bottom: -18%;
      width: 34%;
      left: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
      pointer-events: none;
      animation: bamFoilSweep 3.4s ease-in-out infinite;
    }
    .bam-tier-SSS, .bam-tier-S { box-shadow: 0 0 0 5px #111, 0 0 34px rgba(250,204,21,.45), 14px 14px 0 #111 !important; }
    .bam-tier-A { box-shadow: 0 0 0 5px #111, 0 0 28px rgba(168,85,247,.32), 14px 14px 0 #111 !important; }
    .bam-tier-B { box-shadow: 0 0 0 5px #111, 0 0 22px rgba(34,197,94,.28), 14px 14px 0 #111 !important; }
    .bam-tier-C { box-shadow: 0 0 0 5px #111, 0 0 18px rgba(148,163,184,.28), 14px 14px 0 #111 !important; }
    .bam-radar-card { animation: bamStatRise .45s ease-out .12s both; }
    .bam-radar-polygon { transform-origin: 150px 150px; animation: bamRadarDraw .72s ease-out .24s both, bamRadarGlow 2.4s ease-in-out 1s infinite; }
    .bam-avatar-frame { position: relative; animation: bamAvatarFloat 3.2s ease-in-out infinite; overflow: hidden; }
    .bam-avatar-frame::after { content: ""; position: absolute; inset: -30%; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,.5) 48%, transparent 62%); animation: bamFoilSweep 3s ease-in-out infinite; pointer-events: none; }
    .bam-grade-badge { animation: bamGradePulse 1.9s ease-in-out infinite; }
    .bam-stat-tile { animation: bamStatRise .48s ease-out both; }
    @keyframes bamProfileFlipIn {
      from { opacity: 0; transform: perspective(900px) rotateY(-8deg) translateY(8px); }
      to { opacity: 1; transform: perspective(900px) rotateY(0) translateY(0); }
    }
    .bam-profile-view-panel { animation: bamProfileFlipIn .32s ease-out both; transform-origin: center; min-height: 340px; }
    .bam-award-badge { animation: bamBadgePop .5s cubic-bezier(.2,1.2,.2,1) both; transition: transform .18s ease, box-shadow .18s ease; }
    .bam-award-badge:hover { transform: translateY(-5px) scale(1.03); box-shadow: 7px 7px 0 #111 !important; }
    .bam-skill-row { display: grid; grid-template-columns: 96px 1fr 32px; gap: 8px; align-items: center; margin: 8px 0; font-size: 12px; font-weight: 900; }
    .bam-skill-track { height: 10px; border: 2px solid #111; border-radius: 999px; background: #e5e7eb; overflow: hidden; }
    .bam-skill-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #111827, #facc15); animation: bamSkillBarLoad .9s ease-out both; }
    @media (max-width: 860px) {
      .bam-athlete-card-grid { grid-template-columns: 1fr !important; }
    }
  `;

  const renderMangaSkillRadar = (profile) => {
    const skills = [
      {
        key: "dribbling",
        label: "DRIBBLE",
        th: "การเลี้ยง",
        value: profile.dribbling,
      },
      {
        key: "insideScoring",
        label: "INSIDE",
        th: "วงใน",
        value: profile.insideScoring,
      },
      { key: "shooting", label: "SHOOT", th: "ยิง", value: profile.shooting },
      {
        key: "defense",
        label: "DEFENSE",
        th: "ป้องกัน",
        value: profile.defense,
      },
      { key: "passing", label: "PASS", th: "จ่ายบอล", value: profile.passing },
    ];

    const center = 150;
    const maxRadius = 100;
    const points = skills
      .map((skill, index) => {
        const angle = (-90 + index * (360 / skills.length)) * (Math.PI / 180);
        const radius = (Number(skill.value || 0) / 5) * maxRadius;
        return `${center + Math.cos(angle) * radius},${
          center + Math.sin(angle) * radius
        }`;
      })
      .join(" ");

    const ringPoints = [1, 2, 3, 4, 5].map((level) =>
      skills
        .map((_, index) => {
          const angle = (-90 + index * (360 / skills.length)) * (Math.PI / 180);
          const radius = (level / 5) * maxRadius;
          return `${center + Math.cos(angle) * radius},${
            center + Math.sin(angle) * radius
          }`;
        })
        .join(" "),
    );

    return (
      <div
        className="bam-radar-card"
        style={{
          background: "#f8fafc",
          border: "3px solid #111",
          borderRadius: "18px",
          padding: "10px",
          boxShadow: "8px 8px 0 #111",
        }}
      >
        <svg viewBox="0 0 300 340" width="100%" style={{ display: "block" }}>
          <defs>
            <pattern
              id="mangaGrid"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="#d1d5db"
                strokeWidth="0.6"
              />
            </pattern>
          </defs>
          <rect
            x="0"
            y="0"
            width="300"
            height="340"
            fill="url(#mangaGrid)"
            opacity="0.35"
          />
          <circle
            cx={center}
            cy={center}
            r="128"
            fill="white"
            stroke="#111"
            strokeWidth="4"
          />
          <circle
            cx={center}
            cy={center}
            r="116"
            fill="none"
            stroke="#111"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {ringPoints.map((ring, index) => (
            <polygon
              key={`skill-ring-${index}`}
              points={ring}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={index === 4 ? 2 : 1}
            />
          ))}

          {skills.map((skill, index) => {
            const angle =
              (-90 + index * (360 / skills.length)) * (Math.PI / 180);
            const labelRadius = 137;
            const gradeRadius = 108;
            const x = center + Math.cos(angle) * labelRadius;
            const y = center + Math.sin(angle) * labelRadius;
            const gx = center + Math.cos(angle) * gradeRadius;
            const gy = center + Math.sin(angle) * gradeRadius;

            return (
              <g key={`skill-axis-${skill.key}`}>
                <line
                  x1={center}
                  y1={center}
                  x2={center + Math.cos(angle) * maxRadius}
                  y2={center + Math.sin(angle) * maxRadius}
                  stroke="#111"
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="15"
                  fontWeight="900"
                  fill="#111"
                >
                  {skill.label}
                </text>
                <text
                  x={gx}
                  y={gy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="22"
                  fontWeight="900"
                  fill="#111"
                  stroke="white"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  {getSkillGrade(skill.value)}
                </text>
                <text
                  x={center + Math.cos(angle) * 70}
                  y={center + Math.sin(angle) * 70}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="13"
                  fontWeight="800"
                  fill="#111"
                >
                  {Number(skill.value || 0) * 20}
                </text>
              </g>
            );
          })}

          <polygon
            className="bam-radar-polygon"
            points={points}
            fill="rgba(17, 24, 39, 0.24)"
            stroke="#111"
            strokeWidth="4"
          />
          <circle cx={center} cy={center} r="4" fill="#111" />
          <text
            x="150"
            y="318"
            textAnchor="middle"
            fontSize="12"
            fontWeight="900"
            fill="#111"
          >
            การเลี้ยง / วงใน / ยิง / ป้องกัน / จ่ายบอล
          </text>
        </svg>
      </div>
    );
  };

  const renderMangaPlayerProfileCard = (profile, matchLogs = []) => {
    if (!profile) return null;

    const career = getProfileCareerData(profile);
    const totalRating = Number(
      profile.rating || calculateRatingFromSkills(profile) || 0,
    );
    const tier = profile.tier || calculateTierFromRating(totalRating);
    const careerAwards = career?.awards || {};
    const careerStats = career?.stats || {};
    const legacyScore = Number(career?.legacyScore || 0);
    const title = getProfileTitle(profile, career);
    const profilePhoto =
      profile.photoUrl || getPlayerPhotoUrl(profile.playerId);
    const isSelectedSeasonView = profileCardView === "selectedSeason";
    const seasonViewLabel = profile.isSelectedSeasonProfile
      ? profile.profileSeasonTitle || "Selected Season"
      : "Current Season";
    const seasonViewTitle = seasonViewLabel;

    const timelineItems = (career?.seasons || [])
      .slice()
      .sort((a, b) => {
        if (Number(b.season || 0) !== Number(a.season || 0))
          return Number(b.season || 0) - Number(a.season || 0);
        return String(b.seasonTitle || "").localeCompare(
          String(a.seasonTitle || ""),
        );
      })
      .slice(0, 8);

    const awardLabels = {
      champion: "🏆 Champion",
      regularSeasonMvp: "👑 Regular MVP",
      finalsMvp: "🏅 Finals MVP",
      topScorer: "🎯 Top Scorer",
      reboundLeader: "💪 Rebound",
      assistLeader: "🧠 Assist",
      played: "🏀 Played",
    };

    const badgeList = [
      {
        icon: "🏆",
        label: "Champion",
        count: careerAwards.champion?.total || 0,
      },
      {
        icon: "👑",
        label: "Regular MVP",
        count: careerAwards.regularSeasonMvp?.total || 0,
      },
      {
        icon: "🏅",
        label: "Finals MVP",
        count: careerAwards.finalsMvp?.total || 0,
      },
      {
        icon: "🎯",
        label: "Top Scorer",
        count: careerAwards.topScorer?.total || 0,
      },
      {
        icon: "💪",
        label: "Rebound",
        count: careerAwards.reboundLeader?.total || 0,
      },
      {
        icon: "🧠",
        label: "Assist",
        count: careerAwards.assistLeader?.total || 0,
      },
    ];

    const tierClass = tier?.startsWith("SSS")
      ? "bam-tier-SSS"
      : tier?.startsWith("S")
        ? "bam-tier-S"
        : tier?.startsWith("A")
          ? "bam-tier-A"
          : tier?.startsWith("B")
            ? "bam-tier-B"
            : "bam-tier-C";

    const skillBars = [
      ["การเลี้ยง", profile.dribbling],
      ["วงใน", profile.insideScoring],
      ["ยิง", profile.shooting],
      ["ป้องกัน", profile.defense],
      ["จ่ายบอล", profile.passing],
    ];

    return (
      <div
        id="player-profile-card"
        className={`bam-athlete-card ${tierClass}`}
        style={{
          width: "min(1180px, 100%)",
          border: "5px solid #111",
          borderRadius: "26px",
          padding: "18px",
          background:
            tier?.startsWith("SSS") || tier?.startsWith("S")
              ? "radial-gradient(circle at 18% 12%, #fff7cc 0, #ffffff 26%, #f8fafc 55%, #111827 140%)"
              : tier?.startsWith("A")
                ? "radial-gradient(circle at 18% 12%, #f3e8ff 0, #ffffff 28%, #f8fafc 60%, #312e81 145%)"
                : tier?.startsWith("B")
                  ? "radial-gradient(circle at 18% 12%, #dcfce7 0, #ffffff 28%, #f8fafc 60%, #064e3b 145%)"
                  : "radial-gradient(circle at 25% 15%, #ffffff 0, #ffffff 25%, #f1f5f9 55%, #e5e7eb 100%)",
          boxShadow: "12px 12px 0 #111",
          color: "#111",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(45deg, rgba(0,0,0,0.035) 0, rgba(0,0,0,0.035) 2px, transparent 2px, transparent 8px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            className="bam-athlete-card-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px, 420px) 1fr",
              gap: "22px",
              alignItems: "stretch",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  background: "#111",
                  color: "white",
                  padding: "8px 14px",
                  borderRadius: "12px",
                  fontWeight: "900",
                  letterSpacing: "1px",
                  marginBottom: "12px",
                  boxShadow: "5px 5px 0 #6b7280",
                }}
              >
                {profileCardView === "career" ? `"${title}"` : `"${seasonViewLabel}"`}
              </div>

              {renderMangaSkillRadar(profile)}

              <div
                style={{
                  marginTop: "14px",
                  border: "4px solid #111",
                  borderRadius: "18px",
                  background: "rgba(255,255,255,.92)",
                  padding: "12px",
                  boxShadow: "6px 6px 0 #111",
                }}
              >
                <div style={{ fontWeight: "1000", marginBottom: "6px" }}>
                  ⚡ SKILL OUTPUT
                </div>
                {skillBars.map(([label, value], index) => {
                  const percent = Math.max(
                    0,
                    Math.min(100, Number(value || 0) * 20),
                  );
                  return (
                    <div className="bam-skill-row" key={`skill-bar-${label}`}>
                      <span>{label}</span>
                      <div className="bam-skill-track">
                        <div
                          className="bam-skill-fill"
                          style={{
                            "--bam-skill-width": `${percent}%`,
                            animationDelay: `${0.18 + index * 0.08}s`,
                          }}
                        />
                      </div>
                      <span>{Number(value || 0)}/5</span>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: "16px",
                  border: "4px solid #111",
                  borderRadius: "18px",
                  background: "white",
                  padding: "14px",
                  boxShadow: "7px 7px 0 #111",
                }}
              >
                <div
                  style={{ fontSize: "13px", fontWeight: "900", color: "#555" }}
                >
                  TOTAL RATING
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "end",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: "54px",
                      fontWeight: "1000",
                      lineHeight: 1,
                    }}
                  >
                    {totalRating}
                  </div>
                  <div
                    style={{
                      fontSize: "62px",
                      fontWeight: "1000",
                      lineHeight: 0.9,
                    }}
                  >
                    {tier}
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "900",
                        color: "#555",
                      }}
                    >
                      {profileCardView === "career" ? "LEGACY" : seasonViewLabel}
                    </div>
                    <div style={{ fontSize: "36px", fontWeight: "1000" }}>
                      {profileCardView === "career" ? legacyScore : "SEASON"}
                    </div>
                  </div>
                </div>
                <div
                  style={{ fontSize: "12px", color: "#555", marginTop: "8px" }}
                >
                  SSS+ 90-100 | S+ 80-89 | S- 70-79 | A+ 60-69 | A- 50-59
                </div>
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr minmax(180px, 260px)",
                  gap: "18px",
                  alignItems: "start",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "900",
                      letterSpacing: "2px",
                      color: "#555",
                    }}
                  >
                    BAM LEAGUE PLAYER FILE
                  </div>
                  <h1
                    style={{
                      fontSize: "44px",
                      lineHeight: 1,
                      margin: "8px 0 4px",
                      fontWeight: "1000",
                    }}
                  >
                    {profile.playerName || profile.name}
                  </h1>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#555",
                      fontWeight: "800",
                    }}
                  >
                    {profile.bamPlayerId || "NO BAM ID"} ·{" "}
                    {profile.teamName || "No Team"} · {profile.pos1 || "-"}
                    {profile.pos2 ? ` / ${profile.pos2}` : ""}
                  </div>
                </div>

                <div
                  className="bam-avatar-frame"
                  style={{
                    border: "4px solid #111",
                    borderRadius: "18px",
                    background: "white",
                    overflow: "hidden",
                    boxShadow: "7px 7px 0 #111",
                    minHeight: "220px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={profile.playerName || profile.name}
                      style={{
                        width: "100%",
                        height: "240px",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: "96px" }}>🏀</div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "18px",
                }}
              >
                {[
                  [
                    profile.isSelectedSeasonProfile ? "selectedSeason" : "current",
                    profile.isSelectedSeasonProfile
                      ? "Selected Season"
                      : "Current Season",
                  ],
                  ["career", "Career"],
                ].map(([viewKey, label]) => {
                  const isActive = profileCardView === viewKey;
                  return (
                    <button
                      key={`profile-card-view-${viewKey}`}
                      onClick={() => setProfileCardView(viewKey)}
                      style={{
                        border: "3px solid #111",
                        borderRadius: "999px",
                        padding: "8px 14px",
                        fontWeight: "1000",
                        cursor: "pointer",
                        background: isActive ? "#111" : "white",
                        color: isActive ? "white" : "#111",
                        boxShadow: isActive
                          ? "4px 4px 0 #facc15"
                          : "4px 4px 0 #111",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div
                key={`profile-card-${profileCardView}`}
                className="bam-profile-view-panel"
              >
                {profileCardView === "current" || isSelectedSeasonView ? (
                  <>
                    <div
                      style={{
                        marginTop: "18px",
                        fontWeight: "1000",
                        color: "#c2410c",
                      }}
                    >
                      {seasonViewTitle}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(110px, 1fr))",
                        gap: "10px",
                        marginTop: "18px",
                      }}
                    >
                      {[
                        ["GP", profile.games ?? 0],
                        ["PTS", profile.pts ?? 0],
                        ["PPG", profile.ppg ?? "0.0"],
                        ["REB", profile.reb ?? 0],
                        ["AST", profile.ast ?? 0],
                        ["MVP", Number(profile.mvpScore ?? 0).toFixed(1)],
                      ].map(([label, value], index) => (
                        <div
                          key={`manga-current-stat-${label}`}
                          className="bam-stat-tile"
                          style={{
                            animationDelay: `${0.08 + index * 0.06}s`,
                            border: "3px solid #111",
                            borderRadius: "14px",
                            background: "white",
                            padding: "10px",
                            textAlign: "center",
                            boxShadow: "4px 4px 0 #111",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#555",
                              fontWeight: "900",
                            }}
                          >
                            {label}
                          </div>
                          <div style={{ fontSize: "24px", fontWeight: "1000" }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        border: "3px solid #111",
                        borderRadius: "18px",
                        background: "white",
                        padding: "14px",
                        boxShadow: "5px 5px 0 #111",
                        overflowX: "auto",
                        marginTop: "18px",
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>📜 {seasonViewTitle} Match Log</h3>
                      {matchLogs.length === 0 ? (
                        <p style={{ color: "#666" }}>
                          ???????? Match Log ????????????
                        </p>
                      ) : (
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "13px",
                          }}
                        >
                          <thead>
                            <tr>
                              <th>W</th>
                              <th>OPP</th>
                              <th>PTS</th>
                              <th>REB</th>
                              <th>AST</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchLogs.slice(-8).map((log) => (
                              <tr
                                key={`manga-log-${profile.playerId}-${log.matchId}`}
                                style={{ borderTop: "1px solid #ddd" }}
                              >
                                <td>{log.week}</td>
                                <td>{log.opponent}</td>
                                <td>{log.appearance ? log.pts : "-"}</td>
                                <td>{log.appearance ? log.reb : "-"}</td>
                                <td>{log.appearance ? log.ast : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(110px, 1fr))",
                        gap: "10px",
                        marginTop: "18px",
                      }}
                    >
                      {[
                        ["Seasons", career?.seasonCount ?? 0],
                        ["Games", careerStats.games ?? 0],
                        ["PTS", careerStats.pts ?? 0],
                        ["PPG", career?.ppg ?? "0.0"],
                        ["REB", careerStats.reb ?? 0],
                        ["AST", careerStats.ast ?? 0],
                      ].map(([label, value], index) => (
                        <div
                          key={`manga-career-stat-${label}`}
                          className="bam-stat-tile"
                          style={{
                            animationDelay: `${0.08 + index * 0.06}s`,
                            border: "3px solid #111",
                            borderRadius: "14px",
                            background: "white",
                            padding: "10px",
                            textAlign: "center",
                            boxShadow: "4px 4px 0 #111",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#555",
                              fontWeight: "900",
                            }}
                          >
                            {label}
                          </div>
                          <div style={{ fontSize: "24px", fontWeight: "1000" }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: "10px",
                        marginTop: "18px",
                      }}
                    >
                      {badgeList.map((badge, index) => (
                        <div
                          key={`manga-badge-${badge.label}`}
                          className="bam-award-badge"
                          style={{
                            animationDelay: `${0.16 + index * 0.08}s`,
                            border: "3px solid #111",
                            borderRadius: "14px",
                            background: "white",
                            padding: "10px",
                            boxShadow: "4px 4px 0 #111",
                          }}
                        >
                          <div style={{ fontWeight: "1000" }}>
                            {badge.icon} {badge.label}
                          </div>
                          <div style={{ fontSize: "22px", fontWeight: "1000" }}>
                            x{badge.count}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        border: "3px solid #111",
                        borderRadius: "18px",
                        background: "white",
                        padding: "14px",
                        boxShadow: "5px 5px 0 #111",
                        marginTop: "18px",
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>?? Season Timeline</h3>
                      {timelineItems.length === 0 ? (
                        <p style={{ color: "#666" }}>
                          ????????????????????????
                        </p>
                      ) : (
                        timelineItems.map((item) => (
                          <div
                            key={`manga-timeline-${item.seasonId}-${item.award}`}
                            style={{
                              borderBottom: "1px solid #ddd",
                              padding: "8px 0",
                            }}
                          >
                            <strong>{item.seasonTitle}</strong>
                            <div style={{ color: "#555" }}>
                              {awardLabels[item.award] || item.award}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPlayerProfileModal = () => {
    const profile = getSelectedPlayerProfile();
    if (!selectedProfilePlayerId || !profile) return null;
    const selectedSeasonForProfile = publicProfileSeasonContext
      ? seasonHistory.find(
          (season) =>
            String(season.id) === String(publicProfileSeasonContext.seasonId),
        )
      : null;
    const matchLogs = getPlayerMatchLog(
      profile,
      selectedSeasonForProfile?.archivedData?.schedule || schedule,
    );

    return (
      <div
        className="bam-profile-modal-animated"
        onClick={closePlayerProfile}
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(circle at center, rgba(15,23,42,.68), rgba(0,0,0,.86))",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <style>{animatedMangaCardStyles}</style>
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(1240px, 100%)",
            maxHeight: "92vh",
            overflowY: "auto",
            position: "relative",
            padding: "8px 12px 18px 0",
          }}
        >
          <button
            onClick={closePlayerProfile}
            style={{
              position: "sticky",
              top: 0,
              float: "right",
              zIndex: 2,
              width: "42px",
              height: "42px",
              borderRadius: "999px",
              border: "3px solid #111",
              background: "white",
              fontWeight: "900",
              cursor: "pointer",
              boxShadow: "4px 4px 0 #111",
              marginBottom: "8px",
            }}
          >
            ×
          </button>
          {renderMangaPlayerProfileCard(profile, matchLogs)}
        </div>
      </div>
    );
  };

  const clearPlayerStats = () => {
    if (!window.confirm("ต้องการลบ Player Stats ทั้งหมดใช่ไหม?")) return;
    setPlayerStats({});
    setMatchStatInputs({});
    localStorage.removeItem("playerStats");
    localStorage.removeItem("matchStatInputs");
  };

  const updatePlayoffTeams = () => {
    const playoffStandings = calculateStandings();

    if (playoffStandings.length < 2) {
      alert("ยังไม่มีอันดับเพียงพอสำหรับ Playoff");
      return;
    }

    setSchedule((prevSchedule) =>
      prevSchedule.map((match) => {
        // 3 Teams: Final 1 vs 2
        if (teams.length === 3 && match.playoffType === "final_1v2") {
          return {
            ...match,
            teamA: playoffStandings[0]?.team || "Rank 1",
            teamB: playoffStandings[1]?.team || "Rank 2",
          };
        }

        // 4+ Teams: Semi Final
        if (teams.length >= 4 && match.playoffType === "sf1") {
          return {
            ...match,
            teamA: playoffStandings[0]?.team || "Rank 1",
            teamB: playoffStandings[3]?.team || "Rank 4",
          };
        }

        if (teams.length >= 4 && match.playoffType === "sf2") {
          return {
            ...match,
            teamA: playoffStandings[1]?.team || "Rank 2",
            teamB: playoffStandings[2]?.team || "Rank 3",
          };
        }

        const sf1 = prevSchedule.find((m) => m.playoffType === "sf1");
        const sf2 = prevSchedule.find((m) => m.playoffType === "sf2");

        const sf1Finished =
          sf1 &&
          sf1.status === "Finished" &&
          sf1.scoreA !== "" &&
          sf1.scoreB !== "";

        const sf2Finished =
          sf2 &&
          sf2.status === "Finished" &&
          sf2.scoreA !== "" &&
          sf2.scoreB !== "";

        if (!sf1Finished || !sf2Finished) return match;

        const sf1AWin = Number(sf1.scoreA) > Number(sf1.scoreB);
        const sf2AWin = Number(sf2.scoreA) > Number(sf2.scoreB);

        const sf1Winner = sf1AWin ? sf1.teamA : sf1.teamB;
        const sf1Loser = sf1AWin ? sf1.teamB : sf1.teamA;

        const sf2Winner = sf2AWin ? sf2.teamA : sf2.teamB;
        const sf2Loser = sf2AWin ? sf2.teamB : sf2.teamA;

        if (match.playoffType === "third_place") {
          return {
            ...match,
            teamA: sf1Loser,
            teamB: sf2Loser,
          };
        }

        if (match.playoffType === "final") {
          return {
            ...match,
            teamA: sf1Winner,
            teamB: sf2Winner,
          };
        }

        return match;
      }),
    );
  };

  const clearSchedule = () => {
    if (!window.confirm("ต้องการลบ Schedule ใช่ไหม?")) return;
    resetScheduleDependentData();
  };

  // ======================================================
  // 20. SEASON MANAGEMENT
  // NOTE: Later migrate this region to src/services/season/seasonService.js.
  // ======================================================

  const closeSeason = () => {
    const standingsRows = calculateStandings();
    const awards = getSeasonAwards();

    if (standingsRows.length === 0 && getPlayerStatRows().length === 0) {
      alert("ยังไม่มีข้อมูลการแข่งขันหรือสถิติสำหรับปิด Season");
      return;
    }

    const champion =
      awards.champion && awards.champion !== "-"
        ? awards.champion
        : standingsRows[0]?.team || "-";

    const runnerUp =
      awards.runnerUp && awards.runnerUp !== "-"
        ? awards.runnerUp
        : standingsRows[1]?.team || "-";

    const projectName = getCurrentSeasonTitle();

    const seasonRecord = {
      id: Date.now(),
      dataVersion: CORE_DATABASE_VERSION,
      season: currentSeason,
      competitionType,
      projectName,
      teamCount,
      closedAt: new Date().toISOString(),
      closedAtText: new Date().toLocaleString(),
      champion,
      runnerUp,
      thirdPlace: awards.thirdPlace || "-",
      finalScore: awards.finalScore || "-",
      thirdPlaceScore: awards.thirdPlaceScore || "-",
      regularSeasonMvp: awards.regularSeasonMvp?.playerName || "-",
      regularSeasonMvpPlayerId:
        awards.regularSeasonMvp?.bamPlayerId ||
        awards.regularSeasonMvp?.playerId ||
        "",
      regularSeasonMvpTeam: awards.regularSeasonMvp?.teamName || "-",
      regularSeasonMvpScore: Number(awards.regularSeasonMvp?.mvpScore || 0),
      finalsMvp: awards.finalsMvp?.playerName || "-",
      finalsMvpTeam: awards.finalsMvp?.teamName || "-",
      finalsMvpPlayerId:
        awards.finalsMvp?.bamPlayerId || awards.finalsMvp?.playerId || "",
      finalsMvpAward: awards.finalsMvp
        ? {
            playerId: awards.finalsMvp.bamPlayerId || awards.finalsMvp.playerId,
            playerName: awards.finalsMvp.playerName,
            teamName: awards.finalsMvp.teamName || "",
            season: currentSeason,
            competitionType,
          }
        : null,
      // Backward compatible fields. MVP now means Regular Season MVP.
      mvp: awards.regularSeasonMvp?.playerName || "-",
      mvpTeam: awards.regularSeasonMvp?.teamName || "-",
      mvpScore: Number(awards.regularSeasonMvp?.mvpScore || 0),
      topScorer: awards.topScorer?.playerName || "-",
      topScorerPlayerId:
        awards.topScorer?.bamPlayerId || awards.topScorer?.playerId || "",
      topScorerTeam: awards.topScorer?.teamName || "-",
      topScorerPts: Number(awards.topScorer?.pts || 0),
      reboundLeader: awards.reboundLeader?.playerName || "-",
      reboundLeaderPlayerId:
        awards.reboundLeader?.bamPlayerId ||
        awards.reboundLeader?.playerId ||
        "",
      reboundLeaderReb: Number(awards.reboundLeader?.reb || 0),
      assistLeader: awards.assistLeader?.playerName || "-",
      assistLeaderPlayerId:
        awards.assistLeader?.bamPlayerId || awards.assistLeader?.playerId || "",
      assistLeaderAst: Number(awards.assistLeader?.ast || 0),
      standings: standingsRows,
      archivedData: {
        competitionType,
        season: currentSeason,
        projectName,
        teamCount,
        players,
        teams,
        schedule,
        drafts,
        matchRosters,
        playerStats,
        matchStatInputs,
        teamNames,
        teamLogos,
        lockGroups,
        databaseMeta: { version: CORE_DATABASE_VERSION },
        standings: standingsRows,
      },
    };

    const confirmClose = window.confirm(
      `ต้องการปิด ${projectName} ใช่ไหม?\n\n` +
        `Type/Season: ${competitionType} Season ${currentSeason}\n` +
        `Champion: ${seasonRecord.champion}\n` +
        `Regular Season MVP: ${seasonRecord.regularSeasonMvp}\n` +
        `Finals MVP: ${seasonRecord.finalsMvp}\n` +
        `Top Scorer: ${seasonRecord.topScorer}\n\n` +
        "ระบบจะบันทึก Season History และล้างทีม/ตาราง/สถิติเพื่อเริ่ม Season ใหม่ โดยไม่ลบรายชื่อผู้เล่น รูปผู้เล่น และโลโก้ทีม",
    );

    if (!confirmClose) return;

    setSeasonHistory((prevHistory) => [seasonRecord, ...prevHistory]);
    setSeasonByType((prevSeasons) => ({
      ...prevSeasons,
      [competitionType]: (prevSeasons[competitionType] || 1) + 1,
    }));

    setTeams([]);
    setSchedule([]);
    setDrafts([]);
    setMatchRosters({});
    setPlayerStats({});
    setMatchStatInputs({});
    setLockGroups([]);
    setSelectedLockPlayerIds([]);
    setLockGroupName("");
    setSeasonProjectName("");
    setSelectedRosterMatchId("");
    setSelectedStatsMatchId("");
    setSelectedProfilePlayerId("");
    setSelectedFinalsMvpId("");
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => ({ ...player, teamName: "" })),
    );

    alert(
      `บันทึก ${projectName} แล้ว เริ่ม ${competitionType} Season ${
        currentSeason + 1
      }`,
    );
  };

  const deleteSeasonHistoryItem = (seasonId) => {
    if (!window.confirm("ต้องการลบประวัติ Season นี้ใช่ไหม?")) return;
    setSeasonHistory((prevHistory) =>
      prevHistory.filter((season) => season.id !== seasonId),
    );
  };

  const renameSeasonHistoryItem = (seasonId) => {
    const currentRecord = seasonHistory.find(
      (season) => season.id === seasonId,
    );
    const currentName =
      currentRecord?.projectName ||
      `${currentRecord?.competitionType || "5X5"} Season ${
        currentRecord?.season || 1
      }`;

    const newName = window.prompt(
      "ตั้งชื่อโครงการ / รายการแข่งขันใหม่",
      currentName,
    );
    if (!newName || !newName.trim()) return;

    setSeasonHistory((prevHistory) =>
      prevHistory.map((season) =>
        season.id === seasonId
          ? { ...season, projectName: newName.trim() }
          : season,
      ),
    );
  };

  const getSeasonHistoryTitle = (seasonRecord) =>
    seasonRecord?.projectName ||
    `${seasonRecord?.competitionType || "5X5"} Season ${
      seasonRecord?.season || 1
    }`;

  const getSeasonHistoryEditDefault = (seasonRecord, key, fallback = "") => {
    if (!seasonRecord) return fallback;

    if (seasonRecord[key] !== undefined && seasonRecord[key] !== null) {
      return seasonRecord[key];
    }

    return fallback;
  };

  const startEditSeasonHistoryItem = (seasonRecord) => {
    if (!seasonRecord) return;

    setEditingSeasonHistoryId(seasonRecord.id);
    setSeasonHistoryEditForm({
      projectName: getSeasonHistoryTitle(seasonRecord),
      competitionType: seasonRecord.competitionType || "5X5",
      season: Number(seasonRecord.season || 1),
      closedAtText: getSeasonHistoryEditDefault(
        seasonRecord,
        "closedAtText",
        "",
      ),
      champion: getSeasonHistoryEditDefault(seasonRecord, "champion", ""),
      runnerUp: getSeasonHistoryEditDefault(seasonRecord, "runnerUp", ""),
      thirdPlace: getSeasonHistoryEditDefault(seasonRecord, "thirdPlace", ""),
      regularSeasonMvp: getSeasonHistoryEditDefault(
        seasonRecord,
        "regularSeasonMvp",
        seasonRecord.mvp || "",
      ),
      finalsMvp: getSeasonHistoryEditDefault(seasonRecord, "finalsMvp", ""),
      topScorer: getSeasonHistoryEditDefault(seasonRecord, "topScorer", ""),
      topScorerPts: Number(seasonRecord.topScorerPts || 0),
      reboundLeader: getSeasonHistoryEditDefault(
        seasonRecord,
        "reboundLeader",
        "",
      ),
      reboundLeaderReb: Number(seasonRecord.reboundLeaderReb || 0),
      assistLeader: getSeasonHistoryEditDefault(
        seasonRecord,
        "assistLeader",
        "",
      ),
      assistLeaderAst: Number(seasonRecord.assistLeaderAst || 0),
      notes: getSeasonHistoryEditDefault(seasonRecord, "notes", ""),
    });
  };

  const cancelEditSeasonHistoryItem = () => {
    setEditingSeasonHistoryId(null);
    setSeasonHistoryEditForm({
      projectName: "",
      competitionType: "5X5",
      season: 1,
      closedAtText: "",
      champion: "",
      runnerUp: "",
      thirdPlace: "",
      regularSeasonMvp: "",
      finalsMvp: "",
      topScorer: "",
      topScorerPts: 0,
      reboundLeader: "",
      reboundLeaderReb: 0,
      assistLeader: "",
      assistLeaderAst: 0,
      notes: "",
    });
  };

  const updateSeasonHistoryEditForm = (field, value) => {
    setSeasonHistoryEditForm((prevForm) => ({
      ...prevForm,
      [field]: value,
    }));
  };

  const saveSeasonHistoryEditForm = () => {
    if (!editingSeasonHistoryId) return;

    const projectName = seasonHistoryEditForm.projectName.trim();
    const competitionType =
      seasonHistoryEditForm.competitionType === "3X3" ? "3X3" : "5X5";
    const seasonNumber = Number(seasonHistoryEditForm.season || 1);

    if (!projectName) {
      alert("กรุณากรอกชื่อ Season / Project");
      return;
    }

    if (!Number.isFinite(seasonNumber) || seasonNumber < 1) {
      alert("Season number ต้องเป็นตัวเลขตั้งแต่ 1 ขึ้นไป");
      return;
    }

    setSeasonHistory((prevHistory) =>
      prevHistory.map((seasonRecord) => {
        if (seasonRecord.id !== editingSeasonHistoryId) return seasonRecord;

        const regularSeasonMvp =
          seasonHistoryEditForm.regularSeasonMvp.trim() || "-";
        const finalsMvp = seasonHistoryEditForm.finalsMvp.trim() || "-";
        const topScorer = seasonHistoryEditForm.topScorer.trim() || "-";

        return {
          ...seasonRecord,
          projectName,
          competitionType,
          season: seasonNumber,
          closedAtText: seasonHistoryEditForm.closedAtText.trim(),
          champion: seasonHistoryEditForm.champion.trim() || "-",
          runnerUp: seasonHistoryEditForm.runnerUp.trim() || "-",
          thirdPlace: seasonHistoryEditForm.thirdPlace.trim() || "-",
          regularSeasonMvp,
          finalsMvp,
          topScorer,
          topScorerPts: Number(seasonHistoryEditForm.topScorerPts || 0),
          reboundLeader: seasonHistoryEditForm.reboundLeader.trim() || "-",
          reboundLeaderReb: Number(seasonHistoryEditForm.reboundLeaderReb || 0),
          assistLeader: seasonHistoryEditForm.assistLeader.trim() || "-",
          assistLeaderAst: Number(seasonHistoryEditForm.assistLeaderAst || 0),
          notes: seasonHistoryEditForm.notes.trim(),
          editedAt: new Date().toISOString(),
          editedAtText: new Date().toLocaleString(),
          // Backward compatible fields used by existing Hall of Fame widgets.
          mvp: regularSeasonMvp,
          finalsMvpAward:
            finalsMvp && finalsMvp !== "-"
              ? {
                  ...(seasonRecord.finalsMvpAward || {}),
                  playerName: finalsMvp,
                  teamName: seasonRecord.finalsMvpTeam || "",
                  season: seasonNumber,
                  competitionType,
                }
              : null,
        };
      }),
    );

    cancelEditSeasonHistoryItem();
  };

  const moveSeasonHistoryItem = (seasonId, direction) => {
    setSeasonHistory((prevHistory) => {
      const currentIndex = prevHistory.findIndex(
        (season) => season.id === seasonId,
      );

      if (currentIndex === -1) return prevHistory;

      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= prevHistory.length) {
        return prevHistory;
      }

      const updatedHistory = [...prevHistory];
      [updatedHistory[currentIndex], updatedHistory[targetIndex]] = [
        updatedHistory[targetIndex],
        updatedHistory[currentIndex],
      ];

      return updatedHistory;
    });
  };

  const moveSeasonHistoryToTop = (seasonId) => {
    setSeasonHistory((prevHistory) => {
      const currentIndex = prevHistory.findIndex(
        (season) => season.id === seasonId,
      );

      if (currentIndex <= 0) return prevHistory;

      const updatedHistory = [...prevHistory];
      const [selectedSeason] = updatedHistory.splice(currentIndex, 1);
      return [selectedSeason, ...updatedHistory];
    });
  };

  const moveSeasonHistoryToBottom = (seasonId) => {
    setSeasonHistory((prevHistory) => {
      const currentIndex = prevHistory.findIndex(
        (season) => season.id === seasonId,
      );

      if (currentIndex === -1 || currentIndex === prevHistory.length - 1) {
        return prevHistory;
      }

      const updatedHistory = [...prevHistory];
      const [selectedSeason] = updatedHistory.splice(currentIndex, 1);
      return [...updatedHistory, selectedSeason];
    });
  };

  const sortSeasonHistoryByCompetitionAndSeason = () => {
    if (seasonHistory.length <= 1) return;

    const confirmSort = window.confirm(
      "ต้องการเรียง Season History ตามประเภทการแข่งขันและเลข Season ใช่ไหม?\n\n" +
        "ลำดับปัจจุบันจะถูกเปลี่ยน แต่ยังสามารถเลื่อนรายการเองได้หลังจากนี้",
    );

    if (!confirmSort) return;

    setSeasonHistory((prevHistory) =>
      [...prevHistory].sort((a, b) => {
        const typeA = a.competitionType || "5X5";
        const typeB = b.competitionType || "5X5";

        if (typeA !== typeB) return typeA.localeCompare(typeB);

        const seasonA = Number(a.season || 0);
        const seasonB = Number(b.season || 0);

        if (seasonA !== seasonB) return seasonA - seasonB;

        return String(a.closedAt || "").localeCompare(String(b.closedAt || ""));
      }),
    );
  };

  const exportSeasonHistoryItem = (seasonRecord) => {
    const safeName = String(
      seasonRecord.projectName ||
        `${seasonRecord.competitionType || "5X5"}-Season-${
          seasonRecord.season || 1
        }`,
    )
      .replace(/[^a-zA-Z0-9ก-๙_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const exportData = {
      version: "BAM_SEASON_HISTORY_V1",
      exportedAt: new Date().toISOString(),
      seasonRecord,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${safeName || "bam-season-history"}.json`;
    link.click();
  };

  const buildSeasonRecordFromBackup = (data, options = {}) => {
    const selectedType = options.competitionType === "3X3" ? "3X3" : "5X5";
    const selectedSeason =
      Number.isFinite(Number(options.season)) && Number(options.season) >= 1
        ? Number(options.season)
        : 1;

    const sourceRecord = data?.seasonRecord || data;
    const sourceArchived =
      sourceRecord?.archivedData || data?.archivedData || data;
    const sourceTeams = Array.isArray(sourceArchived?.teams)
      ? sourceArchived.teams
      : Array.isArray(data?.teams)
        ? data.teams
        : [];
    const sourceSchedule = Array.isArray(sourceArchived?.schedule)
      ? sourceArchived.schedule
      : Array.isArray(data?.schedule)
        ? data.schedule
        : [];
    const sourcePlayerStats =
      sourceArchived?.playerStats &&
      typeof sourceArchived.playerStats === "object"
        ? sourceArchived.playerStats
        : data?.playerStats && typeof data.playerStats === "object"
          ? data.playerStats
          : {};

    const standingsRows = Array.isArray(sourceRecord?.standings)
      ? sourceRecord.standings
      : Array.isArray(sourceArchived?.standings)
        ? sourceArchived.standings
        : [];
    const champion = sourceRecord?.champion || standingsRows[0]?.team || "-";
    const runnerUp = sourceRecord?.runnerUp || standingsRows[1]?.team || "-";

    return {
      id: Date.now(),
      competitionType: selectedType,
      season: selectedSeason,
      projectName:
        options.projectName?.trim() ||
        sourceRecord?.projectName ||
        `${selectedType} Season ${selectedSeason}`,
      teamCount: Number(
        sourceRecord?.teamCount ||
          sourceArchived?.teamCount ||
          sourceTeams.length ||
          defaultTeamCount,
      ),
      closedAt: sourceRecord?.closedAt || new Date().toISOString(),
      closedAtText: sourceRecord?.closedAtText || new Date().toLocaleString(),
      champion,
      runnerUp,
      thirdPlace: sourceRecord?.thirdPlace || "-",
      finalScore: sourceRecord?.finalScore || "-",
      thirdPlaceScore: sourceRecord?.thirdPlaceScore || "-",
      regularSeasonMvp:
        sourceRecord?.regularSeasonMvp || sourceRecord?.mvp || "-",
      regularSeasonMvpTeam:
        sourceRecord?.regularSeasonMvpTeam || sourceRecord?.mvpTeam || "-",
      regularSeasonMvpScore: Number(
        sourceRecord?.regularSeasonMvpScore || sourceRecord?.mvpScore || 0,
      ),
      finalsMvp: sourceRecord?.finalsMvp || "-",
      finalsMvpTeam: sourceRecord?.finalsMvpTeam || "-",
      finalsMvpPlayerId: sourceRecord?.finalsMvpPlayerId || "",
      finalsMvpAward: sourceRecord?.finalsMvpAward || null,
      // Backward compatible fields. MVP means Regular Season MVP.
      mvp: sourceRecord?.regularSeasonMvp || sourceRecord?.mvp || "-",
      mvpTeam:
        sourceRecord?.regularSeasonMvpTeam || sourceRecord?.mvpTeam || "-",
      mvpScore: Number(
        sourceRecord?.regularSeasonMvpScore || sourceRecord?.mvpScore || 0,
      ),
      topScorer: sourceRecord?.topScorer || "-",
      topScorerTeam: sourceRecord?.topScorerTeam || "-",
      topScorerPts: Number(sourceRecord?.topScorerPts || 0),
      reboundLeader: sourceRecord?.reboundLeader || "-",
      reboundLeaderReb: Number(sourceRecord?.reboundLeaderReb || 0),
      assistLeader: sourceRecord?.assistLeader || "-",
      assistLeaderAst: Number(sourceRecord?.assistLeaderAst || 0),
      standings: standingsRows,
      archivedData: {
        competitionType: selectedType,
        season: selectedSeason,
        projectName:
          options.projectName?.trim() ||
          sourceRecord?.projectName ||
          `${selectedType} Season ${selectedSeason}`,
        teamCount: Number(
          sourceRecord?.teamCount ||
            sourceArchived?.teamCount ||
            sourceTeams.length ||
            defaultTeamCount,
        ),
        players: Array.isArray(sourceArchived?.players)
          ? sourceArchived.players
          : Array.isArray(data?.players)
            ? data.players
            : [],
        teams: sourceTeams,
        schedule: sourceSchedule,
        drafts: Array.isArray(sourceArchived?.drafts)
          ? sourceArchived.drafts
          : Array.isArray(data?.drafts)
            ? data.drafts
            : [],
        matchRosters:
          sourceArchived?.matchRosters &&
          typeof sourceArchived.matchRosters === "object"
            ? sourceArchived.matchRosters
            : data?.matchRosters && typeof data.matchRosters === "object"
              ? data.matchRosters
              : {},
        playerStats: sourcePlayerStats,
        matchStatInputs:
          sourceArchived?.matchStatInputs &&
          typeof sourceArchived.matchStatInputs === "object"
            ? sourceArchived.matchStatInputs
            : data?.matchStatInputs && typeof data.matchStatInputs === "object"
              ? data.matchStatInputs
              : {},
        teamNames: Array.isArray(sourceArchived?.teamNames)
          ? sourceArchived.teamNames
          : Array.isArray(data?.teamNames)
            ? data.teamNames
            : [],
        teamLogos:
          sourceArchived?.teamLogos &&
          typeof sourceArchived.teamLogos === "object"
            ? sourceArchived.teamLogos
            : data?.teamLogos && typeof data.teamLogos === "object"
              ? data.teamLogos
              : {},
        lockGroups: Array.isArray(sourceArchived?.lockGroups)
          ? sourceArchived.lockGroups
          : Array.isArray(data?.lockGroups)
            ? data.lockGroups
            : [],
        standings: standingsRows,
      },
    };
  };

  const importSeasonHistoryBackup = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== "object") {
        alert("ไฟล์ Season Backup ไม่ถูกต้อง");
        event.target.value = "";
        return;
      }

      if (Array.isArray(data.seasonHistory) && data.seasonHistory.length > 0) {
        const importAll = window.confirm(
          `พบ Season History ในไฟล์ ${data.seasonHistory.length} รายการ\nต้องการ Import ทั้งหมดหรือไม่?\n\nกด Cancel หากต้องการ Import เฉพาะข้อมูลลีกปัจจุบันเป็น 1 Season`,
        );

        if (importAll) {
          const normalizedRecords = data.seasonHistory.map((record, index) => ({
            ...record,
            id: Date.now() + index,
            competitionType: record.competitionType === "3X3" ? "3X3" : "5X5",
            season: Number(record.season || 1),
            projectName:
              record.projectName ||
              `${
                record.competitionType === "3X3" ? "3X3" : "5X5"
              } Season ${Number(record.season || 1)}`,
          }));

          setSeasonHistory((prevHistory) => [
            ...normalizedRecords,
            ...prevHistory,
          ]);
          alert(
            `Import Season History สำเร็จ ${normalizedRecords.length} รายการ`,
          );
          event.target.value = "";
          return;
        }
      }

      const targetTypeInput = window.prompt(
        "ประเภทการแข่งขันของ Season นี้? พิมพ์ 3X3 หรือ 5X5",
        data.competitionType === "3X3" ? "3X3" : competitionType,
      );
      if (!targetTypeInput) {
        event.target.value = "";
        return;
      }

      const targetType =
        targetTypeInput.toUpperCase() === "3X3" ? "3X3" : "5X5";
      const targetSeasonInput = window.prompt(
        "ต้องการบันทึกเป็น Season ที่เท่าไหร่?",
        String(seasonByType[targetType] || 1),
      );
      if (!targetSeasonInput) {
        event.target.value = "";
        return;
      }

      const targetSeason = Number(targetSeasonInput);
      if (!Number.isFinite(targetSeason) || targetSeason < 1) {
        alert("Season ต้องเป็นตัวเลขตั้งแต่ 1 ขึ้นไป");
        event.target.value = "";
        return;
      }

      const defaultName =
        data?.seasonRecord?.projectName ||
        `${targetType} Season ${targetSeason}`;
      const projectName = window.prompt(
        "ชื่อโครงการ / รายการแข่งขัน",
        defaultName,
      );
      if (!projectName || !projectName.trim()) {
        event.target.value = "";
        return;
      }

      const newRecord = buildSeasonRecordFromBackup(data, {
        competitionType: targetType,
        season: targetSeason,
        projectName: projectName.trim(),
      });

      setSeasonHistory((prevHistory) => [newRecord, ...prevHistory]);
      setSeasonByType((prevSeasons) => ({
        ...prevSeasons,
        [targetType]: Math.max(
          Number(prevSeasons[targetType] || 1),
          targetSeason + 1,
        ),
      }));

      alert(`Import ${newRecord.projectName} เข้า Season History สำเร็จ`);
    } catch (error) {
      alert("Import Season Backup ไม่สำเร็จ กรุณาตรวจสอบไฟล์ .json");
    }

    event.target.value = "";
  };

  const clearSeasonHistory = () => {
    if (!window.confirm("ต้องการลบ Season History ทั้งหมดใช่ไหม?")) return;
    setSeasonHistory([]);
    localStorage.removeItem("seasonHistory");
  };

  // ======================================================
  // 21. LOCAL BACKUP / RESTORE
  // ======================================================

  const exportLeagueBackup = () => {
    const backupData = {
      competitionType,
      teamCount,
      teamNames,
      players,
      teams,
      schedule,
      drafts,
      matchRosters,
      playerStats,
      matchStatInputs,
      teamLogos,
      lockGroups,
      seasonByType,
      currentSeason,
      seasonProjectName,
      seasonHistory,
      publishMeta,
      databaseMeta: {
        ...databaseMeta,
        version: CORE_DATABASE_VERSION,
      },
    };

    const backupFile = {
      app: "BAM_LEAGUE_SYSTEM",
      version: CORE_DATABASE_VERSION,
      exportDate: new Date().toISOString(),
      data: backupData,
    };

    const blob = new Blob([JSON.stringify(backupFile, null, 2)], {
      type: "application/json;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `bam-league-full-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const restoreLeagueData = (rawData) => {
    const data =
      rawData?.data && typeof rawData.data === "object"
        ? rawData.data
        : rawData;

    setTeamCount(
      Number.isFinite(Number(data.teamCount)) && Number(data.teamCount) >= 3
        ? Number(data.teamCount)
        : defaultTeamCount,
    );
    setCompetitionType(data.competitionType === "3X3" ? "3X3" : "5X5");
    setTeamNames(
      Array.isArray(data.teamNames)
        ? data.teamNames
        : createDefaultTeamNames(defaultTeamCount),
    );
    setPlayers(Array.isArray(data.players) ? data.players : []);
    setTeams(Array.isArray(data.teams) ? data.teams : []);
    setSchedule(Array.isArray(data.schedule) ? data.schedule : []);
    setDrafts(Array.isArray(data.drafts) ? data.drafts : []);
    setMatchRosters(
      data.matchRosters && typeof data.matchRosters === "object"
        ? data.matchRosters
        : {},
    );
    setPlayerStats(
      data.playerStats && typeof data.playerStats === "object"
        ? data.playerStats
        : {},
    );
    setMatchStatInputs(
      data.matchStatInputs && typeof data.matchStatInputs === "object"
        ? data.matchStatInputs
        : {},
    );
    setTeamLogos(
      data.teamLogos && typeof data.teamLogos === "object"
        ? data.teamLogos
        : {},
    );
    setLockGroups(Array.isArray(data.lockGroups) ? data.lockGroups : []);

    if (data.seasonByType && typeof data.seasonByType === "object") {
      setSeasonByType({
        "3X3": Number(data.seasonByType["3X3"] || 1),
        "5X5": Number(data.seasonByType["5X5"] || 1),
      });
    } else {
      const legacySeason =
        Number.isFinite(Number(data.currentSeason)) &&
        Number(data.currentSeason) >= 1
          ? Number(data.currentSeason)
          : 1;

      setSeasonByType({
        "3X3": 1,
        "5X5": legacySeason,
      });
    }

    setSeasonProjectName(
      typeof data.seasonProjectName === "string" ? data.seasonProjectName : "",
    );
    setSeasonHistory(
      Array.isArray(data.seasonHistory) ? data.seasonHistory : [],
    );
    if (data.publishMeta && typeof data.publishMeta === "object") {
      setPublishMeta(data.publishMeta);
    }

    if (data.databaseMeta && typeof data.databaseMeta === "object") {
      setDatabaseMeta({
        ...data.databaseMeta,
        version: data.databaseMeta.version || CORE_DATABASE_VERSION,
      });
    }
    setSelectedLockPlayerIds([]);
    setLockGroupName("");
    setSelectedRosterMatchId("");
    setSelectedStatsMatchId("");
    setSelectedProfilePlayerId("");
    setSelectedPublicTeam("");
    setSelectedPublicPlayer(null);
    setSelectedPublicMatch(null);
  };

  const importLeagueBackup = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== "object") {
        alert("ไฟล์ Backup ไม่ถูกต้อง");
        event.target.value = "";
        return;
      }

      const backupVersion = parsed.version || parsed.data?.version || "legacy";
      const confirmImport = window.confirm(
        `การ Import Backup จะเขียนทับข้อมูลลีกปัจจุบันทั้งหมด\n\nไฟล์ Version: ${backupVersion}\n\nต้องการดำเนินการต่อไหม?`,
      );

      if (!confirmImport) {
        event.target.value = "";
        return;
      }

      restoreLeagueData(parsed);
      alert("Import All Data สำเร็จ");
    } catch (error) {
      alert("Import ไม่สำเร็จ กรุณาตรวจสอบไฟล์ .json");
    }

    event.target.value = "";
  };

  // ======================================================
  // 21.5 SAFE CLOUD PUBLISH / VALIDATION
  // ======================================================

  const getLocalDraftValidationReport = () => {
    const issues = [];
    const warnings = [];

    const duplicateBamIds = players
      .map((player) => player.bamPlayerId)
      .filter(Boolean)
      .filter((id, index, list) => list.indexOf(id) !== index);

    if (players.length === 0) {
      issues.push("ยังไม่มีผู้เล่นในระบบ");
    }

    if (players.some((player) => !player.bamPlayerId)) {
      issues.push("มีผู้เล่นที่ยังไม่มี BAM ID");
    }

    if (duplicateBamIds.length > 0) {
      issues.push(`พบ BAM ID ซ้ำ: ${[...new Set(duplicateBamIds)].join(", ")}`);
    }

    if (teams.length > 0) {
      const teamPlayerIds = new Set();
      teams.forEach((team) => {
        (team.players || []).forEach((player) =>
          teamPlayerIds.add(String(player.id)),
        );
      });

      const missingTeamNames = teams.filter(
        (team) => !String(team.name || "").trim(),
      );
      if (missingTeamNames.length > 0) {
        issues.push("มีทีมที่ยังไม่มีชื่อทีม");
      }

      const duplicateTeamNames = teams
        .map((team) => team.name)
        .filter(Boolean)
        .filter((name, index, list) => list.indexOf(name) !== index);
      if (duplicateTeamNames.length > 0) {
        issues.push(
          `พบชื่อทีมซ้ำ: ${[...new Set(duplicateTeamNames)].join(", ")}`,
        );
      }
    }

    const finishedMatches = schedule.filter(
      (match) => match.status === "Finished",
    );
    const finishedWithoutScore = finishedMatches.filter(
      (match) => match.scoreA === "" || match.scoreB === "",
    );
    if (finishedWithoutScore.length > 0) {
      issues.push(
        `มีแมตช์ Finished แต่ยังไม่มีคะแนนครบ ${finishedWithoutScore.length} รายการ`,
      );
    }

    const invalidMatchTeams = schedule.filter(
      (match) =>
        match.label === "League" &&
        (!teams.some((team) => team.name === match.teamA) ||
          !teams.some((team) => team.name === match.teamB)),
    );
    if (invalidMatchTeams.length > 0) {
      warnings.push(
        `มีแมตช์ที่ชื่อทีมไม่ตรงกับทีมปัจจุบัน ${invalidMatchTeams.length} รายการ`,
      );
    }

    if (seasonHistory.length === 0) {
      warnings.push("ยังไม่มี Season History");
    }

    const missingPhotos = players.filter((player) => !player.photoUrl).length;
    if (missingPhotos > 0) {
      warnings.push(`ผู้เล่นยังไม่มีรูป ${missingPhotos} คน`);
    }

    const checks = [
      { label: "Players", ok: players.length > 0 },
      { label: "BAM ID", ok: players.every((player) => player.bamPlayerId) },
      { label: "Duplicate ID", ok: duplicateBamIds.length === 0 },
      { label: "Finished Scores", ok: finishedWithoutScore.length === 0 },
      {
        label: "Database Version",
        ok: databaseMeta.version === CORE_DATABASE_VERSION,
      },
    ];

    const passed = checks.filter((check) => check.ok).length;
    const score = Math.round((passed / checks.length) * 100);

    return {
      passed: issues.length === 0,
      score,
      checks,
      issues,
      warnings,
      checkedAt: new Date().toISOString(),
      checkedAtText: new Date().toLocaleString(),
      summary: {
        players: players.length,
        teams: teams.length,
        schedule: schedule.length,
        finishedMatches: finishedMatches.length,
        seasonHistory: seasonHistory.length,
      },
    };
  };

  const validateLocalDraft = () => {
    const report = getLocalDraftValidationReport();

    setPublishMeta((prevMeta) => ({
      ...prevMeta,
      lastValidatedAt: report.checkedAt,
      lastValidatedText: report.checkedAtText,
      validationPassed: report.passed,
      validationScore: report.score,
      issues: report.issues,
      warnings: report.warnings,
      summary: report.summary,
    }));

    if (report.passed) {
      alert(
        `Validate Local Draft ผ่านแล้ว (${report.score}%) พร้อม Publish to Cloud`,
      );
    } else {
      alert(
        `Validate Local Draft ยังไม่ผ่าน\n\n- ${report.issues.join("\n- ")}`,
      );
    }

    return report;
  };

  const requireAdminLogin = (actionLabel) => {
    if (adminUser) return true;

    setCloudStatus("Login Required");
    alert(actionLabel + " requires Google sign-in first");
    return false;
  };

  const signInAdminWithGoogle = async () => {
    setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Admin Sign In Error:", error);
      setAuthError("Sign in failed. Please try again.");
    }
  };

  const signOutAdmin = async () => {
    setAuthError("");
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Admin Sign Out Error:", error);
      setAuthError("Sign out failed. Please try again.");
    }
  };

  const renderAdminAuthCard = () => (
    <div style={{ border: "1px solid #c7d2fe", borderRadius: "14px", padding: "14px", background: "#eef2ff" }}>
      <h3 style={{ marginTop: 0, color: "#3730a3" }}>Admin Login</h3>
      <p style={{ marginTop: 0, color: "#4338ca", fontSize: "13px" }}>
        Use Google Sign-In to get the Firebase UID for Firestore Rules Phase 2
      </p>
      {authLoading ? (
        <p style={{ color: "#555" }}>Checking login status...</p>
      ) : adminUser ? (
        <div style={{ border: "1px solid #a5b4fc", borderRadius: "12px", padding: "10px", background: "white", marginBottom: "10px", wordBreak: "break-word" }}>
          <div><strong>Name:</strong> {adminUser.displayName || "-"}</div>
          <div><strong>Email:</strong> {adminUser.email || "-"}</div>
          <div><strong>Firebase UID:</strong> {adminUser.uid}</div>
        </div>
      ) : (
        <p style={{ color: "#7c2d12", fontSize: "13px" }}>
          Not signed in: Upload / Safe Publish / Clear Cloud are disabled
        </p>
      )}
      {authError ? (
        <div style={{ color: "#b91c1c", marginBottom: "8px" }}>{authError}</div>
      ) : null}
      {adminUser ? (
        <button type="button" onClick={signOutAdmin} style={{ width: "100%", padding: "10px", border: "none", borderRadius: "8px", background: "#334155", color: "white", fontWeight: "bold", cursor: "pointer" }}>
          Sign out
        </button>
      ) : (
        <button type="button" onClick={signInAdminWithGoogle} disabled={authLoading} style={{ width: "100%", padding: "10px", border: "none", borderRadius: "8px", background: authLoading ? "#94a3b8" : "#2563eb", color: "white", fontWeight: "bold", cursor: authLoading ? "not-allowed" : "pointer" }}>
          Sign in with Google
        </button>
      )}
    </div>
  );
  const safePublishToCloud = async () => {
    if (!requireAdminLogin("Safe Publish To Cloud")) return;

    const report = getLocalDraftValidationReport();

    setPublishMeta((prevMeta) => ({
      ...prevMeta,
      lastValidatedAt: report.checkedAt,
      lastValidatedText: report.checkedAtText,
      validationPassed: report.passed,
      validationScore: report.score,
      issues: report.issues,
      warnings: report.warnings,
      summary: report.summary,
    }));

    if (!report.passed) {
      alert(
        `ยัง Publish ไม่ได้ เพราะ Validate ไม่ผ่าน\n\n- ${report.issues.join(
          "\n- ",
        )}`,
      );
      return;
    }

    const confirmPublish = window.confirm(
      `Validate ผ่านแล้ว (${report.score}%)\n\nต้องการ Publish Local Draft ขึ้น Cloud ใช่ไหม?\n\nข้อมูลบน Cloud เดิมจะถูกเขียนทับ`,
    );

    if (!confirmPublish) return;

    try {
      setCloudStatus("Publishing.");
      await uploadLeagueBackup({
        ...getAllBackupData(),
        publishMeta: {
          ...publishMeta,
          lastValidatedAt: report.checkedAt,
          lastValidatedText: report.checkedAtText,
          validationPassed: report.passed,
          validationScore: report.score,
          issues: report.issues,
          warnings: report.warnings,
          summary: report.summary,
          lastPublishedAt: new Date().toISOString(),
          lastPublishedText: new Date().toLocaleString(),
        },
      });

      setPublishMeta((prevMeta) => ({
        ...prevMeta,
        lastValidatedAt: report.checkedAt,
        lastValidatedText: report.checkedAtText,
        validationPassed: report.passed,
        validationScore: report.score,
        issues: report.issues,
        warnings: report.warnings,
        summary: report.summary,
        lastPublishedAt: new Date().toISOString(),
        lastPublishedText: new Date().toLocaleString(),
      }));

      setCloudStatus("Cloud Published");
      alert("Safe Publish to Cloud สำเร็จ");
    } catch (error) {
      console.error("Safe Publish Error:", error);
      setCloudStatus("Publish Error");
      alert("Safe Publish ไม่สำเร็จ");
    }
  };

  const renderSafeCloudPublishCard = () => {
    const isValidated = publishMeta.validationPassed;
    const statusColor = isValidated ? "#15803d" : "#b45309";

    return (
      <div
        style={{
          border: "1px solid #fed7aa",
          borderRadius: "14px",
          padding: "14px",
          background: "#fff7ed",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#c2410c" }}>
          🛡️ Safe Cloud Publish
        </h3>
        <p style={{ marginTop: 0, color: "#7c2d12", fontSize: "13px" }}>
          ใช้ระบบ Local Draft → Validate → Publish
          เพื่อป้องกันข้อมูลผิดซิงค์ขึ้น Cloud ทันที
        </p>

        <div
          style={{
            fontWeight: "bold",
            color: statusColor,
            marginBottom: "8px",
          }}
        >
          Validation: {isValidated ? "Passed" : "Not Passed / Not Checked"}
          {publishMeta.validationScore
            ? ` (${publishMeta.validationScore}%)`
            : ""}
        </div>

        <div
          style={{ fontSize: "12px", color: "#7c2d12", marginBottom: "10px" }}
        >
          Last Validated: {publishMeta.lastValidatedText || "-"}
          <br />
          Last Published: {publishMeta.lastPublishedText || "-"}
        </div>

        {Array.isArray(publishMeta.issues) && publishMeta.issues.length > 0 ? (
          <div
            style={{ marginBottom: "10px", color: "#991b1b", fontSize: "12px" }}
          >
            <strong>Issues</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
              {publishMeta.issues.map((issue, index) => (
                <li key={`${issue}-${index}`}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {Array.isArray(publishMeta.warnings) &&
        publishMeta.warnings.length > 0 ? (
          <div
            style={{ marginBottom: "10px", color: "#92400e", fontSize: "12px" }}
          >
            <strong>Warnings</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
              {publishMeta.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          onClick={validateLocalDraft}
          style={{
            width: "100%",
            padding: "10px",
            border: "none",
            borderRadius: "8px",
            background: "#f97316",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: "8px",
          }}
        >
          ✅ Validate Local Draft
        </button>

        <button
          type="button"
          onClick={safePublishToCloud}
          disabled={!isValidated || !adminUser || authLoading}
          style={{
            width: "100%",
            padding: "10px",
            border: "none",
            borderRadius: "8px",
            background:
              isValidated && adminUser && !authLoading ? "#15803d" : "#94a3b8",
            color: "white",
            fontWeight: "bold",
            cursor:
              isValidated && adminUser && !authLoading ? "pointer" : "not-allowed",
          }}
        >
          🚀 Publish Validated Draft To Cloud
        </button>
      </div>
    );
  };

  // ======================================================
  // 22. CLOUD BACKUP / RESTORE
  // ======================================================

  const getAllBackupData = () => ({
    competitionType,
    teamCount,
    teamNames,
    players,
    teams,
    schedule,
    drafts,
    matchRosters,
    playerStats,
    matchStatInputs,
    teamLogos,
    lockGroups,
    seasonByType,
    currentSeason,
    seasonProjectName,
    seasonHistory,
    publishMeta,
    databaseMeta: {
      ...databaseMeta,
      version: CORE_DATABASE_VERSION,
    },
  });

  const uploadToCloud = async () => {
    if (!requireAdminLogin("Upload To Cloud")) return;

    const confirmUpload = window.confirm(
      "ต้องการ Upload ข้อมูล BAM League ปัจจุบันขึ้น Cloud ใช่ไหม?\n\nข้อมูลบน Cloud เดิมจะถูกเขียนทับ",
    );

    if (!confirmUpload) return;

    try {
      setCloudStatus("Uploading.");
      await uploadLeagueBackup(getAllBackupData());
      setCloudStatus("Cloud Uploaded");
      alert("Upload To Cloud สำเร็จ");
    } catch (error) {
      console.error("Upload To Cloud Error:", error);
      setCloudStatus("Cloud Error");
      alert("Upload To Cloud ไม่สำเร็จ");
    }
  };

  const downloadFromCloud = async () => {
    const confirmDownload = window.confirm(
      "ต้องการ Download ข้อมูลจาก Cloud ใช่ไหม?\n\nข้อมูลในเครื่องปัจจุบันจะถูกเขียนทับ",
    );

    if (!confirmDownload) return;

    try {
      setCloudStatus("Downloading.");
      const cloudData = await downloadLeagueBackup();

      if (!cloudData) {
        setCloudStatus("No Cloud Data");
        alert("ยังไม่มีข้อมูล BAM League บน Cloud");
        return;
      }

      restoreLeagueData(cloudData);
      setCloudStatus("Cloud Downloaded");
      alert("Download From Cloud สำเร็จ");
    } catch (error) {
      console.error("Download From Cloud Error:", error);
      setCloudStatus("Cloud Error");
      alert("Download From Cloud ไม่สำเร็จ กรุณาตรวจสอบ Firebase / Firestore");
    }
  };

  const clearCloudData = async () => {
    if (!requireAdminLogin("Clear Cloud Data")) return;

    const firstConfirm = window.confirm(
      "ต้องการลบข้อมูล BAM League บน Cloud ใช่ไหม?\n\nข้อมูลในเครื่องจะไม่ถูกลบ",
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "ยืนยันอีกครั้ง: ข้อมูลบน Cloud จะถูกลบ และไม่สามารถกู้คืนจาก Cloud ได้ ต้องการดำเนินการต่อไหม?",
    );

    if (!secondConfirm) return;

    try {
      setCloudStatus("Clearing.");
      await clearLeagueBackup();
      setCloudStatus("Cloud Cleared");
      alert("ลบข้อมูลบน Cloud สำเร็จ");
    } catch (error) {
      console.error("Clear Cloud Error:", error);
      setCloudStatus("Cloud Error");
      alert("ลบข้อมูลบน Cloud ไม่สำเร็จ");
    }
  };

  const clearCurrentProject = () => {
    const confirmClear = window.confirm(
      "ต้องการล้างโปรเจค/ซีซั่นปัจจุบันใช่ไหม?\n\nระบบจะล้าง Teams, Schedule, Drafts, Match Roster และ Stats\nแต่จะเก็บ Players, รูปผู้เล่น, โลโก้ทีม, Season History และการตั้งค่า Season ไว้",
    );

    if (!confirmClear) return;

    setTeams([]);
    setSchedule([]);
    setDrafts([]);
    setMatchRosters({});
    setPlayerStats({});
    setMatchStatInputs({});
    setSelectedRosterMatchId("");
    setSelectedStatsMatchId("");
    setSelectedProfilePlayerId("");
    setSelectedPublicTeam("");
    setSelectedPublicPlayer(null);
    setSelectedPublicMatch(null);
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => ({
        ...player,
        teamName: "",
      })),
    );

    [
      "teams",
      "schedule",
      "drafts",
      "matchRosters",
      "playerStats",
      "matchStatInputs",
    ].forEach((key) => localStorage.removeItem(key));

    alert(
      "ล้างโปรเจคปัจจุบันเรียบร้อย โดยยังเก็บรายชื่อผู้เล่นและประวัติ Season ไว้",
    );
  };

  const resetLeagueData = () => {
    if (
      !window.confirm(
        "ต้องการล้างข้อมูลลีกทั้งหมดใช่ไหม? การกระทำนี้ย้อนกลับไม่ได้",
      )
    )
      return;

    setTeamCount(defaultTeamCount);
    setCompetitionType("5X5");
    setPlayers([]);
    setTeams([]);
    setSchedule([]);
    setDrafts([]);
    setMatchRosters({});
    setPlayerStats({});
    setMatchStatInputs({});
    setTeamNames(createDefaultTeamNames(defaultTeamCount));
    setTeamLogos({});
    setLockGroups([]);
    setSeasonProjectName("");
    setSelectedLockPlayerIds([]);
    setLockGroupName("");
    setSelectedRosterMatchId("");
    setSelectedStatsMatchId("");
    setSelectedProfilePlayerId("");
    resetForm();

    localStorage.removeItem("teamCount");
    localStorage.removeItem("competitionType");
    localStorage.removeItem("players");
    localStorage.removeItem("teams");
    localStorage.removeItem("schedule");
    localStorage.removeItem("drafts");
    localStorage.removeItem("teamNames");
    localStorage.removeItem("matchRosters");
    localStorage.removeItem("playerStats");
    localStorage.removeItem("matchStatInputs");
    localStorage.removeItem("teamLogos");
    localStorage.removeItem("lockGroups");
    localStorage.removeItem("seasonProjectName");
  };

  const resetAllSystem = () => {
    const confirmReset = window.confirm(
      "⚠️ RESET ALL SYSTEM\n\nจะลบข้อมูลทั้งหมดของ BAM League ได้แก่:\n- Players\n- Teams\n- Schedule\n- Drafts\n- Match Roster\n- Player Stats\n- Team Names\n- League Settings\n\nการกระทำนี้ย้อนกลับไม่ได้\n\nต้องการดำเนินการต่อหรือไม่?",
    );

    if (!confirmReset) return;

    setTeamCount(defaultTeamCount);
    setCompetitionType("5X5");
    setTeamNames(createDefaultTeamNames(defaultTeamCount));
    setTeamLogos({});
    setLockGroups([]);
    setSelectedLockPlayerIds([]);
    setLockGroupName("");
    setSeasonByType({ "3X3": 1, "5X5": 1 });
    setSeasonProjectName("");
    setSeasonHistory([]);
    setPlayers([]);
    setTeams([]);
    setSchedule([]);
    setDrafts([]);
    setMatchRosters({});
    setPlayerStats({});
    setMatchStatInputs({});
    setSelectedRosterMatchId("");
    setSelectedStatsMatchId("");
    setSelectedProfilePlayerId("");
    resetForm();

    [
      "teamCount",
      "competitionType",
      "players",
      "teams",
      "schedule",
      "drafts",
      "teamNames",
      "matchRosters",
      "playerStats",
      "matchStatInputs",
      "teamLogos",
      "lockGroups",
      "seasonByType",
      "currentSeason",
      "seasonProjectName",
      "seasonHistory",
    ].forEach((key) => localStorage.removeItem(key));

    alert("ล้างข้อมูลทั้งหมดเรียบร้อย พร้อมเริ่มโปรเจคใหม่");
    window.location.reload();
  };

  const standings = calculateStandings();
  const selectedRosterMatch = schedule.find(
    (match) => String(match.id) === String(selectedRosterMatchId),
  );
  const selectedStatsMatch = schedule.find(
    (match) => String(match.id) === String(selectedStatsMatchId),
  );

  const statLeaderBoards = [
    {
      title: "Top Scorer",
      field: "pts",
      label: "PTS",
      leaders: getStatLeaders("pts"),
    },
    {
      title: "Top Rebound",
      field: "reb",
      label: "REB",
      leaders: getStatLeaders("reb"),
    },
    {
      title: "Top Assist",
      field: "ast",
      label: "AST",
      leaders: getStatLeaders("ast"),
    },
    {
      title: "Top Steal",
      field: "stl",
      label: "STL",
      leaders: getStatLeaders("stl"),
    },
    {
      title: "Top Block",
      field: "blk",
      label: "BLK",
      leaders: getStatLeaders("blk"),
    },
  ];
  const getTeamDashboardData = () => {
    const playerRows = getPlayerStatRows();

    return teams
      .map((team) => {
        const standing = standings.find((row) => row.team === team.name) || {
          played: 0,
          win: 0,
          loss: 0,
          pf: 0,
          pa: 0,
          diff: 0,
        };

        const gp = Number(standing.played || 0);
        const win = Number(standing.win || 0);
        const loss = Number(standing.loss || 0);
        const pf = Number(standing.pf || 0);
        const pa = Number(standing.pa || 0);
        const diff = Number(standing.diff || 0);
        const winPct = gp > 0 ? ((win / gp) * 100).toFixed(1) : "0.0";
        const ppg = gp > 0 ? (pf / gp).toFixed(1) : "0.0";
        const papg = gp > 0 ? (pa / gp).toFixed(1) : "0.0";

        const teamPlayerIds = (team.players || []).map((player) =>
          String(player.id),
        );

        const teamStats = playerRows.filter((stat) => {
          const statPlayerId = String(stat.playerId);
          return (
            teamPlayerIds.includes(statPlayerId) || stat.teamName === team.name
          );
        });

        const topScorer = [...teamStats].sort(
          (a, b) => Number(b.pts || 0) - Number(a.pts || 0),
        )[0];

        const teamMvp = [...teamStats].sort(
          (a, b) => Number(b.mvpScore || 0) - Number(a.mvpScore || 0),
        )[0];

        const totalMvpScore = teamStats.reduce(
          (sum, stat) => sum + Number(stat.mvpScore || 0),
          0,
        );

        const powerScore = win * 100 + diff + totalMvpScore * 0.05;

        return {
          teamName: team.name,
          rosterCount: (team.players || []).length,
          gp,
          win,
          loss,
          pf,
          pa,
          diff,
          winPct,
          ppg,
          papg,
          topScorer,
          teamMvp,
          powerScore,
        };
      })
      .sort((a, b) => {
        if (Number(b.winPct) !== Number(a.winPct)) {
          return Number(b.winPct) - Number(a.winPct);
        }
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.powerScore - a.powerScore;
      });
  };

  const getFinishedMatchWinnerLoser = (match) => {
    if (!match || match.status !== "Finished") return null;
    if (match.scoreA === "" || match.scoreB === "") return null;

    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);

    if (scoreA === scoreB) {
      return {
        winner: "Tie",
        loser: "Tie",
        score: `${scoreA}-${scoreB}`,
      };
    }

    return {
      winner: scoreA > scoreB ? match.teamA : match.teamB,
      loser: scoreA > scoreB ? match.teamB : match.teamA,
      score: `${scoreA}-${scoreB}`,
    };
  };

  const getSeasonTeamAwards = () => {
    const finalMatch = schedule.find(
      (match) =>
        match.playoffType === "final" || match.playoffType === "final_1v2",
    );
    const thirdPlaceMatch = schedule.find(
      (match) => match.playoffType === "third_place",
    );

    const finalResult = getFinishedMatchWinnerLoser(finalMatch);
    const thirdPlaceResult = getFinishedMatchWinnerLoser(thirdPlaceMatch);

    return {
      champion: finalResult?.winner || "-",
      runnerUp: finalResult?.loser || "-",
      thirdPlace: thirdPlaceResult?.winner || "-",
      finalScore: finalResult?.score || "-",
      thirdPlaceScore: thirdPlaceResult?.score || "-",
      finalFinished: Boolean(finalResult),
      thirdPlaceFinished: Boolean(thirdPlaceResult),
    };
  };

  const getSeasonAwards = () => {
    const regularSeasonMvp = getRegularSeasonMvp();
    const finalsMvp = getSelectedFinalsMvp();
    const topScorer = getStatLeaders("pts")[0];
    const reboundLeader = getStatLeaders("reb")[0];
    const assistLeader = getStatLeaders("ast")[0];
    const stealLeader = getStatLeaders("stl")[0];
    const blockLeader = getStatLeaders("blk")[0];
    const teamAwards = getSeasonTeamAwards();

    return {
      ...teamAwards,
      regularSeasonMvp,
      finalsMvp,
      // Backward compatible alias for old MVP displays/exports.
      mvp: regularSeasonMvp,
      topScorer,
      reboundLeader,
      assistLeader,
      stealLeader,
      blockLeader,
    };
  };

  const getHallOfFameData = () => {
    const isValidValue = (value) => {
      const text = String(value || "").trim();
      return text && text !== "-" && text.toLowerCase() !== "unknown";
    };

    const filteredHistory =
      hallOfFameFilter === "ALL"
        ? seasonHistory
        : seasonHistory.filter(
            (season) => (season.competitionType || "5X5") === hallOfFameFilter,
          );

    const countMap = (field, fallbackField = "") => {
      const result = {};

      filteredHistory.forEach((season) => {
        const value =
          season[field] || (fallbackField ? season[fallbackField] : "");
        if (!isValidValue(value)) return;
        result[value] = (result[value] || 0) + 1;
      });

      return Object.entries(result)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.name.localeCompare(b.name);
        });
    };

    return {
      champions: countMap("champion"),
      runnerUps: countMap("runnerUp"),
      thirdPlaces: countMap("thirdPlace"),
      regularSeasonMvps: countMap("regularSeasonMvp", "mvp"),
      finalsMvps: countMap("finalsMvp"),
      mvps: countMap("regularSeasonMvp", "mvp"),
      topScorers: countMap("topScorer"),
      reboundLeaders: countMap("reboundLeader"),
      assistLeaders: countMap("assistLeader"),
    };
  };

  const renderHallOfFameList = (items, emptyText = "ยังไม่มีข้อมูล") => {
    if (!items || items.length === 0) {
      return <p style={{ color: "#777" }}>{emptyText}</p>;
    }

    return (
      <ol style={{ margin: 0, paddingLeft: "20px" }}>
        {items.map((item) => (
          <li key={item.name} style={{ marginBottom: "6px" }}>
            <strong>{item.name}</strong> x{item.count}
          </li>
        ))}
      </ol>
    );
  };

  // ======================================================
  // 28. PLAYER CAREER ENGINE V1
  // NOTE: BAM changes teams every year, so Career is player-first.
  // Franchise History and Coach Career are intentionally excluded.
  // Season History remains the source of truth; Career is rebuilt from it.
  // ======================================================

  const isValidAwardValue = (value) => {
    const text = String(value || "").trim();
    return text && text !== "-" && text.toLowerCase() !== "unknown";
  };

  const getCareerPlayerKey = (name) =>
    String(name || "")
      .trim()
      .toLowerCase();

  const getOrCreateCareerPlayer = (careerMap, playerName) => {
    const name = String(playerName || "").trim();
    if (!isValidAwardValue(name)) return null;

    const identity = getPlayerIdentityFromName(name);
    const key = identity.bamPlayerId || identity.key;
    if (!careerMap[key]) {
      careerMap[key] = {
        key,
        bamPlayerId: identity.bamPlayerId || "",
        playerName: identity.playerName || name,
        seasons: [],
        awards: {
          champion: { total: 0, "3X3": 0, "5X5": 0 },
          regularSeasonMvp: { total: 0, "3X3": 0, "5X5": 0 },
          finalsMvp: { total: 0, "3X3": 0, "5X5": 0 },
          topScorer: { total: 0, "3X3": 0, "5X5": 0 },
          reboundLeader: { total: 0, "3X3": 0, "5X5": 0 },
          assistLeader: { total: 0, "3X3": 0, "5X5": 0 },
        },
        stats: {
          games: 0,
          appearances: 0,
          pts: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
        },
        legacyScore: 0,
      };
    }

    return careerMap[key];
  };

  const addCareerAward = (careerMap, playerName, awardKey, seasonRecord) => {
    const player = getOrCreateCareerPlayer(careerMap, playerName);
    if (!player || !player.awards[awardKey]) return;

    const type = seasonRecord.competitionType === "3X3" ? "3X3" : "5X5";
    const seasonTitle = getSeasonHistoryTitle(seasonRecord);

    player.awards[awardKey].total += 1;
    player.awards[awardKey][type] += 1;
    player.seasons.push({
      seasonId: seasonRecord.id,
      seasonTitle,
      competitionType: type,
      season: seasonRecord.season || 1,
      award: awardKey,
    });
  };

  const addCareerStats = (careerMap, statRow, seasonRecord) => {
    const playerName = statRow.playerName || statRow.name;
    const player = getOrCreateCareerPlayer(careerMap, playerName);
    if (!player) return;

    player.stats.games += Number(statRow.games || 0);
    player.stats.appearances += Number(statRow.appearances || 0);
    player.stats.pts += Number(statRow.pts || 0);
    player.stats.reb += Number(statRow.reb || 0);
    player.stats.ast += Number(statRow.ast || 0);
    player.stats.stl += Number(statRow.stl || 0);
    player.stats.blk += Number(statRow.blk || 0);

    const seasonTitle = getSeasonHistoryTitle(seasonRecord);
    const type = seasonRecord.competitionType === "3X3" ? "3X3" : "5X5";
    const alreadyLoggedStats = player.seasons.some(
      (item) => item.seasonId === seasonRecord.id && item.award === "played",
    );

    if (!alreadyLoggedStats) {
      player.seasons.push({
        seasonId: seasonRecord.id,
        seasonTitle,
        competitionType: type,
        season: seasonRecord.season || 1,
        award: "played",
      });
    }
  };

  const buildPlayerCareerData = () => {
    const filteredHistory =
      hallOfFameFilter === "ALL"
        ? seasonHistory
        : seasonHistory.filter(
            (season) => (season.competitionType || "5X5") === hallOfFameFilter,
          );

    const careerMap = {};

    filteredHistory.forEach((seasonRecord) => {
      const regularSeasonMvp =
        seasonRecord.regularSeasonMvp || seasonRecord.mvp;
      const championTeam = seasonRecord.champion;
      const archivedTeams = seasonRecord.archivedData?.teams || [];
      const championRoster =
        archivedTeams.find((team) => team.name === championTeam)?.players || [];
      const archivedStats = Object.values(
        seasonRecord.archivedData?.playerStats || {},
      );

      championRoster.forEach((player) => {
        addCareerAward(careerMap, player.name, "champion", seasonRecord);
      });

      if (isValidAwardValue(regularSeasonMvp)) {
        addCareerAward(
          careerMap,
          regularSeasonMvp,
          "regularSeasonMvp",
          seasonRecord,
        );
      }

      if (isValidAwardValue(seasonRecord.finalsMvp)) {
        addCareerAward(
          careerMap,
          seasonRecord.finalsMvp,
          "finalsMvp",
          seasonRecord,
        );
      }

      if (isValidAwardValue(seasonRecord.topScorer)) {
        addCareerAward(
          careerMap,
          seasonRecord.topScorer,
          "topScorer",
          seasonRecord,
        );
      }

      if (isValidAwardValue(seasonRecord.reboundLeader)) {
        addCareerAward(
          careerMap,
          seasonRecord.reboundLeader,
          "reboundLeader",
          seasonRecord,
        );
      }

      if (isValidAwardValue(seasonRecord.assistLeader)) {
        addCareerAward(
          careerMap,
          seasonRecord.assistLeader,
          "assistLeader",
          seasonRecord,
        );
      }

      archivedStats.forEach((statRow) => {
        addCareerStats(careerMap, statRow, seasonRecord);
      });
    });

    return Object.values(careerMap)
      .map((career) => {
        const awardScore =
          career.awards.champion.total * 10 +
          career.awards.regularSeasonMvp.total * 8 +
          career.awards.finalsMvp.total * 8 +
          career.awards.topScorer.total * 5 +
          career.awards.reboundLeader.total * 3 +
          career.awards.assistLeader.total * 3;
        const statScore =
          Number(career.stats.pts || 0) / 50 +
          Number(career.stats.reb || 0) / 75 +
          Number(career.stats.ast || 0) / 75 +
          Number(career.stats.appearances || 0) * 0.4;
        const ppg =
          Number(career.stats.appearances || 0) > 0
            ? (
                Number(career.stats.pts || 0) / Number(career.stats.appearances)
              ).toFixed(1)
            : "0.0";

        return {
          ...career,
          ppg,
          totalAwards:
            career.awards.champion.total +
            career.awards.regularSeasonMvp.total +
            career.awards.finalsMvp.total +
            career.awards.topScorer.total +
            career.awards.reboundLeader.total +
            career.awards.assistLeader.total,
          legacyScore: Number((awardScore + statScore).toFixed(1)),
          seasonCount: new Set(career.seasons.map((item) => item.seasonId))
            .size,
        };
      })
      .sort((a, b) => {
        if (b.legacyScore !== a.legacyScore)
          return b.legacyScore - a.legacyScore;
        if (b.totalAwards !== a.totalAwards)
          return b.totalAwards - a.totalAwards;
        return a.playerName.localeCompare(b.playerName);
      });
  };

  const getCareerLeaderRows = (careerRows, field, limit = 5) =>
    [...careerRows]
      .sort((a, b) => {
        const aValue = Number(a.stats?.[field] || 0);
        const bValue = Number(b.stats?.[field] || 0);
        if (bValue !== aValue) return bValue - aValue;
        return b.legacyScore - a.legacyScore;
      })
      .filter((row) => Number(row.stats?.[field] || 0) > 0)
      .slice(0, limit);

  const renderCareerBadge = (icon, label, count) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        border: "1px solid #e2e8f0",
        borderRadius: "999px",
        padding: "4px 8px",
        background: "#f8fafc",
        fontSize: "12px",
      }}
    >
      {icon} {label} x{count || 0}
    </span>
  );

  const renderCareerLeaderList = (rows, field, suffix = "") => {
    if (!rows || rows.length === 0) {
      return <p style={{ color: "#777" }}>ยังไม่มีข้อมูลสะสม</p>;
    }

    return (
      <ol style={{ margin: 0, paddingLeft: "20px" }}>
        {rows.map((career) => (
          <li key={`${field}-${career.key}`} style={{ marginBottom: "6px" }}>
            <strong>{career.playerName}</strong> — {career.stats[field] || 0}
            {suffix}
          </li>
        ))}
      </ol>
    );
  };

  const renderAwardPlayer = (player, valueLabel, value) => {
    if (!player) return <span>-</span>;

    return (
      <button
        onClick={() => setSelectedProfilePlayerId(String(player.playerId))}
        style={{ cursor: "pointer" }}
      >
        {renderPlayerAvatar(getPlayerPhotoUrl(player.playerId), 34)}{" "}
        {player.playerName} {player.teamName ? `(${player.teamName})` : ""}
        {valueLabel ? ` / ${valueLabel}: ${value}` : ""}
      </button>
    );
  };

  const getPublicDashboardSummary = () => {
    const awards = getSeasonAwards();
    const statRows = getPlayerStatRows();
    const finishedMatches = schedule.filter(
      (match) => match.status === "Finished",
    ).length;
    const totalMatches = schedule.length;
    const availablePlayers = players.filter(
      (player) => player.available,
    ).length;
    const balance = teams.length > 0 ? getBalancePercent() : "0.0";

    return {
      awards,
      statRows,
      finishedMatches,
      totalMatches,
      availablePlayers,
      balance,
      topTeams: standings.slice(0, 4),
      topScorers: getTopScorers().slice(0, 5),
      mvpRace: getMVPRanking().slice(0, 5),
    };
  };

  const renderDashboardStatCard = (label, value, subText = "", onClick) => {
    const cardClassName = `bam-public-summary-card ${
      onClick
        ? "bam-public-stat-card-button bam-public-summary-card-button"
        : "bam-public-summary-card-static"
    }`;
    const content = (
      <>
        <div className="bam-public-summary-label">{label}</div>
        <div className="bam-public-summary-value">{value}</div>
        {subText ? (
          <div className="bam-public-summary-subtext">{subText}</div>
        ) : null}
      </>
    );

    if (!onClick) {
      return <div className={cardClassName}>{content}</div>;
    }

    return (
      <button type="button" onClick={onClick} className={cardClassName}>
        {content}
      </button>
    );
  };

  const renderPublicPlayerRow = (
    player,
    index,
    valueText,
    onOpenProfile = null,
  ) => {
    const playerIdentity = (
      <>
        <strong>#{index + 1}</strong>
        {renderPlayerAvatar(getPlayerPhotoUrl(player.playerId), 34)}
        <span>
          <strong>{player.playerName}</strong>
          <br />
          <span className="bam-public-leader-team">
            {player.teamName || "-"}
          </span>
        </span>
      </>
    );

    return (
      <div
        key={`${player.playerId || player.playerName}-${index}`}
        className="bam-public-leader-row"
      >
        {onOpenProfile ? (
          <button
            type="button"
            onClick={onOpenProfile}
            className="bam-public-player-link"
          >
            {playerIdentity}
          </button>
        ) : (
          <span className="bam-public-leader-identity">
            {playerIdentity}
          </span>
        )}
        <strong className="bam-public-leader-value">{valueText}</strong>
      </div>
    );
  };

  // ======================================================
  // 23. RENDER: PUBLIC DASHBOARD
  // ======================================================

  const renderPublicDashboard = () => {
    const selectedHistorySeason =
      publicSeasonId === "CURRENT"
        ? null
        : seasonHistory.find(
            (season) => String(season.id) === String(publicSeasonId),
          );

    const isHistoryView = Boolean(selectedHistorySeason);
    const archivedData = selectedHistorySeason?.archivedData || {};

    const dashboardTeams = isHistoryView ? archivedData.teams || [] : teams;
    const dashboardPlayers = isHistoryView
      ? archivedData.players || []
      : players;
    const dashboardSchedule = isHistoryView
      ? archivedData.schedule || []
      : schedule;
    const dashboardTeamLogos = isHistoryView
      ? archivedData.teamLogos || {}
      : teamLogos;
    const dashboardStandings = isHistoryView
      ? selectedHistorySeason?.standings || archivedData.standings || []
      : standings;

    const dashboardCompetitionType = isHistoryView
      ? selectedHistorySeason?.competitionType ||
        archivedData.competitionType ||
        competitionType
      : competitionType;
    const dashboardSeason = isHistoryView
      ? selectedHistorySeason?.season || archivedData.season || currentSeason
      : currentSeason;
    const dashboardTitle = isHistoryView
      ? selectedHistorySeason?.projectName ||
        archivedData.projectName ||
        `${dashboardCompetitionType} Season ${dashboardSeason}`
      : getCurrentSeasonTitle();

    const dashboardFinishedMatches = dashboardSchedule.filter(
      (match) => match.status === "Finished",
    ).length;
    const dashboardAvailablePlayers = dashboardPlayers.filter(
      (player) => player.available !== false,
    ).length;

    const getArchivedStatRows = (statsObject = {}) => {
      return Object.values(statsObject || {})
        .filter((stat) => Number(stat.games || 0) > 0)
        .map((stat) => {
          const appearances = Number(stat.appearances || 0);
          const pts = Number(stat.pts || 0);
          const reb = Number(stat.reb || 0);
          const ast = Number(stat.ast || 0);
          const stl = Number(stat.stl || 0);
          const blk = Number(stat.blk || 0);
          const ppg = appearances > 0 ? (pts / appearances).toFixed(1) : "0.0";
          const mvpScore =
            Number(stat.mvpScore || 0) ||
            pts +
              reb * 1.2 +
              ast * 1.5 +
              stl * 2 +
              blk * 2 +
              appearances * 0.75;

          return {
            ...stat,
            appearances,
            pts,
            reb,
            ast,
            stl,
            blk,
            ppg,
            mvpScore,
          };
        });
    };

    const archivedStatRows = getArchivedStatRows(archivedData.playerStats);
    const dashboardPlayerStatRows = isHistoryView
      ? archivedStatRows
      : getPlayerStatRows();

    const getDashboardPlayerStatRow = (playerId) => {
      return dashboardPlayerStatRows.find(
        (row) => String(row.playerId) === String(playerId),
      );
    };

    const normalizePublicPlayerName = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const resolvePublicProfileTarget = (stat) => {
      if (!stat?.playerId) return null;

      if (!isHistoryView) {
        return {
          currentPlayerId: String(stat.playerId),
          archivedPlayerId: "",
          isHistorical: false,
        };
      }

      const bamPlayerId = String(stat.bamPlayerId || "").trim();
      if (bamPlayerId) {
        const currentPlayerByBamId = players.find(
          (player) => String(player.bamPlayerId || "") === bamPlayerId,
        );

        if (currentPlayerByBamId) {
          return {
            currentPlayerId: String(currentPlayerByBamId.id),
            archivedPlayerId: String(stat.playerId),
            isHistorical: true,
          };
        }
      }

      const legacyPlayerId = String(stat.playerId || "").trim();
      if (legacyPlayerId) {
        const currentPlayerByLegacyId = players.find(
          (player) => String(player.id) === legacyPlayerId,
        );

        if (currentPlayerByLegacyId) {
          return {
            currentPlayerId: String(currentPlayerByLegacyId.id),
            archivedPlayerId: legacyPlayerId,
            isHistorical: true,
          };
        }

        const archivedPlayer = dashboardPlayers.find(
          (player) => String(player.id) === legacyPlayerId,
        );
        const archivedBamPlayerId = String(
          archivedPlayer?.bamPlayerId || "",
        ).trim();

        if (archivedBamPlayerId) {
          const currentPlayerByArchivedBamId = players.find(
            (player) =>
              String(player.bamPlayerId || "") === archivedBamPlayerId,
          );

          if (currentPlayerByArchivedBamId) {
            return {
              currentPlayerId: String(currentPlayerByArchivedBamId.id),
              archivedPlayerId: legacyPlayerId,
              isHistorical: true,
            };
          }
        }
      }

      const normalizedName = normalizePublicPlayerName(
        stat.playerName || stat.name,
      );
      if (!normalizedName) return null;

      const currentNameMatches = players.filter(
        (player) => normalizePublicPlayerName(player.name) === normalizedName,
      );

      return currentNameMatches.length === 1
        ? {
            currentPlayerId: String(currentNameMatches[0].id),
            archivedPlayerId: String(stat.playerId),
            isHistorical: true,
          }
        : null;
    };

    const openPublicPlayerProfile = (stat) => {
      const target = resolvePublicProfileTarget(stat);
      if (!target?.currentPlayerId) return;

      if (!target.isHistorical) {
        setPublicProfileSeasonContext(null);
        setProfileCardView("current");
        setSelectedProfilePlayerId(target.currentPlayerId);
        return;
      }

      setPublicProfileSeasonContext({
        mode: "history",
        seasonId: String(selectedHistorySeason.id),
        seasonTitle: dashboardTitle,
        archivedPlayerId: target.archivedPlayerId,
        currentPlayerId: target.currentPlayerId,
      });
      setProfileCardView("selectedSeason");
      setSelectedProfilePlayerId(target.currentPlayerId);
    };

    const openPublicRosterPlayerProfile = (player) => {
      openPublicPlayerProfile({
        playerId: player.id,
        bamPlayerId: player.bamPlayerId,
        playerName: player.name,
        name: player.name,
        teamName: player.teamName,
      });
    };

    const getDashboardPlayerStats = (playerId) => {
      const stat = getDashboardPlayerStatRow(playerId);

      return {
        games: stat ? Number(stat.appearances || stat.games || 0) : 0,
        pts: stat ? Number(stat.pts || 0) : 0,
        reb: stat ? Number(stat.reb || 0) : 0,
        ast: stat ? Number(stat.ast || 0) : 0,
        stl: stat ? Number(stat.stl || 0) : 0,
        blk: stat ? Number(stat.blk || 0) : 0,
        ppg: stat ? String(stat.ppg || "0.0") : "0.0",
        mvpScore: stat ? Number(stat.mvpScore || 0).toFixed(1) : "-",
        scoring: stat ? Number(stat.pts || 0) : "-",
        raw: stat || null,
      };
    };

    const getDashboardPlayerMatchLog = (playerId) => {
      const stat = getDashboardPlayerStatRow(playerId);
      if (!stat || !stat.gamesByMatch) return [];

      return Object.values(stat.gamesByMatch)
        .map((game) => {
          const match = dashboardSchedule.find(
            (item) => String(item.id) === String(game.matchId),
          );

          const opponent =
            game.opponent ||
            (match
              ? game.matchTeam === match.teamA
                ? match.teamB
                : match.teamA
              : "-");

          return {
            ...game,
            week: game.week || match?.week || "-",
            label: match?.label || "League",
            opponent,
            status: match?.status || "Pending",
            score:
              match && match.scoreA !== "" && match.scoreB !== ""
                ? `${match.scoreA}-${match.scoreB}`
                : "-",
            pts: Number(game.pts || 0),
            reb: Number(game.reb || 0),
            ast: Number(game.ast || 0),
            stl: Number(game.stl || 0),
            blk: Number(game.blk || 0),
          };
        })
        .sort((a, b) => Number(a.week || 0) - Number(b.week || 0));
    };

    const getDashboardPlayerCareerAwards = (playerName) => {
      const result = {
        champion: { "3X3": 0, "5X5": 0 },
        regularSeasonMvp: { "3X3": 0, "5X5": 0 },
        finalsMvp: { "3X3": 0, "5X5": 0 },
        mvp: { "3X3": 0, "5X5": 0 },
        topScorer: { "3X3": 0, "5X5": 0 },
      };

      seasonHistory.forEach((season) => {
        const type = season.competitionType === "3X3" ? "3X3" : "5X5";

        if ((season.regularSeasonMvp || season.mvp) === playerName) {
          result.regularSeasonMvp[type] += 1;
          result.mvp[type] += 1;
        }

        if (season.finalsMvp === playerName) {
          result.finalsMvp[type] += 1;
        }

        if (season.topScorer === playerName) {
          result.topScorer[type] += 1;
        }

        const championTeam = season.champion;
        const seasonTeams = season.archivedData?.teams || [];
        const championRoster =
          seasonTeams.find((team) => team.name === championTeam)?.players || [];

        if (championRoster.some((player) => player.name === playerName)) {
          result.champion[type] += 1;
        }
      });

      return result;
    };

    const renderSplitAwardCard = (icon, label, counts) => {
      const count3x3 = counts?.["3X3"] || 0;
      const count5x5 = counts?.["5X5"] || 0;
      const total = count3x3 + count5x5;

      return (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: "14px",
            padding: "12px",
          }}
        >
          <div style={{ fontWeight: "700", marginBottom: "8px" }}>
            {icon} {label} x{total}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              color: "#555",
              fontSize: "13px",
            }}
          >
            <span
              style={{
                background: "#f5f5f5",
                borderRadius: "999px",
                padding: "4px 8px",
              }}
            >
              3X3 x{count3x3}
            </span>
            <span
              style={{
                background: "#f5f5f5",
                borderRadius: "999px",
                padding: "4px 8px",
              }}
            >
              5X5 x{count5x5}
            </span>
          </div>
        </div>
      );
    };

    const dashboardTopScorers = isHistoryView
      ? archivedStatRows
          .filter((stat) => Number(stat.pts || 0) > 0)
          .sort((a, b) => Number(b.pts || 0) - Number(a.pts || 0))
          .slice(0, 5)
      : getTopScorers().slice(0, 5);
    const dashboardMvpRace = isHistoryView
      ? archivedStatRows
          .filter((stat) => Number(stat.mvpScore || 0) > 0)
          .sort((a, b) => Number(b.mvpScore || 0) - Number(a.mvpScore || 0))
          .slice(0, 5)
      : getMVPRanking().slice(0, 5);

    const currentAwards = getSeasonAwards();
    const getDashboardStatLeader = (field) => {
      const rows = isHistoryView ? archivedStatRows : getPlayerStatRows();

      return rows
        .filter((stat) => Number(stat[field] || 0) > 0)
        .sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0))[0];
    };

    const getDashboardDefenseLeader = () => {
      const rows = isHistoryView ? archivedStatRows : getPlayerStatRows();

      return rows
        .map((stat) => ({
          ...stat,
          defenseScore: Number(stat.stl || 0) + Number(stat.blk || 0),
        }))
        .filter((stat) => Number(stat.defenseScore || 0) > 0)
        .sort((a, b) => {
          if (Number(b.defenseScore || 0) !== Number(a.defenseScore || 0)) {
            return Number(b.defenseScore || 0) - Number(a.defenseScore || 0);
          }
          return Number(b.stl || 0) - Number(a.stl || 0);
        })[0];
    };

    const dashboardReboundLeader = getDashboardStatLeader("reb");
    const dashboardAssistLeader = getDashboardStatLeader("ast");
    const dashboardDefenseLeader = getDashboardDefenseLeader();

    const dashboardAwards = isHistoryView
      ? {
          champion: selectedHistorySeason?.champion || "-",
          runnerUp: selectedHistorySeason?.runnerUp || "-",
          thirdPlace: selectedHistorySeason?.thirdPlace || "-",
          regularSeasonMvp:
            selectedHistorySeason?.regularSeasonMvp ||
            selectedHistorySeason?.mvp ||
            "-",
          finalsMvp: selectedHistorySeason?.finalsMvp || "-",
          mvp:
            selectedHistorySeason?.regularSeasonMvp ||
            selectedHistorySeason?.mvp ||
            "-",
          topScorer: selectedHistorySeason?.topScorer || "-",
          reboundLeader: dashboardReboundLeader?.playerName || "-",
          assistLeader: dashboardAssistLeader?.playerName || "-",
          defenseLeader: dashboardDefenseLeader?.playerName || "-",
          reboundValue: dashboardReboundLeader?.reb || 0,
          assistValue: dashboardAssistLeader?.ast || 0,
          defenseValue: dashboardDefenseLeader?.defenseScore || 0,
        }
      : {
          champion: currentAwards.champion || "-",
          runnerUp: currentAwards.runnerUp || "-",
          thirdPlace: currentAwards.thirdPlace || "-",
          regularSeasonMvp: currentAwards.regularSeasonMvp?.playerName || "-",
          finalsMvp: currentAwards.finalsMvp?.playerName || "-",
          mvp: currentAwards.regularSeasonMvp?.playerName || "-",
          topScorer: currentAwards.topScorer?.playerName || "-",
          reboundLeader: currentAwards.reboundLeader?.playerName || "-",
          assistLeader: currentAwards.assistLeader?.playerName || "-",
          defenseLeader: dashboardDefenseLeader?.playerName || "-",
          reboundValue: currentAwards.reboundLeader?.reb || 0,
          assistValue: currentAwards.assistLeader?.ast || 0,
          defenseValue: dashboardDefenseLeader?.defenseScore || 0,
        };

    const dashboardAwardRows = [
      ["🏆", "Champion", dashboardAwards.champion],
      ["🥈", "Runner Up", dashboardAwards.runnerUp],
      ["🥉", "3rd Place", dashboardAwards.thirdPlace],
      ["👑", "Regular Season MVP", dashboardAwards.regularSeasonMvp],
      ["🏅", "Finals MVP", dashboardAwards.finalsMvp],
      ["🎯", "Top Scorer", dashboardAwards.topScorer],
      [
        "💪",
        "Best Rebounder",
        dashboardAwards.reboundLeader,
        dashboardAwards.reboundValue
          ? `${dashboardAwards.reboundValue} REB`
          : "",
      ],
      [
        "🧠",
        "Best Assist",
        dashboardAwards.assistLeader,
        dashboardAwards.assistValue ? `${dashboardAwards.assistValue} AST` : "",
      ],
      [
        "🛡️",
        "Best Defense",
        dashboardAwards.defenseLeader,
        dashboardAwards.defenseValue
          ? `${dashboardAwards.defenseValue} STL+BLK`
          : "",
      ],
    ];

    const publicSeasonOptions = [
      {
        id: "CURRENT",
        label: `${getCurrentSeasonTitle()} (ปัจจุบัน)`,
        projectName: getCurrentSeasonTitle(),
        competitionType,
        season: currentSeason,
        champion: "-",
        closedAtText: "ยังไม่ปิด Season",
        isCurrent: true,
      },
      ...seasonHistory.map((season) => ({
        id: String(season.id),
        label: getSeasonHistoryTitle(season),
        projectName: getSeasonHistoryTitle(season),
        competitionType: season.competitionType || "5X5",
        season: season.season || 1,
        champion: season.champion || "-",
        closedAtText: season.closedAtText || "-",
        isCurrent: false,
      })),
    ];

    const renderPublicTeamWithLogo = (teamName, size = 28) => (
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
      >
        {dashboardTeamLogos[teamName] ? (
          <img
            src={dashboardTeamLogos[teamName]}
            alt={teamName}
            width={size}
            height={size}
            style={{
              objectFit: "contain",
              borderRadius: "8px",
              border: "1px solid #ddd",
            }}
          />
        ) : (
          <span
            style={{
              width: size,
              height: size,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              background: "#f1f1f1",
              border: "1px solid #ddd",
            }}
          >
            🛡️
          </span>
        )}
        <span>{teamName}</span>
      </span>
    );

    const dashboardStandingMap = new Map(
      dashboardStandings.map((row) => [row.team, row]),
    );

    const dashboardTeamRows = dashboardTeams.map((team) => {
      const standing = dashboardStandingMap.get(team.name) || {
        played: 0,
        win: 0,
        loss: 0,
        pf: 0,
        pa: 0,
        diff: 0,
      };

      const roster =
        team.players ||
        dashboardPlayers.filter((player) => player.teamName === team.name);

      return {
        ...team,
        roster,
        standing,
        totalScore: team.totalScore || calculateTeamScore(roster),
        positionSummary: team.positionSummary || getPositionSummary(roster),
      };
    });

    const selectedPublicTeamName =
      selectedPublicTeam &&
      dashboardTeamRows.some((team) => team.name === selectedPublicTeam)
        ? selectedPublicTeam
        : "";

    const selectedPublicTeamData = dashboardTeamRows.find(
      (team) => team.name === selectedPublicTeamName,
    );

    const renderPublicTeamCard = (team) => {
      const standing = team.standing || {};
      const diff = Number(standing.diff || 0);
      const isSelected = team.name === selectedPublicTeamName;

      return (
        <button
          key={`public-team-card-${team.name}`}
          type="button"
          aria-pressed={isSelected}
          onClick={() =>
            setSelectedPublicTeam((current) =>
              current === team.name ? "" : team.name,
            )
          }
          className={`bam-public-team-card${
            isSelected ? " bam-public-team-card-selected" : ""
          }`}
        >
          {isSelected ? (
            <span className="bam-public-team-selected-badge">Selected</span>
          ) : null}
          <div className="bam-public-team-card-header">
            {dashboardTeamLogos[team.name] ? (
              <img
                src={dashboardTeamLogos[team.name]}
                alt={team.name}
                width={56}
                height={56}
                className="bam-public-team-logo"
              />
            ) : (
              <div className="bam-public-team-logo-placeholder">🛡️</div>
            )}
            <div className="bam-public-team-card-copy">
              <h3 className="bam-public-team-name">{team.name}</h3>
              <div className="bam-public-team-subtitle">
                {team.roster.length} Players / Rating {team.totalScore || 0}
              </div>
            </div>
          </div>

          <div className="bam-public-team-stat-grid">
            <div className="bam-public-team-stat">
              <strong className="bam-public-team-stat-value">
                {standing.win || 0}-{standing.loss || 0}
              </strong>
              <span className="bam-public-team-stat-label">W-L</span>
            </div>
            <div className="bam-public-team-stat">
              <strong className="bam-public-team-stat-value">
                {standing.pf || 0}
              </strong>
              <span className="bam-public-team-stat-label">PF</span>
            </div>
            <div className="bam-public-team-stat">
              <strong className="bam-public-team-stat-value">
                {standing.pa || 0}
              </strong>
              <span className="bam-public-team-stat-label">PA</span>
            </div>
            <div className="bam-public-team-stat">
              <strong className="bam-public-team-stat-value">
                {diff > 0 ? `+${diff}` : diff}
              </strong>
              <span className="bam-public-team-stat-label">Diff</span>
            </div>
          </div>
        </button>
      );
    };

    const getPublicMatchWinner = (match) => {
      if (
        match.status !== "Finished" ||
        match.scoreA === "" ||
        match.scoreB === ""
      )
        return "";
      const scoreA = Number(match.scoreA);
      const scoreB = Number(match.scoreB);
      if (scoreA > scoreB) return match.teamA;
      if (scoreB > scoreA) return match.teamB;
      return "DRAW";
    };

    const publicScheduleByWeek = dashboardSchedule
      .slice()
      .sort((a, b) => {
        if (Number(a.week || 0) !== Number(b.week || 0)) {
          return Number(a.week || 0) - Number(b.week || 0);
        }
        return Number(a.id || 0) - Number(b.id || 0);
      })
      .reduce((groups, match) => {
        const weekKey = match.week || "-";
        if (!groups[weekKey]) groups[weekKey] = [];
        groups[weekKey].push(match);
        return groups;
      }, {});

    const publicScheduleWeeks = Object.keys(publicScheduleByWeek).sort(
      (a, b) => Number(a || 0) - Number(b || 0),
    );

    const getDashboardMatchStatRows = (match) => {
      if (!match) return [];

      return dashboardPlayerStatRows
        .map((stat) => {
          const game = stat.gamesByMatch?.[match.id];
          if (!game) return null;

          const played =
            Boolean(game.appearanceCounted) ||
            Number(game.pts || 0) > 0 ||
            Number(game.reb || 0) > 0 ||
            Number(game.ast || 0) > 0 ||
            Number(game.stl || 0) > 0 ||
            Number(game.blk || 0) > 0;

          if (!played) return null;

          return {
            playerId: stat.playerId,
            playerName: stat.playerName,
            teamName: game.matchTeam || stat.teamName || "-",
            opponent: game.opponent || "-",
            pts: Number(game.pts || 0),
            reb: Number(game.reb || 0),
            ast: Number(game.ast || 0),
            stl: Number(game.stl || 0),
            blk: Number(game.blk || 0),
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a.teamName !== b.teamName)
            return String(a.teamName).localeCompare(String(b.teamName));
          return Number(b.pts || 0) - Number(a.pts || 0);
        });
    };

    const cardStyle = {
      border: "1px solid #ddd",
      borderRadius: "18px",
      padding: "18px",
      background: "white",
      boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    };

    const sectionTitleStyle = {
      marginTop: 0,
      display: "flex",
      alignItems: "center",
      gap: "8px",
    };

    const scrollPublicDashboardToTabs = () => {
      window.requestAnimationFrame(() => {
        document
          .querySelector(".bam-public-tabs")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    const openPublicDashboardTab = (tabKey) => {
      setPublicDashboardTab(tabKey);
      setSelectedPublicTeam("");
      setSelectedPublicMatch(null);
      setSelectedPublicPlayer(null);
      scrollPublicDashboardToTabs();
    };

    const publicDashboardTabs = [
      { key: "overview", label: "Overview", icon: "🏠" },
      { key: "teams", label: "Teams", icon: "🏀" },
      { key: "schedule", label: "Schedule", icon: "🗓️" },
      { key: "awards", label: "Awards", icon: "🏆" },
    ];

    const renderPublicDashboardNav = () => (
      <nav className="bam-public-tabs" aria-label="Public dashboard sections">
        {publicDashboardTabs.map((tab) => {
          const active = publicDashboardTab === tab.key;

          return (
            <button
              key={`public-dashboard-tab-${tab.key}`}
              type="button"
              onClick={() => {
                setPublicDashboardTab(tab.key);
                if (tab.key !== "teams") setSelectedPublicTeam("");
              }}
              className={`bam-public-tab${active ? " bam-public-tab-active" : ""}`}
            >
              <span className="bam-public-tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    );

    return (
      <div className="bam-public-dashboard">
        <header className="bam-public-hero">
          <div className="bam-public-hero-copy">
            <div className="bam-public-kicker">BAM League Public View</div>
            <h1 className="bam-public-title">🏀 {dashboardTitle}</h1>
          </div>

          <div className="bam-public-season-card">
            <label className="bam-public-season-label">เลือกดู Season</label>
            <select
              value={publicSeasonId}
              onChange={(event) => {
                setPublicSeasonId(event.target.value);
                setSelectedPublicTeam("");
                setSelectedPublicMatch(null);
                setSelectedPublicPlayer(null);
                closePlayerProfile();
              }}
              className="bam-public-season-select"
            >
              {publicSeasonOptions.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {renderPublicDashboardNav()}

        {publicDashboardTab === "overview" ? (
          <div className="bam-public-summary-grid">
            {renderDashboardStatCard(
              "Teams",
              dashboardTeams.length,
              `${dashboardTeams.length || teamCount} team setting`,
              () => openPublicDashboardTab("teams"),
            )}
            {renderDashboardStatCard(
              "Players",
              dashboardAvailablePlayers,
              "Available players",
            )}
            {renderDashboardStatCard(
              "Matches",
              `${dashboardFinishedMatches}/${dashboardSchedule.length}`,
              "Finished / Total",
              () => openPublicDashboardTab("schedule"),
            )}
          </div>
        ) : null}

        {publicDashboardTab === "teams" ? (
          <div className="bam-public-panel bam-public-teams-panel">
            <h2 className="bam-public-panel-title">🏀 Team View</h2>
            {dashboardTeamRows.length === 0 ? (
              <div className="bam-public-empty-state bam-public-team-empty">
                <div className="bam-public-empty-icon">🏀</div>
                <p>ยังไม่มีข้อมูลทีม</p>
              </div>
            ) : (
              <>
                <div className="bam-public-team-grid">
                  {dashboardTeamRows.map(renderPublicTeamCard)}
                </div>

                {selectedPublicTeamData ? (
                  <div className="bam-public-selected-team">
                    <div className="bam-public-selected-team-header">
                      <div className="bam-public-selected-team-identity">
                        {renderPublicTeamWithLogo(
                          selectedPublicTeamData.name,
                          48,
                        )}
                      </div>
                      <div className="bam-public-selected-team-stats">
                        <strong className="bam-public-selected-team-chip">
                          Record: {selectedPublicTeamData.standing.win || 0}-
                          {selectedPublicTeamData.standing.loss || 0}
                        </strong>
                        <strong className="bam-public-selected-team-chip">
                          PF: {selectedPublicTeamData.standing.pf || 0}
                        </strong>
                        <strong className="bam-public-selected-team-chip">
                          PA: {selectedPublicTeamData.standing.pa || 0}
                        </strong>
                        <strong className="bam-public-selected-team-chip">
                          Diff: {selectedPublicTeamData.standing.diff || 0}
                        </strong>
                        <strong className="bam-public-selected-team-chip">
                          Total Rating: {selectedPublicTeamData.totalScore || 0}
                        </strong>
                      </div>
                    </div>

                    <div className="bam-public-position-summary">
                      <span className="bam-public-position-summary-label">
                        Position Summary
                      </span>
                      <div className="bam-public-position-pills">
                        {validPositions.map((pos) => (
                          <span
                            key={`public-position-${selectedPublicTeamData.name}-${pos}`}
                            className="bam-public-position-pill"
                          >
                            {pos} {selectedPublicTeamData.positionSummary?.[pos] || 0}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bam-public-roster-wrap">
                      {(selectedPublicTeamData.roster || []).length === 0 ? (
                        <div className="bam-public-empty-state bam-public-roster-empty">
                          <div className="bam-public-empty-icon">👤</div>
                          <p>ยังไม่มีผู้เล่นในทีมนี้</p>
                        </div>
                      ) : (
                        <table className="bam-public-roster-table">
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>POS</th>
                              <th>MVP Score</th>
                              <th>Scoring</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedPublicTeamData.roster || []).map(
                              (player) => {
                                const dashboardStats = getDashboardPlayerStats(
                                  player.id,
                                );

                                return (
                                  <tr
                                    key={`public-team-roster-${selectedPublicTeamData.name}-${player.id}`}
                                    className="bam-public-roster-row"
                                  >
                                    <td>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openPublicRosterPlayerProfile(player)
                                        }
                                        className="bam-public-roster-player-button"
                                        title="กดเพื่อดูข้อมูลผู้เล่น"
                                      >
                                        {renderPlayerAvatar(
                                          player.photoUrl ||
                                            getPlayerPhotoUrl(player.id),
                                          34,
                                        )}
                                        <strong className="bam-public-roster-player-name">
                                          {player.name}
                                        </strong>
                                      </button>
                                    </td>
                                    <td>
                                      {player.pos1 || "-"}
                                      {player.pos2 ? ` / ${player.pos2}` : ""}
                                    </td>
                                    <td>
                                      <strong className="bam-public-roster-value">
                                        {dashboardStats.mvpScore}
                                      </strong>
                                    </td>
                                    <td>
                                      <strong className="bam-public-roster-value">
                                        {dashboardStats.scoring}
                                      </strong>
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {publicDashboardTab === "schedule" ? (
          <div className="bam-public-panel bam-public-schedule-panel">
            <h2 className="bam-public-panel-title">🗓️ Schedule View</h2>
            {dashboardSchedule.length === 0 ? (
              <div className="bam-public-empty-state bam-public-schedule-empty">
                <div className="bam-public-empty-icon">📅</div>
                <p>ยังไม่มีตารางแข่งขัน</p>
                <p className="bam-public-empty-subtext">
                  เมื่อสร้าง Schedule แล้ว ตารางจะแสดงที่นี่
                </p>
              </div>
            ) : (
              <div className="bam-public-week-list">
                {publicScheduleWeeks.map((week) => (
                  <div
                    key={`public-schedule-week-${week}`}
                    className="bam-public-week-card"
                  >
                    <div className="bam-public-week-header">
                      <span className="bam-public-week-title">Week {week}</span>
                      <span className="bam-public-week-count">
                        {publicScheduleByWeek[week].length} Match
                        {publicScheduleByWeek[week].length > 1 ? "es" : ""}
                      </span>
                    </div>

                    <div className="bam-public-match-list">
                      {publicScheduleByWeek[week].map((match) => {
                        const winner = getPublicMatchWinner(match);
                        const isFinished = match.status === "Finished";
                        const isTeamAWinner = winner === match.teamA;
                        const isTeamBWinner = winner === match.teamB;
                        const stageClassName =
                          match.label === "Final"
                            ? " bam-public-match-stage-final"
                            : match.label === "Semi Final"
                              ? " bam-public-match-stage-semi-final"
                              : match.label === "3rd Place"
                                ? " bam-public-match-stage-third-place"
                                : "";

                        return (
                          <div
                            key={`public-schedule-match-${match.id}`}
                            className={`bam-public-match-card ${
                              isFinished
                                ? "bam-public-match-card-finished"
                                : "bam-public-match-card-pending"
                            }`}
                          >
                            <div
                              className={`bam-public-match-team bam-public-match-team-left${
                                isTeamAWinner
                                  ? " bam-public-match-team-winner"
                                  : isFinished && winner && winner !== "DRAW"
                                    ? " bam-public-match-team-muted"
                                    : ""
                              }`}
                            >
                              {renderPublicTeamWithLogo(match.teamA, 32)}
                            </div>

                            <div className="bam-public-match-center">
                              <div
                                className={`bam-public-match-stage${stageClassName}`}
                              >
                                {match.label || "League"}
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedPublicMatch(match)}
                                aria-label={`View match details: ${match.teamA} vs ${match.teamB}, Week ${match.week}`}
                                title="กดเพื่อดูสถิติผู้เล่นในแมตช์นี้"
                                className={`bam-public-score-button ${
                                  isFinished
                                    ? "bam-public-score-button-finished"
                                    : "bam-public-score-button-pending"
                                }`}
                              >
                                {match.scoreA !== "" && match.scoreB !== ""
                                  ? `${match.scoreA} - ${match.scoreB}`
                                  : "VS"}
                              </button>
                              <div
                                className={`bam-public-match-status ${
                                  isFinished
                                    ? "bam-public-match-status-finished"
                                    : "bam-public-match-status-pending"
                                }`}
                              >
                                {isFinished ? "Finished" : "Pending"}
                              </div>
                            </div>

                            <div
                              className={`bam-public-match-team bam-public-match-team-right${
                                isTeamBWinner
                                  ? " bam-public-match-team-winner"
                                  : isFinished && winner && winner !== "DRAW"
                                    ? " bam-public-match-team-muted"
                                    : ""
                              }`}
                            >
                              {renderPublicTeamWithLogo(match.teamB, 32)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {publicDashboardTab === "overview" ||
        publicDashboardTab === "awards" ? (
          <div className="bam-public-overview-grid">
            <div className="bam-public-panel bam-public-awards-panel">
              <h2 className="bam-public-panel-title">🏆 Current Awards</h2>
              <div className="bam-public-awards-grid">
                {dashboardAwardRows.map(([icon, label, value, detail]) => {
                  const isFeaturedAward = [
                    "Champion",
                    "Regular Season MVP",
                    "Top Scorer",
                  ].includes(label);

                  return (
                    <div
                      key={`public-award-${label}`}
                      className={`bam-public-award-row${
                        isFeaturedAward ? " bam-public-award-row-featured" : ""
                      }`}
                    >
                      <strong className="bam-public-award-label">
                        <span className="bam-public-award-icon">{icon}</span>
                        {label}
                      </strong>
                      <span className="bam-public-award-value">
                        {value || "-"}
                        {detail ? (
                          <span className="bam-public-award-detail">
                            ({detail})
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bam-public-panel bam-public-standings-panel">
              <h2 className="bam-public-panel-title">📊 Standings</h2>
              {dashboardStandings.length === 0 ? (
                <div className="bam-public-empty-state">
                  <div className="bam-public-empty-icon">📋</div>
                  <p>ยังไม่มีตารางคะแนน</p>
                  <p className="bam-public-empty-subtext">
                    เมื่อมีผลการแข่งขัน ตารางคะแนนจะปรากฏที่นี่
                  </p>
                </div>
              ) : (
                <div className="bam-public-standings-wrap">
                  <table className="bam-public-standings-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Team</th>
                        <th>W</th>
                        <th>L</th>
                        <th>PF</th>
                        <th>PA</th>
                        <th>+/-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardStandings.map((row, index) => (
                        <tr key={`public-standing-${row.team}`}>
                          <td>
                            <span
                              className={`bam-public-rank-badge${
                                index < 3
                                  ? ` bam-public-rank-badge-${index + 1}`
                                  : ""
                              }`}
                            >
                              {index + 1}
                            </span>
                          </td>
                          <td>{renderPublicTeamWithLogo(row.team, 28)}</td>
                          <td>{row.win}</td>
                          <td>{row.loss}</td>
                          <td>{row.pf}</td>
                          <td>{row.pa}</td>
                          <td>{row.diff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {publicDashboardTab === "overview" ||
        publicDashboardTab === "awards" ? (
          <div className="bam-public-leaders-grid">
            <div className="bam-public-panel bam-public-leader-card">
              <h2 className="bam-public-panel-title">👑 MVP Race</h2>
              {dashboardMvpRace.length === 0 ? (
                <p className="bam-public-empty-state bam-public-leader-empty">ยังไม่มีข้อมูล MVP</p>
              ) : (
                dashboardMvpRace.map((player, index) =>
                  renderPublicPlayerRow(
                    player,
                    index,
                    `${Number(player.mvpScore || 0).toFixed(1)}`,
                    () => openPublicPlayerProfile(player),
                  ),
                )
              )}
            </div>

            <div className="bam-public-panel bam-public-leader-card">
              <h2 className="bam-public-panel-title">🎯 Top Scorers</h2>
              {dashboardTopScorers.length === 0 ? (
                <p className="bam-public-empty-state bam-public-leader-empty">ยังไม่มีข้อมูลคะแนนผู้เล่น</p>
              ) : (
                dashboardTopScorers.map((player, index) =>
                  renderPublicPlayerRow(
                    player,
                    index,
                    `${player.pts || 0} PTS`,
                    () => openPublicPlayerProfile(player),
                  ),
                )
              )}
            </div>
          </div>
        ) : null}

        {publicDashboardTab === "schedule" ? (
          <div className="bam-public-panel bam-public-schedule-table-panel">
            <h2 className="bam-public-panel-title">Quick Results</h2>
            {dashboardSchedule.length === 0 ? (
              <div className="bam-public-empty-state bam-public-schedule-empty">
                <p>ยังไม่มี Schedule</p>
              </div>
            ) : (
              <div className="bam-public-schedule-table-wrap">
                <table className="bam-public-schedule-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Stage</th>
                      <th>Match</th>
                      <th>Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardSchedule.map((match) => (
                      <tr key={`public-schedule-${match.id}`}>
                        <td>{match.week}</td>
                        <td>{match.label}</td>
                        <td>
                          {match.teamA} vs {match.teamB}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedPublicMatch(match)}
                            aria-label={`View match details: ${match.teamA} vs ${match.teamB}, Week ${match.week}`}
                            className="bam-public-schedule-table-score"
                          >
                            {match.scoreA !== "" && match.scoreB !== ""
                              ? `${match.scoreA}-${match.scoreB}`
                              : "VS"}
                          </button>
                        </td>
                        <td>{match.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {selectedPublicMatch
          ? (() => {
              const matchStatRows =
                getDashboardMatchStatRows(selectedPublicMatch);
              const isFinished = selectedPublicMatch.status === "Finished";
              const hasScore =
                selectedPublicMatch.scoreA !== "" &&
                selectedPublicMatch.scoreB !== "";
              const matchScoreText = hasScore
                ? `${selectedPublicMatch.scoreA} - ${selectedPublicMatch.scoreB}`
                : "VS";
              const stageClassName =
                selectedPublicMatch.label === "Final"
                  ? " bam-public-match-stage-final"
                  : selectedPublicMatch.label === "Semi Final"
                    ? " bam-public-match-stage-semi-final"
                    : selectedPublicMatch.label === "3rd Place"
                      ? " bam-public-match-stage-third-place"
                      : "";
              const teamAMatchRows = matchStatRows.filter(
                (row) => row.teamName === selectedPublicMatch.teamA,
              );
              const teamBMatchRows = matchStatRows.filter(
                (row) => row.teamName === selectedPublicMatch.teamB,
              );
              const renderPublicMatchStatTable = (teamName, rows) => (
                <div className="bam-public-match-detail-team-panel">
                  <div className="bam-public-match-detail-team-heading">
                    {renderPublicTeamWithLogo(teamName, 30)}
                    <span>{rows.length} Player{rows.length === 1 ? "" : "s"}</span>
                  </div>
                  {rows.length === 0 ? (
                    <div className="bam-public-empty-state bam-public-match-detail-empty">
                      <div className="bam-public-empty-icon">🏀</div>
                      <p>ยังไม่มีสถิติผู้เล่นของทีมนี้</p>
                    </div>
                  ) : (
                    <div className="bam-public-match-detail-table-wrap">
                      <table className="bam-public-match-detail-table">
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>STL</th>
                            <th>BLK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr
                              key={`public-match-stat-${selectedPublicMatch.id}-${row.playerId}-${row.teamName}`}
                            >
                              <td>
                                <span className="bam-public-match-detail-player">
                                  {renderPlayerAvatar(
                                    getPlayerPhotoUrl(row.playerId),
                                    32,
                                  )}
                                  <strong>{row.playerName}</strong>
                                </span>
                              </td>
                              <td>{row.pts}</td>
                              <td>{row.reb}</td>
                              <td>{row.ast}</td>
                              <td>{row.stl}</td>
                              <td>{row.blk}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );

              return (
                <div
                  className="bam-public-match-detail-backdrop"
                  onClick={() => setSelectedPublicMatch(null)}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="bam-public-match-detail-title"
                    className="bam-public-match-detail-modal"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="bam-public-match-detail-header">
                      <div>
                        <h2
                          id="bam-public-match-detail-title"
                          className="bam-public-match-detail-title"
                        >
                          📊 Match Stats
                        </h2>
                        <div className="bam-public-match-detail-badges">
                          <span className="bam-public-match-detail-badge">
                            Week {selectedPublicMatch.week}
                          </span>
                          <span
                            className={`bam-public-match-stage${stageClassName}`}
                          >
                            {selectedPublicMatch.label || "League"}
                          </span>
                          <span
                            className={`bam-public-match-status ${
                              isFinished
                                ? "bam-public-match-status-finished"
                                : "bam-public-match-status-pending"
                            }`}
                          >
                            {isFinished ? "Finished" : "Pending"}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label="Close match details"
                        onClick={() => setSelectedPublicMatch(null)}
                        className="bam-public-match-detail-close"
                      >
                        ×
                      </button>
                    </div>

                    <div className="bam-public-match-detail-scoreboard">
                      <div className="bam-public-match-detail-team bam-public-match-detail-team-left">
                        {renderPublicTeamWithLogo(selectedPublicMatch.teamA, 46)}
                      </div>
                      <div className="bam-public-match-detail-score">
                        {matchScoreText}
                      </div>
                      <div className="bam-public-match-detail-team bam-public-match-detail-team-right">
                        {renderPublicTeamWithLogo(selectedPublicMatch.teamB, 46)}
                      </div>
                    </div>

                    {matchStatRows.length === 0 ? (
                      <div className="bam-public-empty-state bam-public-match-detail-empty-main">
                        <div className="bam-public-empty-icon">🏀</div>
                        <p>ยังไม่มีสถิติผู้เล่นของ Match นี้</p>
                        <p className="bam-public-empty-subtext">
                          บันทึก Match Roster และ Player Stats ก่อน ข้อมูลจะแสดงที่นี่
                        </p>
                      </div>
                    ) : (
                      <div className="bam-public-match-detail-stats-grid">
                        {renderPublicMatchStatTable(
                          selectedPublicMatch.teamA,
                          teamAMatchRows,
                        )}
                        {renderPublicMatchStatTable(
                          selectedPublicMatch.teamB,
                          teamBMatchRows,
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          : null}
        {false && selectedPublicPlayer
          ? (() => {
              const playerStats = getDashboardPlayerStats(
                selectedPublicPlayer.id,
              );
              const matchLog = getDashboardPlayerMatchLog(
                selectedPublicPlayer.id,
              );
              const careerAwards = getDashboardPlayerCareerAwards(
                selectedPublicPlayer.name,
              );

              return (
                <div
                  onClick={() => setSelectedPublicPlayer(null)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.55)",
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px",
                  }}
                >
                  <div
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      background: "white",
                      borderRadius: "22px",
                      padding: "22px",
                      width: "min(760px, 100%)",
                      maxHeight: "90vh",
                      overflowY: "auto",
                      boxShadow: "0 20px 70px rgba(0,0,0,0.28)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                        marginBottom: "18px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                        }}
                      >
                        {renderPlayerAvatar(
                          selectedPublicPlayer.photoUrl ||
                            getPlayerPhotoUrl(selectedPublicPlayer.id),
                          70,
                        )}
                        <div>
                          <h2 style={{ margin: 0 }}>
                            {selectedPublicPlayer.name}
                          </h2>
                          <div style={{ color: "#666", marginTop: "6px" }}>
                            {selectedPublicPlayer.teamName || "-"} ·{" "}
                            {selectedPublicPlayer.pos1 || "-"}
                            {selectedPublicPlayer.pos2
                              ? ` / ${selectedPublicPlayer.pos2}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedPublicPlayer(null)}
                        style={{
                          border: "1px solid #ddd",
                          background: "#f7f7f7",
                          borderRadius: "999px",
                          width: "36px",
                          height: "36px",
                          cursor: "pointer",
                          fontSize: "18px",
                        }}
                      >
                        ×
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(130px,1fr))",
                        gap: "10px",
                        marginBottom: "18px",
                      }}
                    >
                      {[
                        ["GP", playerStats.games],
                        ["PTS", playerStats.pts],
                        ["PPG", playerStats.ppg],
                        ["REB", playerStats.reb],
                        ["AST", playerStats.ast],
                        ["STL", playerStats.stl],
                        ["BLK", playerStats.blk],
                        ["MVP Score", playerStats.mvpScore],
                      ].map(([label, value]) => (
                        <div
                          key={`public-player-popup-stat-${label}`}
                          style={{
                            border: "1px solid #eee",
                            borderRadius: "14px",
                            padding: "12px",
                            background: "#fafafa",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ color: "#777", fontSize: "12px" }}>
                            {label}
                          </div>
                          <strong style={{ fontSize: "20px" }}>{value}</strong>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(160px,1fr))",
                        gap: "10px",
                        marginBottom: "18px",
                      }}
                    >
                      {renderSplitAwardCard(
                        "🏆",
                        "Champion",
                        careerAwards.champion,
                      )}
                      {renderSplitAwardCard(
                        "👑",
                        "Regular MVP",
                        careerAwards.regularSeasonMvp || careerAwards.mvp,
                      )}
                      {renderSplitAwardCard(
                        "🏅",
                        "Finals MVP",
                        careerAwards.finalsMvp,
                      )}
                      {renderSplitAwardCard(
                        "🎯",
                        "Top Scorer",
                        careerAwards.topScorer,
                      )}
                    </div>

                    <h3 style={{ marginTop: 0 }}>Match Log</h3>
                    {matchLog.length === 0 ? (
                      <p style={{ color: "#777" }}>
                        ยังไม่มีข้อมูลรายเกมของผู้เล่นนี้
                      </p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{ width: "100%", borderCollapse: "collapse" }}
                        >
                          <thead>
                            <tr style={{ borderBottom: "1px solid #eee" }}>
                              <th style={{ textAlign: "left", padding: "8px" }}>
                                Week
                              </th>
                              <th style={{ textAlign: "left", padding: "8px" }}>
                                Opponent
                              </th>
                              <th style={{ padding: "8px" }}>Score</th>
                              <th style={{ padding: "8px" }}>PTS</th>
                              <th style={{ padding: "8px" }}>REB</th>
                              <th style={{ padding: "8px" }}>AST</th>
                              <th style={{ padding: "8px" }}>STL</th>
                              <th style={{ padding: "8px" }}>BLK</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchLog.map((game) => (
                              <tr
                                key={`public-player-match-log-${game.matchId}-${game.matchTeam}`}
                                style={{ borderBottom: "1px solid #f1f1f1" }}
                              >
                                <td style={{ padding: "8px" }}>{game.week}</td>
                                <td style={{ padding: "8px" }}>
                                  {game.opponent}
                                </td>
                                <td
                                  style={{
                                    textAlign: "center",
                                    padding: "8px",
                                  }}
                                >
                                  {game.score}
                                </td>
                                <td
                                  style={{
                                    textAlign: "center",
                                    padding: "8px",
                                  }}
                                >
                                  {game.pts}
                                </td>
                                <td
                                  style={{
                                    textAlign: "center",
                                    padding: "8px",
                                  }}
                                >
                                  {game.reb}
                                </td>
                                <td
                                  style={{
                                    textAlign: "center",
                                    padding: "8px",
                                  }}
                                >
                                  {game.ast}
                                </td>
                                <td
                                  style={{
                                    textAlign: "center",
                                    padding: "8px",
                                  }}
                                >
                                  {game.stl}
                                </td>
                                <td
                                  style={{
                                    textAlign: "center",
                                    padding: "8px",
                                  }}
                                >
                                  {game.blk}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          : null}
      </div>
    );
  };

  const hallOfFame = getHallOfFameData();

  const adminAccordionStyle = {
    border: "1px solid #d9d9d9",
    borderRadius: "14px",
    marginBottom: "14px",
    background: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    overflow: "hidden",
  };

  const adminAccordionSummaryStyle = {
    padding: "14px 16px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "18px",
    background: "#f7f7f7",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  };

  const adminAccordionHintStyle = {
    fontSize: "12px",
    color: "#666",
    fontWeight: "normal",
  };

  const adminTabs = [
    {
      key: "systemTools",
      label: "⚙️ System Tools",
      shortLabel: "System",
      description: "Backup, Cloud, Season และ Danger Zone สำหรับผู้ดูแลระบบ",
    },
    {
      key: "leagueSettings",
      label: "⚙️ League Settings",
      shortLabel: "Settings",
      description:
        "ตั้งค่าประเภทการแข่งขัน จำนวนทีม ชื่อทีม โลโก้ และ Lock Group",
    },
    {
      key: "players",
      label: "👤 Players",
      shortLabel: "Players",
      description: "จัดการฐานข้อมูลผู้เล่น เพิ่ม แก้ไข ลบ Import และ Export",
    },
    {
      key: "teams",
      label: "🏀 Teams",
      shortLabel: "Teams",
      description: "Generate Teams, จัดการรายชื่อทีม และย้ายผู้เล่นระหว่างทีม",
    },
    {
      key: "leagueManagement",
      label: "🏀 League",
      shortLabel: "League",
      description: "สร้างลีก จัดตาราง Playoff และบันทึกผลการแข่งขัน",
    },
    {
      key: "schedule",
      label: "📅 Schedule",
      shortLabel: "Schedule",
      description: "ดูโปรแกรมแข่ง จัดการ Match Roster และบันทึกสถิติรายแมตช์",
    },
    {
      key: "stats",
      label: "📊 Stats",
      shortLabel: "Stats",
      description: "สถิติผู้เล่น ตารางคะแนน MVP Score และผู้นำสถิติ",
    },
    {
      key: "seasonAwards",
      label: "🏆 Awards / HOF",
      shortLabel: "Awards",
      description: "รางวัลประจำซีซัน Hall of Fame และสรุปผู้เล่นเด่น",
    },
    {
      key: "seasonHistory",
      label: "🏛️ History",
      shortLabel: "History",
      description: "ดูประวัติซีซันเก่าและข้อมูลที่ปิดซีซันไปแล้ว",
    },
    {
      key: "draftHistory",
      label: "🗂️ Drafts",
      shortLabel: "Drafts",
      description: "บันทึก โหลด เปลี่ยนชื่อ และลบ Draft ที่เคยสุ่มไว้",
    },
  ];

  const activeAdminTab =
    adminTabs.find((tab) => tab.key === activeAdminMenu) || adminTabs[0];

  const finishedMatchesCount = schedule.filter(
    (match) => match.status === "Finished",
  ).length;

  const adminPageShellStyle = {
    minHeight: "100vh",
    padding: "24px",
    fontFamily: "inherit",
    background: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
  };

  if (isPublicOnlyRoute || viewMode === "PUBLIC") {
    return (
      <div className="bam-public-shell">
        {!isPublicOnlyRoute ? (
          <button
            type="button"
            onClick={() => {
              closePlayerProfile();
              setViewMode("ADMIN");
            }}
            className="bam-public-back-button"
          >
            🔧 Back to Admin Mode
          </button>
        ) : null}
        {renderPublicDashboard()}
        {renderPlayerProfileModal()}
      </div>
    );
  }

  // ======================================================
  // 24. MAIN PAGE RENDER
  // ======================================================

  return (
    <div style={adminPageShellStyle}>
      <AdminHeader
        seasonTitle={getCurrentSeasonTitle()}
        competitionType={competitionType}
        currentSeason={currentSeason}
        cloudStatus={cloudStatus}
        databaseVersion={databaseMeta.version}
        publishValidated={publishMeta.validationPassed}
        onOpenPublic={() => setViewMode("PUBLIC")}
        teamsCount={teams.length}
        teamCount={teamCount}
        playersCount={players.length}
        availablePlayersCount={
          players.filter((player) => player.available).length
        }
        finishedMatchesCount={finishedMatchesCount}
        scheduleCount={schedule.length}
        draftsCount={drafts.length}
      />

      <AdminNavigation
        tabs={adminTabs}
        activeKey={activeAdminMenu}
        activeTab={activeAdminTab}
        onChange={setActiveAdminMenu}
      />

      <details
        open
        style={{
          ...adminAccordionStyle,
          display: activeAdminMenu === "systemTools" ? "block" : "none",
        }}
      >
        <summary style={adminAccordionSummaryStyle}>
          <span>⚙️ System Tools</span>
          <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
        </summary>
        <div
          style={{
            border: "1px solid #d9d9d9",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "20px",
            background: "#fafafa",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>⚙️ System Tools</h2>
          <p style={{ marginTop: 0, color: "#555" }}>
            จัดกลุ่มเครื่องมือเพื่อกันกดผิด: Backup, Cloud, Season และ Danger
            Zone แยกกันชัดเจน
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "14px",
              alignItems: "stretch",
            }}
          >
            {renderSystemHealthCard()}

            {renderAdminAuthCard()}

            <BackupRestoreTools
              exportAllData={exportLeagueBackup}
              importLeagueBackup={importLeagueBackup}
            />

            {renderSafeCloudPublishCard()}

            <CloudTools
              cloudStatus={cloudStatus}
              uploadToCloud={uploadToCloud}
              downloadFromCloud={downloadFromCloud}
              clearCloudData={clearCloudData}
              adminUser={adminUser}
              authLoading={authLoading}
            />

            <SeasonManagementTools
              importSeasonHistory={importSeasonHistoryBackup}
              closeCurrentSeason={closeSeason}
              startNewSeason={clearCurrentProject}
            />

            <DangerZoneTools resetAllSystem={resetAllSystem} />
          </div>
        </div>
      </details>

      <details
        open
        style={{
          ...adminAccordionStyle,
          display: activeAdminMenu === "leagueSettings" ? "block" : "none",
        }}
      >
        <summary style={adminAccordionSummaryStyle}>
          <span>⚙️ League Settings</span>
          <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
        </summary>
        <div
          style={{
            border: "1px solid #dbeafe",
            padding: "16px",
            marginBottom: "20px",
            background: "#f8fbff",
            borderRadius: "10px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>⚙️ League Settings</h2>
          <p style={{ marginTop: 0, color: "#555" }}>
            ตั้งค่าประเภทการแข่งขัน จำนวนทีม และชื่อ Season ก่อนเริ่ม Draft
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                border: "1px solid #bfdbfe",
                background: "white",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#1d4ed8" }}>
                🏀 Competition Setup
              </h3>
              <p style={{ color: "#555", fontSize: "14px" }}>
                เลือกรูปแบบการแข่งขันและจำนวนทีมหลักของ Season นี้
              </p>

              <label style={{ display: "block", marginBottom: "10px" }}>
                ประเภทการแข่งขัน
                <select
                  value={competitionType}
                  onChange={(e) => handleCompetitionTypeChange(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "6px",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                  }}
                >
                  <option value="5X5">5X5</option>
                  <option value="3X3">3X3</option>
                </select>
              </label>

              <label style={{ display: "block" }}>
                จำนวนทีม
                <select
                  value={teamCount}
                  onChange={(e) => handleTeamCountChange(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "6px",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                  }}
                >
                  {Array.from({ length: 10 }, (_, index) => index + 3).map(
                    (count) => (
                      <option key={count} value={count}>
                        {count} Teams
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div
                style={{
                  marginTop: "12px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "#eff6ff",
                  color: "#1e40af",
                  fontSize: "13px",
                }}
              >
                ⚠️ การเปลี่ยนประเภทหรือจำนวนทีม อาจล้าง Teams, Schedule, Draft
                และ Stats ปัจจุบัน แต่ไม่ลบรายชื่อ Players
              </div>
            </div>

            <div
              style={{
                border: "1px solid #fed7aa",
                background: "white",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#c2410c" }}>
                📅 Season Setup
              </h3>
              <p style={{ color: "#555", fontSize: "14px" }}>
                ตั้งชื่อรายการสำหรับแสดงใน Dashboard และ Public View
              </p>

              <label style={{ display: "block" }}>
                ชื่อโครงการ / รายการแข่งขัน
                <input
                  value={seasonProjectName}
                  onChange={(e) => setSeasonProjectName(e.target.value)}
                  placeholder={getDefaultSeasonProjectName()}
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "6px",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => setSeasonProjectName("")}
                style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #fb923c",
                  background: "#fff7ed",
                  color: "#9a3412",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ใช้ชื่อเริ่มต้น
              </button>

              <div
                style={{
                  marginTop: "12px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "#fff7ed",
                  color: "#9a3412",
                  fontSize: "13px",
                }}
              >
                Current: {getCurrentSeasonTitle()} | Season {currentSeason}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "14px",
              padding: "12px",
              borderRadius: "10px",
              background: "#f1f5f9",
              color: "#334155",
              fontSize: "14px",
            }}
          >
            รองรับ 3-12 ทีม | ประเภท {competitionType} | Match Roster ขั้นต่ำ{" "}
            {getMinPlayersPerGame()} คน | 3 ทีมใช้ Final 1 vs 2 | 4 ทีมขึ้นไปใช้
            Top 4 Playoff
          </div>
        </div>
      </details>

      <details
        open
        style={{
          ...adminAccordionStyle,
          display: activeAdminMenu === "players" ? "block" : "none",
        }}
      >
        <summary style={adminAccordionSummaryStyle}>
          <span>👤 Players</span>
          <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
        </summary>
        <div
          style={{
            border: "1px solid #ddd",
            padding: "16px",
            marginBottom: "20px",
            background: "#ffffff",
            borderRadius: "10px",
          }}
        >
          <PlayerForm
            form={form}
            setForm={setForm}
            editingId={editingId}
            validTiers={validTiers}
            validPositions={validPositions}
            handlePlayerPhotoUpload={handlePlayerPhotoUpload}
            renderPlayerAvatar={renderPlayerAvatar}
            addOrUpdatePlayer={addOrUpdatePlayer}
            resetForm={resetForm}
          />

          <PlayerImportExport
            downloadTemplate={downloadTemplate}
            importCSV={importCSV}
            exportCSV={exportCSV}
          />

          <div
            style={{
              border: "1px solid #ffe0b2",
              borderRadius: "10px",
              padding: "14px",
              background: "#fff8e1",
              marginBottom: "14px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>🎲 Draft & Team Actions</h3>
            <button
              type="button"
              onClick={generateTeams}
              style={{ marginRight: "8px", marginBottom: "8px" }}
            >
              Generate {teamCount} Teams
            </button>

            <button
              type="button"
              onClick={saveDraft}
              style={{ marginRight: "8px", marginBottom: "8px" }}
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={exportTeamsCSV}
              style={{ marginRight: "8px", marginBottom: "8px" }}
            >
              Export Teams
            </button>
          </div>

          <div
            style={{
              border: "1px solid #d1c4e9",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
              background: "#faf5ff",
            }}
          >
            <h3 style={{ marginTop: 0 }}>🔒 Lock Groups</h3>
            <p>
              ใช้สำหรับล็อคผู้เล่นที่ต้องอยู่ทีมเดียวกัน
              แล้วให้ระบบสุ่มผู้เล่นที่เหลือลงทีมอื่นอัตโนมัติ
            </p>

            <div style={{ marginBottom: "10px" }}>
              <input
                placeholder="ชื่อกลุ่ม เช่น ปอน+หมาย+เกี๋ย"
                value={lockGroupName}
                onChange={(e) => setLockGroupName(e.target.value)}
                style={{ marginRight: "8px", minWidth: "220px" }}
              />

              <select
                multiple
                value={selectedLockPlayerIds.map(String)}
                onChange={(e) =>
                  setSelectedLockPlayerIds(
                    Array.from(e.target.selectedOptions).map(
                      (option) => option.value,
                    ),
                  )
                }
                style={{
                  minWidth: "260px",
                  minHeight: "90px",
                  marginRight: "8px",
                }}
              >
                {players
                  .filter((player) => player.available)
                  .map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.bamPlayerId ? `${player.bamPlayerId} | ` : ""}
                      {player.name} | {player.tier} | {player.pos1}
                      {player.pos2 ? `/${player.pos2}` : ""}
                    </option>
                  ))}
              </select>

              <button onClick={createLockGroup} style={{ marginRight: "8px" }}>
                Create Lock Group
              </button>

              {lockGroups.length > 0 && (
                <button onClick={clearLockGroups}>Clear Lock Groups</button>
              )}
            </div>

            {lockGroups.length === 0 ? (
              <p style={{ marginBottom: 0 }}>ยังไม่มี Lock Group</p>
            ) : (
              <div>
                {lockGroups.map((group) => (
                  <div
                    key={group.id}
                    style={{
                      border: "1px solid #ddd",
                      padding: "8px",
                      marginBottom: "8px",
                      background: "white",
                    }}
                  >
                    <strong>{group.name}</strong>:{" "}
                    {group.playerIds.map(getPlayerNameById).join(", ")}
                    <button
                      onClick={() => deleteLockGroup(group.id)}
                      style={{ marginLeft: "8px" }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              border: "1px solid #ffcdd2",
              borderRadius: "10px",
              padding: "14px",
              background: "#fff5f5",
              marginBottom: "14px",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#b71c1c" }}>
              ⚠️ Player Danger Zone
            </h3>
            <button
              type="button"
              onClick={clearAllPlayers}
              style={{
                background: "#c62828",
                color: "white",
                fontWeight: "bold",
                border: "none",
                borderRadius: "6px",
                padding: "8px 14px",
              }}
            >
              Clear All Players
            </button>
            <p style={{ marginBottom: 0, color: "#777" }}>
              ลบรายชื่อผู้เล่นทั้งหมดจาก LocalStorage แต่ไม่ลบ Cloud โดยตรง
            </p>
          </div>

          <div
            style={{
              padding: "10px 12px",
              background: "#f5f5f5",
              borderRadius: "8px",
              display: "inline-block",
            }}
          >
            <strong>Total Players:</strong> {players.length} |{" "}
            <strong>Available:</strong>{" "}
            {players.filter((p) => p.available).length}
          </div>
        </div>
      </details>

      <PlayerList
        activeAdminMenu={activeAdminMenu}
        players={players}
        getPlayerDisplayId={getPlayerDisplayId}
        renderPlayerAvatar={renderPlayerAvatar}
        setSelectedProfilePlayerId={setSelectedProfilePlayerId}
        toggleAvailable={toggleAvailable}
        startEditPlayer={startEditPlayer}
        deletePlayer={deletePlayer}
        uploadExistingPlayerPhoto={uploadExistingPlayerPhoto}
        removeExistingPlayerPhoto={removeExistingPlayerPhoto}
      />

      {teams.length > 0 && (
        <details
          open
          style={{
            ...adminAccordionStyle,
            display: activeAdminMenu === "teams" ? "block" : "none",
          }}
        >
          <summary style={adminAccordionSummaryStyle}>
            <span>🏀 Draft Results / Generated Teams</span>
            <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
          </summary>
          <div style={{ marginTop: "32px" }}>
            <h2>Generated Teams</h2>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "20px",
                background: "#ffffff",
              }}
            >
              <h3 style={{ marginTop: 0 }}>🛡️ Team Names & Logos</h3>
              <p style={{ marginTop: 0, color: "#555" }}>
                ตั้งชื่อทีมและอัปโหลดโลโก้หลังจากสุ่มทีมเสร็จแล้ว
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                {teams.map((team, index) => (
                  <div
                    key={`team-rename-${index}`}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "10px",
                      padding: "12px",
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
                      Team {index + 1}
                    </div>
                    <div style={{ marginBottom: "8px" }}>
                      {renderTeamLogo(team.name, 52)}
                    </div>
                    <input
                      value={team.name}
                      onChange={(e) => updateTeamName(index, e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                      }}
                    />
                    <div style={{ marginTop: "10px" }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => uploadTeamLogo(team.name, e)}
                      />
                      {teamLogos[team.name] && (
                        <button
                          onClick={() => removeTeamLogo(team.name)}
                          style={{ marginTop: "8px" }}
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <h3>Balance Score: {getBalancePercent()}%</h3>
            <p style={{ color: "#555", marginTop: 0 }}>
              รายละเอียดทีม / รายชื่อผู้เล่น / Position / Skill ถูกย้ายไปไว้ใน
              Team Dashboard ด้านล่างแล้ว กดการ์ดทีมเพื่อเปิดดูรายละเอียด
            </p>
          </div>
        </details>
      )}

      <TeamDashboard
        activeAdminMenu={activeAdminMenu}
        adminAccordionStyle={adminAccordionStyle}
        adminAccordionSummaryStyle={adminAccordionSummaryStyle}
        adminAccordionHintStyle={adminAccordionHintStyle}
        teamDashboardData={getTeamDashboardData()}
        teams={teams}
        expandedTeamDashboard={expandedTeamDashboard}
        setExpandedTeamDashboard={setExpandedTeamDashboard}
        renderTeamLogo={renderTeamLogo}
        renderPlayerAvatar={renderPlayerAvatar}
        getPlayerPhotoUrl={getPlayerPhotoUrl}
        setSelectedProfilePlayerId={setSelectedProfilePlayerId}
      />

      {teams.length > 0 && (
        <details
          open
          style={{
            ...adminAccordionStyle,
            display: activeAdminMenu === "leagueManagement" ? "block" : "none",
          }}
        >
          <summary style={adminAccordionSummaryStyle}>
            <span>🏀 League Management</span>
            <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
          </summary>
          <div style={{ marginTop: "32px" }}>
            <h2>League Management</h2>
            <p>เพิ่ม / ย้าย / ลบผู้เล่นจากทีม หลังจาก Draft แล้ว</p>

            <h3>Add Existing Player To Team</h3>
            <div style={{ marginBottom: "16px" }}>
              <select
                value={rosterExistingPlayerId}
                onChange={(e) => setRosterExistingPlayerId(e.target.value)}
                style={{ marginRight: "8px" }}
              >
                <option value="">เลือกผู้เล่น</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                    {player.teamName ? ` (${player.teamName})` : ""}
                  </option>
                ))}
              </select>

              <select
                value={rosterTargetTeam}
                onChange={(e) => setRosterTargetTeam(e.target.value)}
                style={{ marginRight: "8px" }}
              >
                <option value="">เลือกทีม</option>
                {teams.map((team) => (
                  <option key={team.name}>{team.name}</option>
                ))}
              </select>

              <button onClick={addExistingPlayerToTeam}>Add To Team</button>
            </div>

            <h3>Add New Player To Team</h3>
            <div style={{ marginBottom: "16px" }}>
              <input
                placeholder="New player name"
                value={newRosterForm.name}
                onChange={(e) =>
                  setNewRosterForm({ ...newRosterForm, name: e.target.value })
                }
                style={{ marginRight: "8px" }}
              />

              <select
                value={newRosterForm.tier}
                onChange={(e) =>
                  setNewRosterForm({ ...newRosterForm, tier: e.target.value })
                }
                style={{ marginRight: "8px" }}
              >
                <option value="">Auto Tier</option>
                {validTiers.map((tier) => (
                  <option key={tier}>{tier}</option>
                ))}
              </select>

              <select
                value={newRosterForm.pos1}
                onChange={(e) =>
                  setNewRosterForm({ ...newRosterForm, pos1: e.target.value })
                }
                style={{ marginRight: "8px" }}
              >
                {validPositions.map((pos) => (
                  <option key={pos}>{pos}</option>
                ))}
              </select>

              <select
                value={newRosterForm.pos2}
                onChange={(e) =>
                  setNewRosterForm({ ...newRosterForm, pos2: e.target.value })
                }
                style={{ marginRight: "8px" }}
              >
                <option value="">-</option>
                {validPositions.map((pos) => (
                  <option key={pos}>{pos}</option>
                ))}
              </select>

              <select
                value={newRosterForm.targetTeam}
                onChange={(e) =>
                  setNewRosterForm({
                    ...newRosterForm,
                    targetTeam: e.target.value,
                  })
                }
                style={{ marginRight: "8px" }}
              >
                <option value="">เลือกทีม</option>
                {teams.map((team) => (
                  <option key={team.name}>{team.name}</option>
                ))}
              </select>

              <label style={{ marginRight: "8px" }}>
                Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleNewRosterPhotoUpload}
                  style={{ marginLeft: "6px" }}
                />
              </label>

              {newRosterForm.photoUrl && (
                <span>
                  {renderPlayerAvatar(newRosterForm.photoUrl, 42)}
                  <button
                    onClick={() =>
                      setNewRosterForm({ ...newRosterForm, photoUrl: "" })
                    }
                    style={{ marginLeft: "6px" }}
                  >
                    Remove Photo
                  </button>
                </span>
              )}
            </div>

            <div style={{ marginBottom: "16px" }}>
              {[
                ["เลี้ยง", "dribbling"],
                ["วงใน", "insideScoring"],
                ["ยิง", "shooting"],
                ["ป้องกัน", "defense"],
                ["จ่ายบอล", "passing"],
              ].map(([label, key]) => (
                <label key={key} style={{ marginRight: "8px" }}>
                  {label}
                  <input
                    type="number"
                    min="1"
                    max="5"
                    style={{ width: "50px", marginLeft: "4px" }}
                    value={newRosterForm[key]}
                    onChange={(e) =>
                      setNewRosterForm({
                        ...newRosterForm,
                        [key]: Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}

              <button onClick={createNewPlayerToTeam}>Create & Add</button>
            </div>

            <h3>Team Roster</h3>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {teams.map((team) => (
                <div
                  key={`roster-${team.name}`}
                  style={{
                    border: "1px solid #aaa",
                    padding: "12px",
                    minWidth: "320px",
                  }}
                >
                  <h4>{team.name}</h4>

                  {team.players.length === 0 ? (
                    <p>ยังไม่มีผู้เล่นในทีม</p>
                  ) : (
                    <table border="1" cellPadding="6" cellSpacing="0">
                      <thead>
                        <tr>
                          <th>Photo</th>
                          <th>Player</th>
                          <th>Move</th>
                          <th>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.players.map((player) => (
                          <tr key={player.id}>
                            <td>
                              {renderPlayerAvatar(
                                player.photoUrl || getPlayerPhotoUrl(player.id),
                                34,
                              )}
                            </td>
                            <td>
                              {player.name} | {player.tier} | {player.rating}
                            </td>
                            <td>
                              <select
                                value={team.name}
                                onChange={(e) =>
                                  movePlayerToTeam(player.id, e.target.value)
                                }
                              >
                                {teams.map((targetTeam) => (
                                  <option key={targetTeam.name}>
                                    {targetTeam.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <button
                                onClick={() => removePlayerFromTeam(player.id)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      <SchedulePanel
        activeAdminMenu={activeAdminMenu}
        adminAccordionStyle={adminAccordionStyle}
        adminAccordionSummaryStyle={adminAccordionSummaryStyle}
        adminAccordionHintStyle={adminAccordionHintStyle}
        teams={teams}
        schedule={schedule}
        createSchedule={createSchedule}
        updatePlayoffTeams={updatePlayoffTeams}
        clearSchedule={clearSchedule}
        updateMatchScore={updateMatchScore}
        finishMatch={finishMatch}
        renderTeamWithLogo={renderTeamWithLogo}
        setSelectedRosterMatchId={setSelectedRosterMatchId}
        setSelectedStatsMatchId={setSelectedStatsMatchId}
        getMatchScoreSyncInfo={getMatchScoreSyncInfo}
      />

      <MatchRosterModal
        isOpen={Boolean(selectedRosterMatch)}
        selectedMatch={selectedRosterMatch}
        adminAccordionStyle={adminAccordionStyle}
        adminAccordionSummaryStyle={adminAccordionSummaryStyle}
        adminAccordionHintStyle={adminAccordionHintStyle}
        getMatchRoster={getMatchRoster}
        getSideTeamName={getSideTeamName}
        getTeamPlayers={getTeamPlayers}
        getLoanCandidates={getLoanCandidates}
        toggleActivePlayer={toggleActivePlayer}
        loanForm={loanForm}
        setLoanForm={setLoanForm}
        addLoanPlayerToMatch={addLoanPlayerToMatch}
        removeLoanPlayerFromMatch={removeLoanPlayerFromMatch}
        saveMatchRoster={saveMatchRoster}
        clearMatchRoster={clearMatchRoster}
        onClose={() => setSelectedRosterMatchId("")}
        renderTeamWithLogo={renderTeamWithLogo}
        renderPlayerAvatar={renderPlayerAvatar}
        getPlayerPhotoUrl={getPlayerPhotoUrl}
      />

      <MatchStatsModal
        isOpen={Boolean(selectedStatsMatch)}
        selectedMatch={selectedStatsMatch}
        adminAccordionStyle={adminAccordionStyle}
        adminAccordionSummaryStyle={adminAccordionSummaryStyle}
        adminAccordionHintStyle={adminAccordionHintStyle}
        getAllStatRowsForMatch={getAllStatRowsForMatch}
        statFields={statFields}
        getStatInputValue={getStatInputValue}
        updateMatchStatInput={updateMatchStatInput}
        saveMatchStats={saveMatchStats}
        onClose={() => setSelectedStatsMatchId("")}
      />

      {activeAdminMenu === "stats" && (
        <div
          style={{
            ...adminAccordionStyle,
            padding: "16px",
            background: "#f8fafc",
          }}
        >
          <h2 style={{ marginTop: 0 }}>📊 Stats Center</h2>
          <p style={{ color: "#555", marginBottom: 0 }}>
            สรุปสถิติผู้เล่น MVP Ranking, Player Profile และ Stat Leaders
            อยู่ในแท็บนี้ ส่วนการกรอกคะแนน/Match Roster ยังอยู่ใน 📅 Schedule
          </p>
          {getPlayerStatRows().length === 0 && (
            <p style={{ marginBottom: 0 }}>
              ยังไม่มีสถิติผู้เล่น ให้ไปที่ 📅 Schedule แล้วกด Enter Stats
              ของแมตช์ก่อน
            </p>
          )}
        </div>
      )}

      <MvpRankingPanel
        activeAdminMenu={activeAdminMenu}
        adminAccordionStyle={adminAccordionStyle}
        adminAccordionSummaryStyle={adminAccordionSummaryStyle}
        adminAccordionHintStyle={adminAccordionHintStyle}
        hasPlayerStats={getPlayerStatRows().length > 0}
        mvpRanking={getMVPRanking().slice(0, 10)}
        renderPlayerAvatar={renderPlayerAvatar}
        getPlayerPhotoUrl={getPlayerPhotoUrl}
        setSelectedProfilePlayerId={setSelectedProfilePlayerId}
        setActiveAdminMenu={setActiveAdminMenu}
      />
      {activeAdminMenu === "seasonAwards" && (
        <div
          style={{
            ...adminAccordionStyle,
            padding: "16px",
            background: "#fffdf5",
            border: "1px solid #facc15",
          }}
        >
          <h2 style={{ marginTop: 0 }}>🏆 Awards Center</h2>
          <p style={{ marginBottom: 0 }}>
            Current Awards คือรางวัลของ Season ปัจจุบัน ส่วน Hall Of Fame
            คือประวัติรางวัลจาก Season ที่ปิดแล้ว
          </p>
        </div>
      )}

      {getPlayerStatRows().length > 0 && (
        <details
          open
          style={{
            ...adminAccordionStyle,
            display: activeAdminMenu === "seasonAwards" ? "block" : "none",
          }}
        >
          <summary style={adminAccordionSummaryStyle}>
            <span>🏆 Current Season Awards</span>
            <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
          </summary>
          <div
            style={{
              marginTop: "32px",
              border: "2px solid #222",
              borderRadius: "12px",
              padding: "16px",
              background: "#fffdf5",
            }}
          >
            <h2>🏆 Current Season Awards</h2>
            <p>
              รางวัลของ Season ปัจจุบัน คำนวณจากผลการแข่งขัน Playoff
              และสถิติผู้เล่น
            </p>

            <div
              style={{
                border: "1px solid #facc15",
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "14px",
                background: "#fffbeb",
              }}
            >
              <h3 style={{ marginTop: 0 }}>🏅 Finals MVP</h3>
              <p style={{ marginTop: 0, color: "#555" }}>
                Regular Season MVP ใช้ Logic MVP Score เดิม ส่วน Finals MVP ให้
                Admin เลือกเองเพื่อสะท้อน Impact ในเกม Final
              </p>
              <select
                value={selectedFinalsMvpId}
                onChange={(event) => setSelectedFinalsMvpId(event.target.value)}
                style={{ width: "100%", maxWidth: "420px", padding: "8px" }}
              >
                <option value="">-- เลือก Finals MVP --</option>
                {getFinalsMvpOptions().map((player) => (
                  <option
                    key={`finals-mvp-option-${player.playerId}`}
                    value={player.playerId}
                  >
                    {player.playerName}
                    {player.teamName ? ` (${player.teamName})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const awards = getSeasonAwards();

              const awardCards = [
                {
                  title: "Regular Season MVP",
                  icon: "👑",
                  content: renderAwardPlayer(
                    awards.regularSeasonMvp,
                    "MVP Score",
                    awards.regularSeasonMvp
                      ? Number(awards.regularSeasonMvp.mvpScore || 0).toFixed(1)
                      : "-",
                  ),
                },
                {
                  title: "Finals MVP",
                  icon: "🏅",
                  content: awards.finalsMvp ? (
                    renderAwardPlayer(awards.finalsMvp, "Manual", "Selected")
                  ) : (
                    <span>ยังไม่ได้เลือก</span>
                  ),
                },
                {
                  title: "Scoring Champion",
                  icon: "🔥",
                  content: renderAwardPlayer(
                    awards.topScorer,
                    "PTS",
                    awards.topScorer?.pts || 0,
                  ),
                },
                {
                  title: "Rebound Leader",
                  icon: "💪",
                  content: renderAwardPlayer(
                    awards.reboundLeader,
                    "REB",
                    awards.reboundLeader?.reb || 0,
                  ),
                },
                {
                  title: "Assist Leader",
                  icon: "🎯",
                  content: renderAwardPlayer(
                    awards.assistLeader,
                    "AST",
                    awards.assistLeader?.ast || 0,
                  ),
                },
                {
                  title: "Steal Leader",
                  icon: "⚡",
                  content: renderAwardPlayer(
                    awards.stealLeader,
                    "STL",
                    awards.stealLeader?.stl || 0,
                  ),
                },
                {
                  title: "Block Leader",
                  icon: "🧱",
                  content: renderAwardPlayer(
                    awards.blockLeader,
                    "BLK",
                    awards.blockLeader?.blk || 0,
                  ),
                },
              ];

              return (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "12px",
                      marginBottom: "18px",
                    }}
                  >
                    <div
                      style={{
                        border: "1px solid #ddd",
                        padding: "12px",
                        background: "white",
                      }}
                    >
                      <h3>🥇 Champion</h3>
                      <div>
                        {awards.champion !== "-"
                          ? renderTeamWithLogo(awards.champion, 42)
                          : "ยังไม่จบ Final"}
                      </div>
                      <p style={{ marginBottom: 0 }}>
                        Final Score: {awards.finalScore}
                      </p>
                    </div>

                    <div
                      style={{
                        border: "1px solid #ddd",
                        padding: "12px",
                        background: "white",
                      }}
                    >
                      <h3>🥈 Runner Up</h3>
                      <div>
                        {awards.runnerUp !== "-"
                          ? renderTeamWithLogo(awards.runnerUp, 42)
                          : "ยังไม่จบ Final"}
                      </div>
                      <p style={{ marginBottom: 0 }}>
                        Final Score: {awards.finalScore}
                      </p>
                    </div>

                    <div
                      style={{
                        border: "1px solid #ddd",
                        padding: "12px",
                        background: "white",
                      }}
                    >
                      <h3>🥉 Third Place</h3>
                      <div>
                        {awards.thirdPlace !== "-"
                          ? renderTeamWithLogo(awards.thirdPlace, 42)
                          : "ยังไม่จบ 3rd Place / หรือไม่มีรอบนี้"}
                      </div>
                      <p style={{ marginBottom: 0 }}>
                        Score: {awards.thirdPlaceScore}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {awardCards.map((award) => (
                      <div
                        key={`season-award-${award.title}`}
                        style={{
                          border: "1px solid #ddd",
                          padding: "12px",
                          background: "white",
                        }}
                      >
                        <h3>
                          {award.icon} {award.title}
                        </h3>
                        <div>{award.content}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </details>
      )}

      <details
        open
        style={{
          ...adminAccordionStyle,
          display: activeAdminMenu === "seasonHistory" ? "block" : "none",
        }}
      >
        <summary style={adminAccordionSummaryStyle}>
          <span>🏛️ Season History</span>
          <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
        </summary>
        <div
          style={{
            marginTop: "32px",
            border: "2px solid #1b5e20",
            borderRadius: "12px",
            padding: "16px",
            background: "#f4fff4",
          }}
        >
          <h2>🏛️ Season History</h2>
          <p>
            ประวัติ Champion / Regular MVP / Finals MVP / Top Scorer
            ที่บันทึกจากการกด Close Season
          </p>

          {seasonHistory.length === 0 ? (
            <p>ยังไม่มี Season History</p>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <button
                  onClick={sortSeasonHistoryByCompetitionAndSeason}
                  style={{ color: "#1d4ed8" }}
                >
                  Sort by Type / Season
                </button>

                <button
                  onClick={clearSeasonHistory}
                  style={{ color: "#d32f2f" }}
                >
                  Clear Season History
                </button>
              </div>

              <p style={{ color: "#555", fontSize: "13px", marginTop: 0 }}>
                จัดลำดับ Season ได้เองด้วยปุ่ม Top / Up / Down / Bottom
                ลำดับนี้จะถูกใช้ทั้งใน Admin, Public Dashboard และรายการเลือก
                Season
              </p>

              {seasonHistory.map((season, index) => (
                <div
                  key={season.id}
                  style={{
                    border: "1px solid #c8e6c9",
                    borderRadius: "10px",
                    padding: "12px",
                    marginBottom: "12px",
                    background: "white",
                  }}
                >
                  <h3
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{getSeasonHistoryTitle(season)}</span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#555",
                        background: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        borderRadius: "999px",
                        padding: "4px 8px",
                      }}
                    >
                      Order #{index + 1}
                    </span>
                  </h3>
                  <p style={{ marginTop: 0 }}>
                    Type: {season.competitionType || "5X5"} | Season{" "}
                    {season.season} | Closed: {season.closedAtText || "-"}
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    <div>
                      🏆 Champion: <strong>{season.champion || "-"}</strong>
                    </div>
                    <div>
                      🥈 Runner Up: <strong>{season.runnerUp || "-"}</strong>
                    </div>
                    <div>
                      🥉 Third Place:{" "}
                      <strong>{season.thirdPlace || "-"}</strong>
                    </div>
                    <div>
                      👑 Regular MVP:{" "}
                      <strong>
                        {season.regularSeasonMvp || season.mvp || "-"}
                      </strong>
                    </div>
                    <div>
                      🏅 Finals MVP: <strong>{season.finalsMvp || "-"}</strong>
                    </div>
                    <div>
                      🔥 Top Scorer: <strong>{season.topScorer || "-"}</strong>{" "}
                      ({season.topScorerPts || 0} PTS)
                    </div>
                    <div>
                      💪 Rebound Leader:{" "}
                      <strong>{season.reboundLeader || "-"}</strong> (
                      {season.reboundLeaderReb || 0} REB)
                    </div>
                    <div>
                      🎯 Assist Leader:{" "}
                      <strong>{season.assistLeader || "-"}</strong> (
                      {season.assistLeaderAst || 0} AST)
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "10px",
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => moveSeasonHistoryToTop(season.id)}
                      disabled={index === 0}
                      title="ย้ายขึ้นบนสุด"
                    >
                      ⬆ Top
                    </button>

                    <button
                      onClick={() => moveSeasonHistoryItem(season.id, -1)}
                      disabled={index === 0}
                      title="เลื่อนขึ้น 1 ลำดับ"
                    >
                      ↑ Up
                    </button>

                    <button
                      onClick={() => moveSeasonHistoryItem(season.id, 1)}
                      disabled={index === seasonHistory.length - 1}
                      title="เลื่อนลง 1 ลำดับ"
                    >
                      ↓ Down
                    </button>

                    <button
                      onClick={() => moveSeasonHistoryToBottom(season.id)}
                      disabled={index === seasonHistory.length - 1}
                      title="ย้ายลงล่างสุด"
                    >
                      ⬇ Bottom
                    </button>

                    <button onClick={() => startEditSeasonHistoryItem(season)}>
                      ✏ Edit History
                    </button>

                    <button onClick={() => renameSeasonHistoryItem(season.id)}>
                      Rename Project
                    </button>

                    <button onClick={() => exportSeasonHistoryItem(season)}>
                      Export This Season
                    </button>

                    <button
                      onClick={() => deleteSeasonHistoryItem(season.id)}
                      style={{ color: "#d32f2f" }}
                    >
                      Delete Season Record
                    </button>
                  </div>

                  {editingSeasonHistoryId === season.id && (
                    <div
                      style={{
                        marginTop: "14px",
                        border: "1px solid #bfdbfe",
                        borderRadius: "10px",
                        padding: "12px",
                        background: "#eff6ff",
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>✏ Edit Season History</h4>
                      <p style={{ marginTop: 0, color: "#475569" }}>
                        แก้ไขข้อมูลย้อนหลังของ Season นี้ได้โดยไม่แตะ Match
                        Stats ดิบ เหมาะสำหรับเติมรางวัลหรือแก้ข้อมูลจาก Season
                        เก่า
                      </p>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: "10px",
                        }}
                      >
                        <label>
                          Project / Season Name
                          <input
                            value={seasonHistoryEditForm.projectName}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "projectName",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Competition Type
                          <select
                            value={seasonHistoryEditForm.competitionType}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "competitionType",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          >
                            <option value="3X3">3X3</option>
                            <option value="5X5">5X5</option>
                          </select>
                        </label>

                        <label>
                          Season Number
                          <input
                            type="number"
                            min="1"
                            value={seasonHistoryEditForm.season}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "season",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Closed At
                          <input
                            value={seasonHistoryEditForm.closedAtText}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "closedAtText",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Champion
                          <input
                            value={seasonHistoryEditForm.champion}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "champion",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Runner Up
                          <input
                            value={seasonHistoryEditForm.runnerUp}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "runnerUp",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Third Place
                          <input
                            value={seasonHistoryEditForm.thirdPlace}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "thirdPlace",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Regular Season MVP
                          <input
                            value={seasonHistoryEditForm.regularSeasonMvp}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "regularSeasonMvp",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Finals MVP
                          <input
                            value={seasonHistoryEditForm.finalsMvp}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "finalsMvp",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Top Scorer
                          <input
                            value={seasonHistoryEditForm.topScorer}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "topScorer",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Top Scorer PTS
                          <input
                            type="number"
                            min="0"
                            value={seasonHistoryEditForm.topScorerPts}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "topScorerPts",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Rebound Leader
                          <input
                            value={seasonHistoryEditForm.reboundLeader}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "reboundLeader",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Rebound Leader REB
                          <input
                            type="number"
                            min="0"
                            value={seasonHistoryEditForm.reboundLeaderReb}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "reboundLeaderReb",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Assist Leader
                          <input
                            value={seasonHistoryEditForm.assistLeader}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "assistLeader",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>

                        <label>
                          Assist Leader AST
                          <input
                            type="number"
                            min="0"
                            value={seasonHistoryEditForm.assistLeaderAst}
                            onChange={(event) =>
                              updateSeasonHistoryEditForm(
                                "assistLeaderAst",
                                event.target.value,
                              )
                            }
                            style={{ width: "100%", marginTop: "4px" }}
                          />
                        </label>
                      </div>

                      <label style={{ display: "block", marginTop: "10px" }}>
                        Season Notes
                        <textarea
                          value={seasonHistoryEditForm.notes}
                          onChange={(event) =>
                            updateSeasonHistoryEditForm(
                              "notes",
                              event.target.value,
                            )
                          }
                          rows={3}
                          style={{ width: "100%", marginTop: "4px" }}
                        />
                      </label>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          marginTop: "10px",
                        }}
                      >
                        <button onClick={saveSeasonHistoryEditForm}>
                          💾 Save History Edit
                        </button>
                        <button onClick={cancelEditSeasonHistoryItem}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </details>

      <details
        open
        style={{
          ...adminAccordionStyle,
          display: activeAdminMenu === "seasonAwards" ? "block" : "none",
        }}
      >
        <summary style={adminAccordionSummaryStyle}>
          <span>🏛️ Hall Of Fame</span>
          <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
        </summary>
        <div
          style={{
            marginTop: "32px",
            border: "2px solid #4a148c",
            borderRadius: "12px",
            padding: "16px",
            background: "#fbf5ff",
          }}
        >
          <h2>🏛️ Hall Of Fame</h2>
          <p>
            คลังรางวัลย้อนหลังจาก Season ที่กด Close Season แล้ว สามารถกรองแยก
            3X3 / 5X5 ได้
          </p>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ marginRight: "8px", fontWeight: "bold" }}>
              Filter:
            </label>
            <select
              value={hallOfFameFilter}
              onChange={(e) => setHallOfFameFilter(e.target.value)}
            >
              <option value="ALL">ALL</option>
              <option value="3X3">3X3</option>
              <option value="5X5">5X5</option>
            </select>
          </div>

          {seasonHistory.length > 0 &&
            (() => {
              const careerRows = buildPlayerCareerData();
              const pointLeaders = getCareerLeaderRows(careerRows, "pts", 5);
              const reboundLeaders = getCareerLeaderRows(careerRows, "reb", 5);
              const assistLeaders = getCareerLeaderRows(careerRows, "ast", 5);

              return (
                <div
                  style={{
                    border: "2px solid #111827",
                    borderRadius: "16px",
                    padding: "16px",
                    background: "#ffffff",
                    marginBottom: "18px",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>🐐 Player Career Engine</h3>
                  <p style={{ color: "#555", marginTop: 0 }}>
                    ระบบนี้ยึด Player เป็นศูนย์กลาง เพราะ BAM
                    มีการเปลี่ยนทีมทุกปี จึงตัด Franchise History และ Coach
                    Career ออก แล้วใช้ Season History เป็น Source of Truth
                    เพื่อสร้าง Career / Legacy / All-Time Leaders ใหม่อัตโนมัติ
                  </p>

                  {careerRows.length === 0 ? (
                    <p>ยังไม่มีข้อมูล Career จาก Season History</p>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(240px, 1fr))",
                          gap: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        {careerRows.slice(0, 6).map((career, index) => (
                          <div
                            key={`career-card-${career.key}`}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "14px",
                              padding: "12px",
                              background: index === 0 ? "#fff7ed" : "#f8fafc",
                            }}
                          >
                            <div style={{ fontSize: "12px", color: "#64748b" }}>
                              GOAT Rank #{index + 1}
                            </div>
                            <h4 style={{ margin: "4px 0" }}>
                              {index === 0 ? "👑 " : "🏀 "}
                              {career.playerName}
                            </h4>
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: "800",
                                marginBottom: "8px",
                              }}
                            >
                              Legacy {career.legacyScore}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "6px",
                                flexWrap: "wrap",
                                marginBottom: "8px",
                              }}
                            >
                              {renderCareerBadge(
                                "🏆",
                                "Champion",
                                career.awards.champion.total,
                              )}
                              {renderCareerBadge(
                                "👑",
                                "Reg MVP",
                                career.awards.regularSeasonMvp.total,
                              )}
                              {renderCareerBadge(
                                "🏅",
                                "Finals MVP",
                                career.awards.finalsMvp.total,
                              )}
                              {renderCareerBadge(
                                "🎯",
                                "Top Scorer",
                                career.awards.topScorer.total,
                              )}
                            </div>
                            <div style={{ color: "#475569", fontSize: "13px" }}>
                              Seasons: {career.seasonCount} | Games:{" "}
                              {career.stats.games} | PTS: {career.stats.pts} |
                              PPG: {career.ppg}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: "12px",
                            padding: "12px",
                          }}
                        >
                          <h4>🔥 All-Time Points</h4>
                          {renderCareerLeaderList(pointLeaders, "pts", " PTS")}
                        </div>
                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: "12px",
                            padding: "12px",
                          }}
                        >
                          <h4>💪 All-Time Rebounds</h4>
                          {renderCareerLeaderList(
                            reboundLeaders,
                            "reb",
                            " REB",
                          )}
                        </div>
                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: "12px",
                            padding: "12px",
                          }}
                        >
                          <h4>🎯 All-Time Assists</h4>
                          {renderCareerLeaderList(assistLeaders, "ast", " AST")}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

          {seasonHistory.length === 0 ? (
            <p>ยังไม่มี Season History สำหรับสร้าง Hall Of Fame</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              <div
                style={{
                  border: "1px solid #e1bee7",
                  borderRadius: "10px",
                  padding: "12px",
                  background: "white",
                }}
              >
                <h3>🏆 Champions</h3>
                {renderHallOfFameList(hallOfFame.champions)}
              </div>

              <div
                style={{
                  border: "1px solid #e1bee7",
                  borderRadius: "10px",
                  padding: "12px",
                  background: "white",
                }}
              >
                <h3>🥈 Runner Up</h3>
                {renderHallOfFameList(hallOfFame.runnerUps)}
              </div>

              <div
                style={{
                  border: "1px solid #e1bee7",
                  borderRadius: "10px",
                  padding: "12px",
                  background: "white",
                }}
              >
                <h3>🥉 Third Place</h3>
                {renderHallOfFameList(hallOfFame.thirdPlaces)}
              </div>

              <div
                style={{
                  border: "1px solid #e1bee7",
                  borderRadius: "10px",
                  padding: "12px",
                  background: "white",
                }}
              >
                <h3>👑 Regular MVP</h3>
                {renderHallOfFameList(
                  hallOfFame.regularSeasonMvps || hallOfFame.mvps,
                )}
              </div>

              <div
                style={{
                  border: "1px solid #e1bee7",
                  borderRadius: "10px",
                  padding: "12px",
                  background: "white",
                }}
              >
                <h3>🏅 Finals MVP</h3>
                {renderHallOfFameList(hallOfFame.finalsMvps)}
              </div>

              <div
                style={{
                  border: "1px solid #e1bee7",
                  borderRadius: "10px",
                  padding: "12px",
                  background: "white",
                }}
              >
                <h3>🔥 Top Scorer</h3>
                {renderHallOfFameList(hallOfFame.topScorers)}
              </div>

              <div
                style={{
                  border: "1px solid #e1bee7",
                  borderRadius: "10px",
                  padding: "12px",
                  background: "white",
                }}
              >
                <h3>💪 Rebound Leader</h3>
                {renderHallOfFameList(hallOfFame.reboundLeaders)}
              </div>

              <div
                style={{
                  border: "1px solid #e1bee7",
                  borderRadius: "10px",
                  padding: "12px",
                  background: "white",
                }}
              >
                <h3>🎯 Assist Leader</h3>
                {renderHallOfFameList(hallOfFame.assistLeaders)}
              </div>
            </div>
          )}
        </div>
      </details>

      {false && getPlayerStatRows().length > 0 && (
        <details
          open
          style={{
            ...adminAccordionStyle,
            display: activeAdminMenu === "stats" ? "block" : "none",
          }}
        >
          <summary style={adminAccordionSummaryStyle}>
            <span>👤 Player Profile Card</span>
            <span style={adminAccordionHintStyle}>กดเพื่อเปิด / ปิด</span>
          </summary>
          <div style={{ marginTop: "32px" }}>
            <h2>Player Profile Card</h2>

            <select
              value={selectedProfilePlayerId}
              onChange={(e) => setSelectedProfilePlayerId(e.target.value)}
              style={{ marginBottom: "16px", marginRight: "8px" }}
            >
              <option value="">เลือกผู้เล่น</option>
              {getPlayerStatRows()
                .sort((a, b) =>
                  String(a.playerName).localeCompare(String(b.playerName)),
                )
                .map((stat) => (
                  <option
                    key={`profile-option-${stat.playerId}`}
                    value={stat.playerId}
                  >
                    {stat.playerName}{" "}
                    {stat.teamName ? `(${stat.teamName})` : ""}
                  </option>
                ))}
            </select>

            {selectedProfilePlayerId &&
              getSelectedPlayerProfile() &&
              (() => {
                const profile = getSelectedPlayerProfile();
                const selectedSeasonForProfile = publicProfileSeasonContext
      ? seasonHistory.find(
          (season) =>
            String(season.id) === String(publicProfileSeasonContext.seasonId),
        )
      : null;
    const matchLogs = getPlayerMatchLog(
      profile,
      selectedSeasonForProfile?.archivedData?.schedule || schedule,
    );

                return (
                  <div
                    style={{
                      border: "2px solid #222",
                      padding: "16px",
                      maxWidth: "980px",
                      background: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      {renderPlayerAvatar(
                        getPlayerPhotoUrl(profile.playerId),
                        96,
                      )}
                      <div>
                        <h3 style={{ marginBottom: "6px" }}>
                          🏀 {profile.playerName}
                        </h3>
                        <div>
                          {profile.teamName
                            ? renderTeamWithLogo(profile.teamName, 40)
                            : "-"}
                        </div>
                      </div>
                    </div>
                    <p>
                      <strong>Team:</strong> {profile.teamName || "-"} |{" "}
                      <strong>MVP Score:</strong>{" "}
                      {Number(profile.mvpScore || 0).toFixed(1)}
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(110px, 1fr))",
                        gap: "8px",
                        marginBottom: "16px",
                      }}
                    >
                      {[
                        ["Games", profile.games || 0],
                        ["Appear", profile.appearances || 0],
                        ["PTS", profile.pts || 0],
                        ["REB", profile.reb || 0],
                        ["AST", profile.ast || 0],
                        ["STL", profile.stl || 0],
                        ["BLK", profile.blk || 0],
                        ["PPG", profile.ppg || "0.0"],
                      ].map(([label, value]) => (
                        <div
                          key={`profile-stat-${label}`}
                          style={{
                            border: "1px solid #ccc",
                            padding: "8px",
                            background: "white",
                          }}
                        >
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            {label}
                          </div>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>

                    <h4>Match Log</h4>
                    {matchLogs.length === 0 ? (
                      <p>ยังไม่มี Match Log</p>
                    ) : (
                      <table border="1" cellPadding="8" cellSpacing="0">
                        <thead>
                          <tr>
                            <th>Week</th>
                            <th>Round</th>
                            <th>Opponent</th>
                            <th>Status</th>
                            <th>Score</th>
                            <th>Result</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>STL</th>
                            <th>BLK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchLogs.map((log) => (
                            <tr
                              key={`profile-log-${profile.playerId}-${log.matchId}`}
                            >
                              <td>{log.week}</td>
                              <td>{log.label}</td>
                              <td>{log.opponent}</td>
                              <td>{log.status}</td>
                              <td>{log.score}</td>
                              <td>{log.appearance ? "Played" : "DNP"}</td>
                              <td>{log.appearance ? log.pts : "-"}</td>
                              <td>{log.appearance ? log.reb : "-"}</td>
                              <td>{log.appearance ? log.ast : "-"}</td>
                              <td>{log.appearance ? log.stl : "-"}</td>
                              <td>{log.appearance ? log.blk : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })()}
          </div>
        </details>
      )}

      <PlayerStatLeadersPanel
        activeAdminMenu={activeAdminMenu}
        adminAccordionStyle={adminAccordionStyle}
        adminAccordionSummaryStyle={adminAccordionSummaryStyle}
        adminAccordionHintStyle={adminAccordionHintStyle}
        hasPlayerStats={getPlayerStatRows().length > 0}
        statLeaderBoards={statLeaderBoards}
        clearPlayerStats={clearPlayerStats}
        setSelectedProfilePlayerId={setSelectedProfilePlayerId}
        setActiveAdminMenu={setActiveAdminMenu}
      />
      <StandingsPanel
        activeAdminMenu={activeAdminMenu}
        adminAccordionStyle={adminAccordionStyle}
        adminAccordionSummaryStyle={adminAccordionSummaryStyle}
        adminAccordionHintStyle={adminAccordionHintStyle}
        standings={standings}
        renderTeamLogo={renderTeamLogo}
      />

      <DraftHistory
        activeAdminMenu={activeAdminMenu}
        adminAccordionStyle={adminAccordionStyle}
        adminAccordionSummaryStyle={adminAccordionSummaryStyle}
        adminAccordionHintStyle={adminAccordionHintStyle}
        drafts={drafts}
        clearAllDrafts={clearAllDrafts}
        loadDraft={loadDraft}
        renameDraft={renameDraft}
        deleteDraft={deleteDraft}
      />

      {renderPlayerProfileModal()}
    </div>
  );
}

export default Players;
