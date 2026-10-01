import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  buildPostseasonBracketModel,
  buildWeeklyStandingsSnapshots,
  getWeekStatus,
  groupRegularScheduleByWeek,
  splitPublicScheduleByPhase,
} from "../../services/schedule/publicSchedulePresentationService";

const getWinner = (match) => {
  if (
    match.status !== "Finished" ||
    match.scoreA === "" ||
    match.scoreB === ""
  ) {
    return "";
  }
  const scoreA = Number(match.scoreA);
  const scoreB = Number(match.scoreB);
  if (scoreA > scoreB) return match.teamA;
  if (scoreB > scoreA) return match.teamB;
  return "DRAW";
};

const getMovement = (snapshot, teamName) => {
  if (!snapshot?.available) return null;
  const movement = snapshot.movementByTeam?.[teamName];
  if (movement === "up") return { symbol: "▲", label: "Up" };
  if (movement === "down") return { symbol: "▼", label: "Down" };
  if (movement === "same") return { symbol: "—", label: "Same" };
  return { symbol: "NEW", label: "New" };
};

const TeamLine = ({ match, side, snapshot, renderTeam }) => {
  const teamName = match[side];
  const score = side === "teamA" ? match.scoreA : match.scoreB;
  const rank = snapshot?.available ? snapshot.rankByTeam?.[teamName] : null;
  const movement = getMovement(snapshot, teamName);
  const winner = getWinner(match);
  const isWinner = winner === teamName;
  const source = match.sources?.find((item) => item.side === side)?.source;
  const showBestLoser =
    source?.type === "bestLoser" && Boolean(source.selectedTeam);
  const displayTeamName =
    teamName && teamName !== "TBD"
      ? teamName
      : source?.type === "winner" || source?.type === "loser"
        ? `${source.type === "winner" ? "Winner" : "Loser"} ${source.matchId}`
        : source?.type === "bestLoser"
          ? "Best Loser"
          : source?.type === "seed"
            ? `Seed ${source.seed}`
            : "TBD";

  return (
    <div
      className={`bam-public-fixture-team${
        isWinner ? " bam-public-fixture-team-winner" : ""
      }`}
    >
      {snapshot ? (
        <span className="bam-public-fixture-rank" aria-label={rank ? `Rank ${rank}` : "Rank pending"}>
          {rank || "–"}
        </span>
      ) : null}
      <span className="bam-public-fixture-team-name">
        {renderTeam(displayTeamName, 28)}
        {source?.type === "seed" ? (
          <span className="bam-public-seed-badge">SEED {source.seed}</span>
        ) : null}
        {showBestLoser ? (
          <span className="bam-public-best-loser-badge">BEST LOSER</span>
        ) : null}
      </span>
      {movement ? (
        <span className={`bam-public-rank-movement bam-public-rank-movement-${movement.label.toLowerCase()}`}>
          {movement.symbol} {movement.label}
        </span>
      ) : null}
      <strong className="bam-public-fixture-score">
        {score !== "" && score !== null && score !== undefined ? score : "–"}
      </strong>
    </div>
  );
};

const MatchButton = ({ match, snapshot, renderTeam, onOpenMatch, postseason = false, setCardRef }) => {
  const winner = getWinner(match);
  const finished = match.status === "Finished";
  return (
    <button
      type="button"
      ref={setCardRef}
      data-match-id={String(match.id)}
      className={`bam-public-fixture-card${
        finished ? " bam-public-fixture-card-finished" : " bam-public-fixture-card-pending"
      }${postseason ? " bam-public-bracket-match" : ""}${
        match.label === "Final" || match.playoffType === "final"
          ? " bam-public-bracket-match-final"
          : ""
      }`}
      onClick={() => onOpenMatch(match)}
      aria-label={`View match details: ${match.teamA} vs ${match.teamB}, Week ${match.week || "-"}`}
    >
      <span className="bam-public-fixture-meta">
        <span>#{match.displayOrder} · {match.label || "League"}</span>
        <span className={`bam-public-fixture-status bam-public-fixture-status-${finished ? "finished" : "pending"}`}>
          {finished ? "Finished" : "Pending"}
        </span>
      </span>
      <TeamLine match={match} side="teamA" snapshot={snapshot} renderTeam={renderTeam} />
      <TeamLine match={match} side="teamB" snapshot={snapshot} renderTeam={renderTeam} />
      {postseason && winner && winner !== "DRAW" ? (
        <span className="bam-public-bracket-winner">Winner: {winner}</span>
      ) : null}
      {postseason && (match.label === "Final" || match.playoffType === "final") && winner && winner !== "DRAW" ? (
        <span className="bam-public-champion-badge">CHAMPION</span>
      ) : null}
    </button>
  );
};

const BracketBoard = ({ model, renderTeam, onOpenMatch }) => {
  const canvasRef = useRef(null);
  const cardRefs = useRef(new Map());
  const [connectorLayout, setConnectorLayout] = useState({
    paths: [],
    width: 0,
    height: 0,
  });

  const setCardRef = useCallback((matchId) => (node) => {
    if (node) cardRefs.current.set(String(matchId), node);
    else cardRefs.current.delete(String(matchId));
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model.hasExplicitRelationships) {
      setConnectorLayout({ paths: [], width: 0, height: 0 });
      return undefined;
    }

    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const nextPaths = model.edges.flatMap((edge, index) => {
        const source = cardRefs.current.get(String(edge.fromMatchId));
        const target = cardRefs.current.get(String(edge.toMatchId));
        if (!source || !target) return [];
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const x1 = sourceRect.right - canvasRect.left;
        const y1 = sourceRect.top + sourceRect.height / 2 - canvasRect.top;
        const x2 = targetRect.left - canvasRect.left;
        const targetOffset = edge.toSide === "teamA" ? targetRect.height * 0.42 : targetRect.height * 0.72;
        const y2 = targetRect.top + targetOffset - canvasRect.top;
        const middleX = x1 + Math.max(24, (x2 - x1) / 2);
        return [{
          key: `${edge.fromMatchId}-${edge.toMatchId}-${edge.toSide}-${index}`,
          d: `M ${x1} ${y1} H ${middleX} V ${y2} H ${x2}`,
          type: edge.sourceType,
        }];
      });
      setConnectorLayout({
        paths: nextPaths,
        width: canvas.scrollWidth,
        height: canvas.scrollHeight,
      });
    };

    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (observer) observer.observe(canvas);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [model]);

  return (
    <div className="bam-public-bracket-scroll" aria-label="Postseason bracket">
      <p className="bam-public-bracket-scroll-hint">เลื่อนเพื่อดูสายการแข่งขัน →</p>
      <div
        ref={canvasRef}
        className={`bam-public-bracket-canvas${
          model.hasExplicitRelationships ? " bam-public-bracket-canvas-connected" : ""
        }`}
      >
        {model.hasExplicitRelationships ? (
          <svg
            className="bam-public-bracket-connectors"
            viewBox={`0 0 ${connectorLayout.width || 1} ${connectorLayout.height || 1}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {connectorLayout.paths.map((path) => (
              <path
                key={path.key}
                d={path.d}
                className={`bam-public-bracket-connector bam-public-bracket-connector-${path.type}`}
              />
            ))}
          </svg>
        ) : null}
        {model.phases.map((phase) => (
          <section
            key={phase.key}
            className={`bam-public-bracket-column${phase.isFinal ? " bam-public-bracket-column-final" : ""}${phase.isThirdPlace ? " bam-public-bracket-column-third" : ""}`}
          >
            <h4 className="bam-public-bracket-phase-title">{phase.label}</h4>
            <div className="bam-public-bracket-phase-matches">
              {phase.matches.map((match) => (
                <MatchButton
                  key={String(match.id)}
                  match={match}
                  renderTeam={renderTeam}
                  onOpenMatch={onOpenMatch}
                  postseason
                  setCardRef={setCardRef(match.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

const PublicScheduleBoard = ({ schedule, teams, seasonTitle, renderTeam, onOpenMatch }) => {
  const { regularMatches, postseasonMatches, unknownMatches } = splitPublicScheduleByPhase(schedule);
  const regularGroups = groupRegularScheduleByWeek(regularMatches);
  const snapshots = buildWeeklyStandingsSnapshots(regularMatches, teams);
  const bracket = buildPostseasonBracketModel(postseasonMatches);
  const validWeeks = regularGroups.filter((group) => !group.legacy).map((group) => group.week);

  return (
    <div className="bam-public-schedule-sections">
      {regularGroups.length > 0 ? (
        <section className="bam-public-panel bam-public-schedule-panel bam-public-regular-season">
          <header className="bam-public-schedule-section-header">
            <div>
              <span className="bam-public-section-kicker">REGULAR SEASON</span>
              <h2 className="bam-public-panel-title">{seasonTitle}</h2>
            </div>
            <div className="bam-public-schedule-summary">
              <span>{teams.length} Teams</span>
              <span>{new Set(validWeeks).size} Weeks</span>
            </div>
          </header>
          <div className="bam-public-week-list">
            {regularGroups.map((group) => {
              const snapshot = group.legacy ? null : snapshots.snapshotsByWeek[group.week];
              const status = getWeekStatus(group.matches, snapshot);
              return (
                <section key={group.key} className="bam-public-week-card">
                  <div className="bam-public-week-header">
                    <div>
                      <span className="bam-public-week-title">
                        {group.legacy ? "Legacy Schedule" : `WEEK ${group.week}`}
                      </span>
                      {!group.legacy ? (
                        <p className="bam-public-week-ranking-copy">
                          อันดับก่อนเริ่ม Week {group.week}
                        </p>
                      ) : null}
                    </div>
                    <span className="bam-public-week-status">{status}</span>
                  </div>
                  {!group.legacy && snapshot?.reason === "waiting-for-results" ? (
                    <p className="bam-public-week-waiting">
                      รอผล Week {snapshot.waitingForWeek} ให้ครบ
                    </p>
                  ) : !group.legacy && group.week > Math.min(...validWeeks) ? (
                    <p className="bam-public-week-caption">
                      คำนวณจากผลสะสมของ Week ที่แข่งขันจบก่อนหน้านี้
                    </p>
                  ) : null}
                  <div className="bam-public-match-list">
                    {group.matches.map((match) => (
                      <MatchButton
                        key={String(match.id)}
                        match={match}
                        snapshot={snapshot}
                        renderTeam={renderTeam}
                        onOpenMatch={onOpenMatch}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      ) : null}

      {postseasonMatches.length > 0 ? (
        <section className="bam-public-panel bam-public-schedule-panel bam-public-postseason">
          <header className="bam-public-schedule-section-header">
            <div>
              <span className="bam-public-section-kicker">POSTSEASON</span>
              <h2 className="bam-public-panel-title">ROAD TO THE CHAMPIONSHIP</h2>
            </div>
            <span className="bam-public-schedule-summary">{postseasonMatches.length} Matches</span>
          </header>
          <BracketBoard model={bracket} renderTeam={renderTeam} onOpenMatch={onOpenMatch} />
        </section>
      ) : null}

      {unknownMatches.length > 0 ? (
        <section className="bam-public-panel bam-public-schedule-panel">
          <h2 className="bam-public-panel-title">Schedule</h2>
          <div className="bam-public-match-list">
            {unknownMatches.map((match) => (
              <MatchButton key={String(match.id)} match={match} renderTeam={renderTeam} onOpenMatch={onOpenMatch} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default PublicScheduleBoard;

