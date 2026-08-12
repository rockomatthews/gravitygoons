import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { GooniverseDistrict } from "@/components/GooniverseDistrict";
import { TrickLineClient } from "@/components/TrickLineClient";
import { WalletButton } from "@/components/WalletButton";

export const metadata: Metadata = {
  title: "The Gooniverse — Gravity Goons",
  description: "Play, earn token-bound GRIT and materials, develop a Gravity Goon career, and rebuild the ZERO-G district.",
};

export default function GooniversePage() {
  return <main className="gooniverse-page">
    <header className="nav shell"><Link href="/" className="brand"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link><nav><Link href="/collection">Roster</Link><Link href="/arena">Arena</Link><Link href="/gooniverse">Gooniverse</Link><Link href="/roadmap" className="roadmap-link">Roadmap</Link></nav><WalletButton/></header>
    <section className="gooniverse-hero shell"><p className="eyebrow">A PERSISTENT WORLD FOR EVERY GOON</p><h1>ENTER THE<br/><i>GOONIVERSE.</i></h1><p>Play → earn GRIT and materials → develop a Goon → craft equipment → compete → build a permanent career.</p><div><a className="button primary" href="#trick-line">PLAY TRICK LINE</a><Link className="button" href="/collection">CHOOSE A GOON</Link></div></section>
    <GooniverseDistrict/>
    <div className="shell"><TrickLineClient/></div>
    <section className="gooniverse-foundation shell" id="coming-online"><article><span>SCRAPYARD</span><b>EXPEDITIONS</b><p>15 minute, 2 hour, and 8 hour salvage routes are built on committed seeds. One active run per Goon.</p></article><article><span>WORKSHOP</span><b>30 RECIPES</b><p>Performance gear, protection, cosmetics, effects, and Blackout equipment. New Goons receive nothing for free.</p></article><article><span>CAREER</span><b>FOLLOWS THE NFT</b><p>GRIT, materials, gear, trophies, assignments, and season history remain keyed to token ID through every transfer.</p></article></section>
  </main>;
}
