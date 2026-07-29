"use client";

import { useRef, useState } from "react";

type Outcome = {
  kind: "land" | "fall";
  label: string;
  rule: string;
  video: string;
  poster: string;
};

const outcomes: Outcome[] = [
  {
    kind: "land",
    label: "STICKS THE LANDING",
    rule: "RESULT ROLL ≤ 62",
    video: "/media/double-flatspin-land.mp4",
    poster: "/media/double-flatspin-land-poster.jpg",
  },
  {
    kind: "fall",
    label: "LOSES THE LANDING",
    rule: "RESULT ROLL > 62",
    video: "/media/double-flatspin-fall.mp4",
    poster: "/media/double-flatspin-fall-poster.jpg",
  },
];

function OutcomeCard({ outcome }: { outcome: Outcome }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function playThrough() {
    const video = videoRef.current;
    if (!video || playing) return;
    if (video.ended || video.currentTime >= video.duration - 0.05) video.currentTime = 0;
    setPlaying(true);
    void video.play().catch(() => setPlaying(false));
  }

  function resetAfterFinish() {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
    setPlaying(false);
  }

  return (
    <article
      aria-label={`${outcome.label}. Hover or focus to play the complete outcome.`}
      className={`trick-outcome-card ${outcome.kind} ${playing ? "playing" : ""}`}
      onClick={playThrough}
      onFocus={playThrough}
      onMouseEnter={playThrough}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        aria-label={`${outcome.label} double flatspin outcome`}
        muted
        playsInline
        poster={outcome.poster}
        preload="metadata"
        onEnded={resetAfterFinish}
      >
        <source src={outcome.video} type="video/mp4" />
      </video>
      <div className="trick-outcome-shade" />
      <div className="trick-outcome-topline"><span>{outcome.rule}</span><i>{playing ? "PLAYING TO FINISH" : "HOVER TO PLAY"}</i></div>
      <div className="trick-outcome-result"><span>{outcome.kind === "land" ? "LAND" : "BAIL"}</span><b>{outcome.label}</b></div>
    </article>
  );
}

export function TrickOutcomeTeaser() {
  return (
    <section className="trick-outcome-teaser">
      <div className="trick-outcome-heading">
        <div><p className="eyebrow">ONE ATTEMPT // TWO POSSIBLE FILMS</p><h2>The roll decides<br /><i>what spectators see.</i></h2></div>
        <div className="trick-chance">
          <span>DEMO LANDING CHANCE</span>
          <b>62%</b>
          <div><i /></div>
          <small>ATHLETE ABILITY × DOUBLE FLATSPIN DIFFICULTY</small>
        </div>
      </div>
      <div className="trick-outcome-grid">
        {outcomes.map((outcome) => <OutcomeCard key={outcome.kind} outcome={outcome} />)}
      </div>
      <div className="trick-outcome-logic">
        <span>01 // LOCK DOUBLE FLATSPIN</span><i>→</i>
        <span>02 // RESOLVE 62% CHANCE</span><i>→</i>
        <span>03 // PLAY THE MATCHING OUTCOME</span>
        <b>THE GAME RESULT CHOOSES THE CLIP. THE CLIP NEVER CHOOSES THE RESULT.</b>
      </div>
    </section>
  );
}
