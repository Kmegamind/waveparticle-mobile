"use client";

import Link from "next/link";
import { useState } from "react";
import { INTRO_SLIDES } from "@/lib/intro/slides";

/**
 * Replay intro (#480): plays the slides one by one. Skip (and Done on the last slide) go back to
 * Me. It reads and writes nothing, so a replay never touches progress or settings.
 */
export function IntroPlayer() {
  const [index, setIndex] = useState(0);
  const slide = INTRO_SLIDES[index];
  const last = index === INTRO_SLIDES.length - 1;
  return (
    <section aria-label="Intro" className="intro">
      <p className="focus-label">{`Step ${index + 1} of ${INTRO_SLIDES.length}`}</p>
      <h1 aria-live="polite">{slide.title}</h1>
      <p className="intro-body">{slide.body}</p>
      <div className="intro-actions">
        {last ? (
          <Link className="button-filled" href="/me">
            Done
          </Link>
        ) : (
          <>
            <button className="button-filled" onClick={() => setIndex(index + 1)} type="button">
              Next
            </button>
            <Link className="button-plain" href="/me">
              Skip
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
