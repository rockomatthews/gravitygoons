import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { GooniverseDistrict } from "@/components/GooniverseDistrict";
import { TrickLineClient } from "@/components/TrickLineClient";
import { WalletButton } from "@/components/WalletButton";
import { GeneratorContribution } from "@/components/GeneratorContribution";

export const metadata: Metadata = {
  title: "The Gooniverse — Gravity Goons",
  description: "Play, earn token-bound GRIT and materials, develop a Gravity Goon career, and rebuild the ZERO-G district.",
};

export default function GooniversePage() {
  return <main className="gooniverse-page">
    <header className="nav shell"><Link href="/" className="brand"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link><nav><Link href="/collection">Roster</Link><Link href="/arena">Arena</Link><Link href="/roadmap" className="roadmap-link">Roadmap</Link></nav><WalletButton/></header>
    <GooniverseDistrict/>
    <GeneratorContribution/>
    <div className="shell"><TrickLineClient/></div>
    <section className="gooniverse-foundation shell"><article id="scrapyard"><span>SCRAPYARD</span><b>EXPEDITIONS</b><p>15 minute, 2 hour, and 8 hour salvage routes are built on committed seeds. One active run per Goon.</p></article><article id="workshop"><span>WORKSHOP</span><b>100 POWER PER BATTERY</b><p>Salvage Scrap, Pigment, and Components, craft a ZERO-G battery, then permanently feed it into your Goon&apos;s discipline generator.</p></article><article><span>TROPHY HALL</span><b>CAREER PROOF</b><p>Generator contribution tiers at 100, 500, 1,500, and 3,000 power create permanent trophies that follow the NFT.</p><Link href="/trophy-hall">ENTER THE HALL →</Link></article></section>
  </main>;
}
