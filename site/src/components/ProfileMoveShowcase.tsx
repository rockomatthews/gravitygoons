"use client";

import { useRef, useState } from "react";

export function ProfileMoveShowcase({ name, videoUrl, posterUrl }: { name: string; videoUrl: string; posterUrl: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function play() {
    const video = ref.current;
    if (!video || playing) return;
    if (video.ended || video.currentTime >= video.duration - 0.05) video.currentTime = 0;
    setPlaying(true);
    void video.play().catch(() => setPlaying(false));
  }

  return (
    <div className={`profile-move-video ${playing ? "playing" : ""}`} onMouseEnter={play} onFocus={play} tabIndex={0}>
      <video ref={ref} muted playsInline preload="metadata" poster={posterUrl ?? undefined} onEnded={() => setPlaying(false)}>
        <source src={videoUrl} type="video/mp4" />
      </video>
      <span>APPROVED LAND</span><b>{name}</b><small>HOVER TO PLAY</small>
    </div>
  );
}

