"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";

export type IslandHotspot = {
  key: string;
  label: string;
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
  featured?: boolean;
};

const DIRECTIONS = [["↑", 0, -1], ["←", -1, 0], ["●", 0, 0], ["→", 1, 0], ["↓", 0, 1]] as const;

export function GooniverseIslandMap({ hotspots }: { hotspots: readonly IslandHotspot[] }) {
  const [column, setColumn] = useState(1);
  const [row, setRow] = useState(1);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const move = (dx: number, dy: number) => {
    setColumn((value) => Math.max(0, Math.min(2, value + dx)));
    setRow((value) => Math.max(0, Math.min(2, value + dy)));
  };

  return <section
    className="gooniverse-mobile-map"
    aria-label="Interactive Gooniverse island map"
    onTouchStart={(event) => {
      const point = event.touches[0];
      touch.current = { x: point.clientX, y: point.clientY };
    }}
    onTouchEnd={(event) => {
      if (!touch.current) return;
      const point = event.changedTouches[0];
      const dx = point.clientX - touch.current.x;
      const dy = point.clientY - touch.current.y;
      touch.current = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 35) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1, 0);
      else move(0, dy < 0 ? 1 : -1);
    }}
  >
    <div className="gooniverse-mobile-viewport">
      <div className="gooniverse-mobile-stage" style={{ "--map-column": column, "--map-row": row } as CSSProperties}>
        <Image src="/gooniverse/zero-g-blackout-island.png" alt="The Gravity Goons ZERO-G Blackout island district" width={1609} height={977} priority sizes="230vw" />
        {hotspots.map((hotspot) => <Link
          key={hotspot.key}
          href={hotspot.href}
          className={`gooniverse-hotspot${hotspot.featured ? " gooniverse-academia-hotspot" : ""}`}
          style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%`, width: `${hotspot.w}%`, height: `${hotspot.h}%` }}
          aria-label={`Open ${hotspot.label}`}
        ><span>{hotspot.label}</span></Link>)}
      </div>
      <div className="gooniverse-season">SEASON 1</div>
    </div>
    <div className="gooniverse-map-controls" aria-label="Move around the island">
      {DIRECTIONS.map(([label, dx, dy]) => <button
        key={label}
        type="button"
        onClick={() => label === "●" ? (setColumn(1), setRow(1)) : move(dx, dy)}
        aria-label={label === "●" ? "Center island" : `Move ${label}`}
      >{label}</button>)}
    </div>
    <p>SWIPE OR USE THE CONTROLS TO EXPLORE</p>
  </section>;
}
