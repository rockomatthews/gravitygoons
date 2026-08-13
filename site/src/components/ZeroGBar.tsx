"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WalletProfileLink } from "@/components/WalletProfileLink";

const tvs = [
  { className: "zero-g-tv tv-one", label: "Watch SKATE in Game Mode" },
  { className: "zero-g-tv tv-two", label: "Enter the ranked game lobby" },
  { className: "zero-g-tv tv-three", label: "Watch Gravity Goons highlights" },
];

export function ZeroGBar() {
  const scene = useRef<HTMLElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const node = scene.current;
    if (!node || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      node.style.setProperty("--bar-x", `${((event.clientX - rect.left) / rect.width - 0.5) * 1.2}deg`);
      node.style.setProperty("--bar-y", `${((event.clientY - rect.top) / rect.height - 0.5) * -0.8}deg`);
    };
    const reset = () => {
      node.style.setProperty("--bar-x", "0deg");
      node.style.setProperty("--bar-y", "0deg");
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", reset);
    return () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <section className="zero-g-hero" id="top" ref={scene}>
      <picture className="zero-g-plate">
        <source media="(max-width: 680px)" srcSet="/collection/zero-g-bar/mobile.webp" />
        <Image src="/collection/zero-g-bar/desktop.webp" alt="Six Gravity Goons gather inside the ZERO-G ENERGY bar" fill sizes="100vw" priority />
      </picture>
      <div className="zero-g-depth depth-back" aria-hidden="true" />
      <div className="zero-g-depth depth-front" aria-hidden="true" />

      {tvs.map((tv, index) => (
        <Link href="/game" className={tv.className} aria-label={tv.label} key={tv.className}>
          <video muted={muted} autoPlay loop playsInline poster={`/collection/production-preview/00${34 + index}.png`}>
            <source src="/media/double-flatspin-land.mp4" type="video/mp4" />
          </video>
          <span>GAME MODE ↗</span>
        </Link>
      ))}
      <WalletProfileLink className="zero-g-door" ariaLabel="Open your Gravity Goons profile">
        <span>PROFILE ↗</span>
      </WalletProfileLink>
      <Link href="/gooniverse" className="zero-g-gooniverse" aria-label="Enter the Gooniverse"><span>ENTER THE GOONIVERSE ↗</span></Link>

      <div className="zero-g-sign" aria-label="ZERO-G ENERGY">
        <Image src="/collection/zero-g-bar/zero-g-energy.svg" alt="ZERO-G ENERGY" width={320} height={112} />
      </div>
      <div className="zero-g-can can-one"><Image src="/collection/zero-g-bar/zero-g-energy.svg" alt="" width={94} height={34} /></div>
      <div className="zero-g-can can-two"><Image src="/collection/zero-g-bar/zero-g-energy.svg" alt="" width={94} height={34} /></div>

      <div className="zero-g-copy">
        <p className="eyebrow">WELCOME TO THE ZERO-G BAR</p>
        <h1>Pick a Goon.<br /><i>Call the trick.</i><br />Take the letters.</h1>
        <p>Most NFTs sit in wallets. Gravity Goons compete live across six action-sports disciplines on Base.</p>
        <Link className="button primary" href="/collection">ENTER THE ROSTER</Link>
      </div>
      <button className="zero-g-sound" onClick={() => setMuted((value) => !value)} aria-pressed={!muted}>
        {muted ? "SOUND OFF" : "SOUND ON"}
      </button>
    </section>
  );
}
