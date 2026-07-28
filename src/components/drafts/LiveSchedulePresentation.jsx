import React, { useEffect, useRef, useState } from "react";

const AUTO_DRAW_DELAY_MS = 3000;

function LiveSchedulePresentation({
  open,
  openMode,
  session,
  sourceChanged,
  onClose,
  onConfirm,
  onBackToDraft,
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
  const currentReveal =
    revealIndex >= 0 ? revealOrder[revealIndex] || null : null;
  const currentMatch = currentReveal
    ? session?.lockedSchedule.find(
        (match) => String(match.id) === String(currentReveal.matchId),
      )
    : null;
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

  const getTeam = (teamName) =>
    session?.teams.find((team) => team.teamName === teamName);

  const clearTimer = () => {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const pause = () => {
    clearTimer();
    setIsPlaying(false);
  };

  const drawNext = () => {
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

  const restart = () => {
    pause();
    setRevealIndex(-1);
  };

  const confirm = () => {
    pause();
    onConfirm();
  };

  useEffect(() => {
    setRevealIndex(-1);
    setIsPlaying(false);
    setSkipAnimation(false);
    clearTimer();
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
      clearTimer();
      if (revealComplete) setIsPlaying(false);
      return undefined;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      drawNext();
    }, AUTO_DRAW_DELAY_MS);

    return clearTimer;
  }, [
    open,
    isPlaying,
    revealIndex,
    revealComplete,
    session?.sessionId,
    session?.replayVersion,
  ]);

  if (!session) return null;

  const revealedMatchIds = new Set(
    revealOrder.slice(0, revealCount).map((item) => String(item.matchId)),
  );
  const weeks = [
    ...new Set(session.lockedSchedule.map((match) => match.week)),
  ].sort((a, b) => a - b);

  const renderTeam = (teamName) => {
    const team = getTeam(teamName);
    return (
      <div className="bam-live-schedule-team">
        {team?.teamLogo ? (
          <img src={team.teamLogo} alt="" />
        ) : (
          <span aria-hidden="true">🛡️</span>
        )}
        <strong>{teamName}</strong>
      </div>
    );
  };

  return (
    <div
      className={`bam-live-schedule ${
        open ? "bam-live-schedule-open" : ""
      } ${skipAnimation ? "bam-live-draft-skip-animation" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="BAM League Schedule Draw Presentation"
      aria-hidden={!open}
    >
      <header className="bam-live-draft-header">
        <div>
          <div className="bam-live-draft-kicker">
            BAM LEAGUE SCHEDULE DRAW
          </div>
          <h1>{session.seasonTitle}</h1>
          <div className="bam-live-draft-meta">
            {session.competitionType} · Week {currentMatch?.week || 1} ·{" "}
            {revealCount}/{revealOrder.length}
          </div>
        </div>
        <div
          className={`bam-live-draft-status bam-live-draft-status-${status.toLowerCase()}`}
        >
          {status}
        </div>
      </header>

      <main className="bam-live-schedule-layout">
        <section className="bam-live-schedule-stage" aria-live="polite">
          {currentMatch ? (
            <div
              key={`${session.sessionId}-${revealIndex}`}
              className="bam-live-schedule-matchup"
            >
              <div className="bam-live-schedule-round">
                WEEK {currentMatch.week} · MATCH {currentMatch.id}
              </div>
              <div className="bam-live-schedule-label">
                {currentMatch.label}
              </div>
              <div className="bam-live-schedule-versus">
                {renderTeam(currentMatch.teamA)}
                <div className="bam-live-schedule-vs">VS</div>
                {renderTeam(currentMatch.teamB)}
              </div>
              <div className="bam-live-schedule-pending">
                {currentMatch.status}
              </div>
            </div>
          ) : (
            <div className="bam-live-draft-ready">
              <span aria-hidden="true">📅</span>
              <h2>Schedule result locked</h2>
              <p>กด Draw Next Matchup หรือ Auto Draw เพื่อเริ่มจับคู่</p>
            </div>
          )}
        </section>

        <aside className="bam-live-schedule-board">
          <h2>{revealComplete ? "Final Schedule" : "Live Schedule Board"}</h2>
          {weeks.map((week) => (
            <section key={week} className="bam-live-schedule-week">
              <h3>Week {week}</h3>
              {session.lockedSchedule
                .filter((match) => match.week === week)
                .map((match) => {
                  const revealed =
                    revealComplete || revealedMatchIds.has(String(match.id));
                  return (
                    <div key={match.id} className={revealed ? "is-revealed" : ""}>
                      <small>{match.label} · Match {match.id}</small>
                      <strong>
                        {revealed
                          ? `${match.teamA} vs ${match.teamB}`
                          : "??? vs ???"}
                      </strong>
                    </div>
                  );
                })}
            </section>
          ))}
        </aside>
      </main>

      {sourceChanged && !isConfirmed && (
        <div className="bam-live-draft-source-warning" role="alert">
          ข้อมูลทีมต้นทางเปลี่ยนแล้ว กรุณาปิด session และ Start Schedule Draw
          ใหม่
        </div>
      )}

      <footer className="bam-live-draft-controls">
        <button type="button" onClick={drawNext} disabled={revealComplete}>
          Draw Next Matchup
        </button>
        {!isPlaying ? (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            disabled={revealComplete}
          >
            Auto Draw
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
        <button type="button" onClick={restart}>
          Restart Schedule Presentation
        </button>
        <button
          type="button"
          onClick={isFullscreen ? onExitFullscreen : onEnterFullscreen}
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
        <button type="button" onClick={handleClose}>
          Exit Presentation
        </button>
        <button type="button" onClick={() => switchPresentation(onBackToDraft)}>
          Back to Draft Results
        </button>
        {isConfirmed && (
          <>
            <button type="button" onClick={onReplay}>
              Replay Confirmed Schedule
            </button>
            <button type="button" onClick={() => switchPresentation(onCreateNew)}>
              Create New Schedule Draw
            </button>
          </>
        )}
        <button
          type="button"
          className="bam-live-draft-confirm"
          onClick={confirm}
          disabled={!revealComplete || sourceChanged || isConfirmed}
        >
          {isConfirmed ? "Already Confirmed" : "Confirm Schedule"}
        </button>
      </footer>
    </div>
  );
}

export default LiveSchedulePresentation;
