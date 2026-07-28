import React, { useEffect, useMemo, useState } from "react";

function PublicHighlightCarousel({ slides, autoplay, intervalSeconds }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedSlideIds, setFailedSlideIds] = useState(() => new Set());
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => !document.hidden,
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [navigationVersion, setNavigationVersion] = useState(0);

  const slideSignature = slides
    .map((slide) => `${slide.id}:${slide.imageUrl}`)
    .join("|");
  const validSlides = useMemo(
    () => slides.filter((slide) => !failedSlideIds.has(slide.id)),
    [slides, failedSlideIds],
  );
  const hasMultipleSlides = validSlides.length > 1;
  const safeActiveIndex = Math.min(
    Math.max(0, activeIndex),
    Math.max(0, validSlides.length - 1),
  );

  const navigateTo = (nextIndex) => {
    setActiveIndex(nextIndex);
    setNavigationVersion((version) => version + 1);
  };

  const showPrevious = () => {
    navigateTo(
      (safeActiveIndex - 1 + validSlides.length) % validSlides.length,
    );
  };

  const showNext = () => {
    navigateTo((safeActiveIndex + 1) % validSlides.length);
  };

  useEffect(() => {
    setFailedSlideIds(new Set());
  }, [slideSignature]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, validSlides.length - 1));
  }, [validSlides.length]);

  useEffect(() => {
    const handleVisibilityChange = () =>
      setIsDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () =>
      setPrefersReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener?.("change", updateMotionPreference);
    return () =>
      mediaQuery.removeEventListener?.("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (
      !autoplay ||
      !hasMultipleSlides ||
      isHovered ||
      hasFocus ||
      !isDocumentVisible ||
      prefersReducedMotion
    ) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % validSlides.length);
    }, intervalSeconds * 1000);

    return () => window.clearTimeout(timerId);
  }, [
    autoplay,
    hasMultipleSlides,
    isHovered,
    hasFocus,
    isDocumentVisible,
    prefersReducedMotion,
    intervalSeconds,
    activeIndex,
    navigationVersion,
    validSlides.length,
  ]);

  if (validSlides.length === 0) return null;

  const activeSlide = validSlides[safeActiveIndex];

  return (
    <section
      className="bam-public-highlight-carousel"
      aria-label="BAM League highlights"
      aria-roledescription="carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocus(false);
        }
      }}
    >
      <img
        key={activeSlide.id}
        src={activeSlide.imageUrl}
        alt={activeSlide.altText}
        className="bam-public-highlight-image"
        loading="lazy"
        onError={() =>
          setFailedSlideIds((failedIds) => {
            const nextIds = new Set(failedIds);
            nextIds.add(activeSlide.id);
            return nextIds;
          })
        }
      />
      <div className="bam-public-highlight-overlay" aria-hidden="true" />
      <div className="bam-public-highlight-count">
        {safeActiveIndex + 1} / {validSlides.length}
      </div>

      {hasMultipleSlides ? (
        <>
          <button
            type="button"
            className="bam-public-highlight-arrow bam-public-highlight-arrow-prev"
            onClick={showPrevious}
            aria-label="Previous highlight"
          >
            ‹
          </button>
          <button
            type="button"
            className="bam-public-highlight-arrow bam-public-highlight-arrow-next"
            onClick={showNext}
            aria-label="Next highlight"
          >
            ›
          </button>
          <div className="bam-public-highlight-dots">
            {validSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`bam-public-highlight-dot${
                  index === safeActiveIndex ? " is-active" : ""
                }`}
                onClick={() => navigateTo(index)}
                aria-label={`Show highlight ${index + 1}`}
                aria-current={index === safeActiveIndex ? "true" : undefined}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

export default PublicHighlightCarousel;
