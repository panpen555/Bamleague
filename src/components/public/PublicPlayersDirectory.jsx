import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  filterPublicPlayerDirectory,
  sortPublicPlayerDirectory,
} from "../../services/season/publicPlayerDirectoryService";

const SORT_OPTIONS = [
  ["mvp", "MVP Race"],
  ["pts", "PTS"],
  ["ppg", "PPG"],
  ["name", "Name A–Z"],
  ["team", "Team"],
];
const SKILLS = [
  ["dribbling", "Dribbling"],
  ["insideScoring", "Inside Scoring"],
  ["shooting", "Shooting"],
  ["defense", "Defense"],
  ["passing", "Passing"],
];
const STATS = [
  ["appearances", "Games"],
  ["pts", "PTS"],
  ["ppg", "PPG"],
  ["reb", "REB"],
  ["ast", "AST"],
  ["stl", "STL"],
  ["blk", "BLK"],
];

const comparableValue = (player, key, section) => {
  if (section === "skills") {
    const skillValue = player?.[key];
    return skillValue === null || skillValue === undefined || skillValue === ""
      ? null
      : Number(skillValue);
  }
  if (key === "mvpScore") return player?.regularSeasonMvpScore;
  if (key === "mvpRank") return player?.mvpRank;
  return Number(player?.stats?.[key] || 0);
};

function PublicPlayersDirectory({
  seasonKey,
  seasonTitle,
  directoryState,
  teamNames,
  renderPlayerAvatar,
  onOpenProfile,
}) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("mvp");
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectionMessage, setSelectionMessage] = useState("");
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const compareButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    setSearch("");
    setTeamFilter("ALL");
    setSortBy("mvp");
    setSelectedKeys([]);
    setSelectionMessage("");
    setIsComparisonOpen(false);
  }, [seasonKey]);

  useEffect(() => {
    if (!isComparisonOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsComparisonOpen(false);
        window.requestAnimationFrame(() => compareButtonRef.current?.focus());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isComparisonOpen]);

  const players = directoryState.players || [];
  const visiblePlayers = useMemo(
    () =>
      sortPublicPlayerDirectory(
        filterPublicPlayerDirectory(players, { search, team: teamFilter }),
        sortBy,
      ),
    [players, search, sortBy, teamFilter],
  );
  const selectedPlayers = selectedKeys
    .map((key) => players.find((player) => player.directoryKey === key))
    .filter(Boolean);

  const closeComparison = () => {
    setIsComparisonOpen(false);
    window.requestAnimationFrame(() => compareButtonRef.current?.focus());
  };
  const clearComparison = () => {
    setSelectedKeys([]);
    setSelectionMessage("");
    setIsComparisonOpen(false);
  };
  const togglePlayer = (player) => {
    setSelectionMessage("");
    setSelectedKeys((keys) => {
      if (keys.includes(player.directoryKey)) {
        return keys.filter((key) => key !== player.directoryKey);
      }
      if (keys.length >= 2) {
        setSelectionMessage("เลือกได้สูงสุด 2 คน กรุณานำผู้เล่นออกหนึ่งคนก่อน");
        return keys;
      }
      return [...keys, player.directoryKey];
    });
  };
  const openProfile = (player) => {
    setIsComparisonOpen(false);
    onOpenProfile(player.profileSource);
  };
  const identity = (player, size = 72) => (
    <>
      {renderPlayerAvatar(player.photoUrl || "", size)}
      <span className="bam-public-player-card-copy">
        <strong className="bam-public-player-card-name">{player.name}</strong>
        <span>{player.bamPlayerId || "No BAM Player ID"}</span>
        <span>{player.teamName || "No Team"}</span>
      </span>
    </>
  );

  const metric = (player, opponent, key, label, section) => {
    const value = comparableValue(player, key, section);
    const other = comparableValue(opponent, key, section);
    const unavailable = value === null || value === undefined;
    const higher =
      !unavailable &&
      other !== null &&
      other !== undefined &&
      (key === "mvpRank"
        ? Number(value) < Number(other)
        : Number(value) > Number(other));
    return (
      <div
        key={`${player.directoryKey}-${section}-${key}`}
        className={`bam-public-comparison-metric${
          higher ? " bam-public-comparison-metric-higher" : ""
        }`}
      >
        <span>{label}</span>
        <strong>{unavailable ? "N/A" : value}</strong>
        {higher ? <small>Higher</small> : null}
      </div>
    );
  };

  const comparisonCard = (player, opponent) => (
    <article
      key={`comparison-${player.directoryKey}`}
      className="bam-public-comparison-card"
    >
      <div className="bam-public-comparison-identity">
        {identity(player, 88)}
      </div>
      <div className="bam-public-comparison-meta">
        <span>
          POS {player.pos1 || "-"}
          {player.pos2 ? ` / ${player.pos2}` : ""}
        </span>
        <span>Tier {player.tier || "-"}</span>
        <span>Rating {player.rating ?? "-"}</span>
      </div>
      <section className="bam-public-comparison-section">
        <h4>Skill Ratings</h4>
        <div className="bam-public-comparison-metrics">
          {SKILLS.map(([key, label]) =>
            metric(player, opponent, key, label, "skills"),
          )}
        </div>
      </section>
      <section className="bam-public-comparison-section">
        <h4>Season Match Stats</h4>
        <div className="bam-public-comparison-metrics">
          {STATS.map(([key, label]) =>
            metric(player, opponent, key, label, "stats"),
          )}
          {metric(
            player,
            opponent,
            "mvpScore",
            "Regular Season MVP Score",
            "mvp",
          )}
          {metric(player, opponent, "mvpRank", "MVP Rank", "mvp")}
        </div>
      </section>
      <section className="bam-public-comparison-section">
        <h4>Season Awards</h4>
        <p>{player.awards.length ? player.awards.join(" · ") : "-"}</p>
      </section>
      <button
        type="button"
        className="bam-public-comparison-profile-button"
        onClick={() => openProfile(player)}
      >
        Open Full Player Profile
      </button>
    </article>
  );

  return (
    <section className="bam-public-panel bam-public-players-panel">
      <div className="bam-public-players-header">
        <div>
          <span className="bam-public-players-kicker">Season roster</span>
          <h2 className="bam-public-panel-title">👥 Players</h2>
          <p>{seasonTitle}</p>
        </div>
        <strong>
          {directoryState.available ? players.length : "N/A"} Players
        </strong>
      </div>

      {!directoryState.available ? (
        <div className="bam-public-empty-state bam-public-players-empty">
          <div className="bam-public-empty-icon">📋</div>
          <p>ไม่มีข้อมูลรายชื่อทีมสำหรับ Season นี้</p>
        </div>
      ) : players.length === 0 ? (
        <div className="bam-public-empty-state bam-public-players-empty">
          <div className="bam-public-empty-icon">🏀</div>
          <p>
            {teamNames.length === 0
              ? "ยังไม่มีการจัดทีมสำหรับ Season นี้"
              : "ยังไม่มีผู้เล่นในทีม"}
          </p>
        </div>
      ) : (
        <>
          <div className="bam-public-player-controls">
            <label className="bam-public-player-search">
              <span>Search</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, BAM Player ID or team"
              />
            </label>
            <label>
              <span>Team</span>
              <select
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
              >
                <option value="ALL">All Teams</option>
                {teamNames.map((teamName) => (
                  <option key={teamName} value={teamName}>
                    {teamName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                {SORT_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!players[0]?.regularSeasonAvailable ? (
            <p className="bam-public-player-notice">
              ข้อมูล Season นี้ไม่สามารถแยก Regular Season ออกจาก Postseason
              ได้ จึงไม่แสดง MVP Score และ Rank
            </p>
          ) : null}

          {visiblePlayers.length === 0 ? (
            <div className="bam-public-empty-state bam-public-players-empty">
              <p>ไม่พบผู้เล่นที่ตรงกับการค้นหา</p>
            </div>
          ) : (
            <div className="bam-public-player-grid">
              {visiblePlayers.map((player) => {
                const selected = selectedKeys.includes(player.directoryKey);
                return (
                  <article
                    key={player.directoryKey}
                    className={`bam-public-player-card${
                      selected ? " bam-public-player-card-selected" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="bam-public-player-card-profile"
                      onClick={() => onOpenProfile(player.profileSource)}
                      aria-label={`Open player profile: ${player.name}`}
                    >
                      <span className="bam-public-player-card-identity">
                        {identity(player)}
                      </span>
                      <div className="bam-public-player-card-rank">
                        {player.mvpRank
                          ? `MVP #${player.mvpRank}`
                          : "MVP Rank N/A"}
                      </div>
                      <div className="bam-public-player-card-stats">
                      <span>
                        <strong>{player.stats.appearances}</strong> GP
                      </span>
                      <span>
                        <strong>{player.stats.pts}</strong> PTS
                      </span>
                      <span>
                        <strong>{player.stats.ppg}</strong> PPG
                      </span>
                      <span>
                        <strong>
                          {player.regularSeasonMvpScore === null
                            ? "N/A"
                            : player.regularSeasonMvpScore.toFixed(1)}
                        </strong>{" "}
                        MVP
                      </span>
                      </div>
                      {!player.hasSeasonStats ? (
                        <p className="bam-public-player-no-stats">
                          ยังไม่มีสถิติ
                        </p>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className={`bam-public-compare-toggle${
                        selected ? " bam-public-compare-toggle-selected" : ""
                      }`}
                      onClick={() => togglePlayer(player)}
                      aria-pressed={selected}
                      aria-label={`${selected ? "Remove" : "Add"} ${
                        player.name
                      } ${selected ? "from" : "to"} comparison`}
                    >
                      {selected ? "✓ Selected" : "Compare"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {selectedPlayers.length > 0 ? (
        <div
          className="bam-public-comparison-tray"
          aria-label="Selected players for comparison"
        >
          <div className="bam-public-comparison-tray-players">
            {selectedPlayers.map((player) => (
              <span key={`tray-${player.directoryKey}`}>
                {renderPlayerAvatar(player.photoUrl || "", 36)}
                <strong>{player.name}</strong>
              </span>
            ))}
            {selectedPlayers.length < 2 ? (
              <em>Select one more player</em>
            ) : null}
          </div>
          <div className="bam-public-comparison-tray-actions">
            <button type="button" onClick={clearComparison}>
              Clear
            </button>
            <button
              ref={compareButtonRef}
              type="button"
              disabled={selectedPlayers.length !== 2}
              onClick={() => setIsComparisonOpen(true)}
            >
              Compare Players
            </button>
          </div>
          <p className="bam-public-comparison-message" aria-live="polite">
            {selectionMessage}
          </p>
        </div>
      ) : null}

      {isComparisonOpen && selectedPlayers.length === 2 ? (
        <div
          className="bam-public-comparison-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeComparison();
          }}
        >
          <div
            className="bam-public-comparison-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bam-public-comparison-title"
          >
            <div className="bam-public-comparison-header">
              <div>
                <span>Player Comparison</span>
                <h3 id="bam-public-comparison-title">{seasonTitle}</h3>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close player comparison"
                onClick={closeComparison}
              >
                ×
              </button>
            </div>
            <div className="bam-public-comparison-grid">
              {comparisonCard(selectedPlayers[0], selectedPlayers[1])}
              {comparisonCard(selectedPlayers[1], selectedPlayers[0])}
            </div>
            <div className="bam-public-comparison-footer">
              <button
                type="button"
                onClick={() =>
                  setSelectedKeys(([left, right]) => [right, left])
                }
              >
                Swap sides
              </button>
              <button type="button" onClick={clearComparison}>
                Clear selection
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default PublicPlayersDirectory;
