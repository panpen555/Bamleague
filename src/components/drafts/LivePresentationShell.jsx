import React, { useEffect, useRef, useState } from "react";

function LivePresentationShell({ open, activeView, onEscape, children }) {
  const shellRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const requestFullscreen = async () => {
    if (!shellRef.current?.requestFullscreen) return;
    try {
      await shellRef.current.requestFullscreen();
    } catch (error) {
      console.warn("Fullscreen is unavailable; using viewport mode.", error);
    }
  };

  const exitFullscreen = async () => {
    if (
      document.fullscreenElement !== shellRef.current ||
      !document.exitFullscreen
    ) {
      return;
    }

    try {
      await document.exitFullscreen();
    } catch (error) {
      console.warn("Unable to exit fullscreen:", error);
    }
  };

  useEffect(() => {
    if (!open && !isFullscreen) return undefined;

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [open, isFullscreen]);

  useEffect(() => {
    if (open || document.fullscreenElement !== shellRef.current) return;
    exitFullscreen();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key !== "Escape" || document.fullscreenElement) return;
      onEscape();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, activeView, onEscape]);

  return (
    <div
      ref={shellRef}
      className={`bam-live-presentation-shell ${
        open || isFullscreen ? "bam-live-presentation-shell-open" : ""
      }`}
      data-active-view={activeView}
      aria-hidden={!open}
    >
      {children({
        isFullscreen,
        onEnterFullscreen: requestFullscreen,
        onExitFullscreen: exitFullscreen,
      })}
    </div>
  );
}

export default LivePresentationShell;
