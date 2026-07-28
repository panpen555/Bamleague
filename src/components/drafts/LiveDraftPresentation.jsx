import React, { useEffect, useRef, useState } from "react";

const AUTO_PLAY_DELAY_MS = 3000;

function LiveDraftPresentation({
  open,
  openMode,
  session,
  sourceChanged,
  onClose,
  onConfirm,
  onStartSchedule,
  hasScheduleSession,
  onBackToSchedule,
  onReplay,
  onCreateNew,
  isFullscreen,
  onEnterFullscreen,
  onExitFullscreen,
}) {
  const timerRef = useRef(null);
  const [revealIndex, setRevealIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);

  const revealOrder = session?.revealOrder || [];
  const revealCount = Math.max(0, revealIndex + 1);
  const revealComplete =
    revealOrder.length > 0 && revealCount >= revealOrder.length;
  const currentPick =
    revealIndex >= 0 ? revealOrder[revealIndex] || null : null;
  const currentTeam = currentPick
    ? session?.teams.find((team) => team.teamId === currentPick.teamId)
    : null;
  const currentPlayer = currentPick
    ? currentTeam?.players.find(
        (player) => String(player.id) === String(currentPick.playerId),
      )
    : null;
  const currentRound =
    currentPick?.round || (revealComplete ? session?.roundCount || 0 : 1);
  const isConfirmed = session?.status === "confirmed";
  const status = isConfirmed
    ? revealComplete
      ? "Confirmed"
      : revealIndex >= 0
        ? "Replay"
        : "Ready"
    : revealComplete
      ? "Completed"
      : revealIndex >= 0
        ? "Live"
        : "Ready";

  const clearAutoPlayTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const pause = () => {
    clearAutoPlayTimer();
    setIsPlaying(false);
  };

  const revealNext = () => {
    setRevealIndex((previousIndex) =>
      Math.min(previousIndex + 1, revealOrder.length - 1),
    );
  };

  const handleClose = async () => {
    pause();
    await onExitFullscreen();
    onClose();
  };

  const switchPresentation = (callback) => {
    pause();
    callback();
  };

  const restartPresentation = () => {
    pause();
    setRevealIndex(-1);
  };

  const handleConfirm = () => {
    pause();
    onConfirm();
  };

  useEffect(() => {
    setRevealIndex(-1);
    setIsPlaying(false);
    setSkipAnimation(false);
    clearAutoPlayTimer();
  }, [session?.sessionId]);

  useEffect(() => {
    if (openMode !== "replay") return;
    pause();
    setRevealIndex(-1);
  }, [session?.replayVersion]);

  useEffect(() => {
    if (!open) {
      pause();
      return;
    }

    pause();
    if (openMode === "results") {
      setRevealIndex(revealOrder.length - 1);
    } else if (openMode === "replay") {
      setRevealIndex(-1);
    }
  }, [open, openMode, session?.sessionId]);

  useEffect(() => {
    if (!open || !isPlaying || revealComplete) {
      clearAutoPlayTimer();
      if (revealComplete) {
        setIsPlaying(false);
      }
      return undefined;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      revealNext();
    }, AUTO_PLAY_DELAY_MS);

    return clearAutoPlayTimer;
  }, [
    open,
    isPlaying,
    revealIndex,
    revealComplete,
    session?.sessionId,
    session?.replayVersion,
  ]);

  if (!session) return null;

  const revealedPlayerIds = new Set(
    revealOrder
      .slice(0, revealCount)
      .map((pick) => `${pick.teamId}:${String(pick.playerId)}`),
  );

  return (
    <div
      className={`bam-live-draft ${open ? "bam-live-draft-open" : ""} ${
        skipAnimation ? "bam-live-draft-skip-animation" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="BAM League Live Draft Presentation"
      aria-hidden={!open}
    >
      <header className="bam-live-draft-header">
        <div>
          <div className="bam-live-draft-kicker">BAM LEAGUE LIVE DRAFT</div>
          <h1>{session.seasonTitle}</h1>
          <div className="bam-live-draft-meta">
            {session.competitionType} · Round {currentRound} ·{" "}
            {revealCount}/{revealOrder.length}
          </div>
        </div>
        <div className={`bam-live-draft-status bam-live-draft-status-${status.toLowerCase()}`}>
          {status}
        </div>
      </header>

      <main className="bam-live-draft-layout">
        <section className="bam-live-draft-stage" aria-live="polite">
          {currentPlayer && currentTeam ? (
            <div
              key={`${session.sessionId}-${revealIndex}`}
              className="bam-live-draft-reveal"
            >
              <div className="bam-live-draft-team-lockup">
                {currentTeam.teamLogo ? (
                  <img src={currentTeam.teamLogo} alt="" />
                ) : (
                  <span aria-hidden="true">🛡️</span>
                )}
                <strong>{currentTeam.teamName}</strong>
              </div>
              <div className="bam-live-draft-player-card">
                <div className="bam-live-draft-player-photo">
                  {currentPlayer.photoUrl ? (
                    <img src={currentPlayer.photoUrl} alt={currentPlayer.name} />
                  ) : (
                    <span aria-hidden="true">🏀</span>
                  )}
                </div>
                <div className="bam-live-draft-pick-label">
                  ROUND {currentPick.round} · {currentTeam.teamName}
                </div>
                <h2>{currentPlayer.name}</h2>
                {currentPlayer.bamPlayerId && (
                  <div className="bam-live-draft-player-id">
                    {currentPlayer.bamPlayerId}
                  </div>
                )}
                <div className="bam-live-draft-player-badges">
                  <span>
                    {currentPlayer.pos1}
                    {currentPlayer.pos2 ? ` / ${currentPlayer.pos2}` : ""}
                  </span>
                  <span>Tier {currentPlayer.tier}</span>
                  <span>Rating {currentPlayer.rating}</span>
                  {currentPlayer.lockedGroupName && (
                    <span>🔒 {currentPlayer.lockedGroupName}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bam-live-draft-ready">
              <span aria-hidden="true">🏀</span>
              <h2>Draft result locked</h2>
              <p>กด Reveal Next หรือ Auto Play เพื่อเริ่มการเปิดตัวผู้เล่น</p>
            </div>
          )}
        </section>

        <aside className="bam-live-draft-rosters">
          <h2>{revealComplete ? "Final Rosters" : "Live Team Boards"}</h2>
          <div className="bam-live-draft-roster-grid">
            {session.teams.map((team) => (
              <section key={team.teamId} className="bam-live-draft-roster-card">
                <header>
                  {team.teamLogo ? (
                    <img src={team.teamLogo} alt="" />
                  ) : (
                    <span aria-hidden="true">🛡️</span>
                  )}
                  <div>
                    <strong>{team.teamName}</strong>
                    <small>{team.totalScore} pts</small>
                  </div>
                </header>
                <ol>
                  {team.players.map((player) => {
                    const isRevealed =
                      revealComplete ||
                      revealedPlayerIds.has(
                        `${team.teamId}:${String(player.id)}`,
                      );
                    return (
                      <li key={player.id} className={isRevealed ? "is-revealed" : ""}>
                        <span>{isRevealed ? player.name : "???"}</span>
                        <small>
                          {isRevealed
                            ? `${player.pos1}${player.pos2 ? `/${player.pos2}` : ""} · ${player.tier}`
                            : "Awaiting reveal"}
                        </small>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </aside>
      </main>

      {sourceChanged && !isConfirmed && (
        <div className="bam-live-draft-source-warning" role="alert">
          ข้อมูลต้นทางเปลี่ยนแล้ว กรุณาปิด session และ Start Live Draft ใหม่
        </div>
      )}

      <footer className="bam-live-draft-controls">
        <button
          type="button"
          onClick={revealNext}
          disabled={revealComplete}
        >
          Reveal Next
        </button>
        {!isPlaying ? (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            disabled={revealComplete}
          >
            Auto Play
          </button>
        ) : (
          <button type="button" onClick={pause}>Pause</button>
        )}
        <button
          type="button"
          onClick={() => setSkipAnimation((value) => !value)}
          aria-pressed={skipAnimation}
        >
          {skipAnimation ? "Enable Animation" : "Skip Animation"}
        </button>
        <button
          type="button"
          onClick={restartPresentation}
        >
          Restart Draft Presentation
        </button>
        <button
          type="button"
          onClick={isFullscreen ? onExitFullscreen : onEnterFullscreen}
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
        <button type="button" onClick={handleClose}>Exit Presentation</button>
        {isConfirmed && (
          <>
            <button type="button" onClick={onReplay}>
              Replay Confirmed Draft
            </button>
            {hasScheduleSession ? (
              <button
                type="button"
                onClick={() => switchPresentation(onBackToSchedule)}
              >
                Back to Schedule Draw
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchPresentation(onStartSchedule)}
              >
                Start New Schedule Draw
              </button>
            )}
            <button type="button" onClick={onCreateNew}>
              Create New Live Draft
            </button>
          </>
        )}
        <button
          type="button"
          className="bam-live-draft-confirm"
          onClick={handleConfirm}
          disabled={
            !revealComplete ||
            sourceChanged ||
            isConfirmed
          }
        >
          {isConfirmed
            ? "Already Confirmed"
            : "Confirm Draft Results"}
        </button>
      </footer>
    </div>
  );
}

export default LiveDraftPresentation;
