import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";

export const metadata: Metadata = {
  title: "Roadmap | Gravity Goons",
  description: "The live Gravity Goons collection, gameplay, movie, and competition roadmap.",
};

const milestones = [
  { title: "1,000 unique NFTs created", state: "complete", detail: "Every Goon has immutable art, traits, discipline, stats, and an exact token ID." },
  { title: "Minting open to public", state: "complete", detail: "The remaining collection is available through tier-priced exact-ID minting on Base." },
  { title: "SKATE games incorporated", state: "complete", detail: "NFT holders can challenge a same-discipline rival in live authoritative 1v1 games." },
  { title: "Moves gallery working", state: "building", detail: "Owners commission LAND and FALL movies for unlocked tricks and approve the finished pair." },
  { title: "P2P USDC SKATE betting for NFT holders", state: "building", detail: "Equal-stake player escrow with explicit terms, settlement evidence, refunds, and Safe controls." },
  { title: "Betting for audience", state: "building", detail: "Public Arena viewing comes first; audience wagering follows through a controlled spectator-market integration." },
  { title: "Pink Slip Competitions", state: "building", detail: "A separate winner-takes-both-Goons mode with unmistakable confirmations and dedicated NFT escrow." },
] as const;

export default function RoadmapPage() {
  return (
    <main className="roadmap-page">
      <header className="nav shell">
        <Link className="brand" href="/" aria-label="Gravity Goons home">
          <Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority />
        </Link>
        <nav><Link href="/arena">Live Arena</Link><Link href="/#collection">Enter the Roster</Link><Link className="roadmap-link" href="/roadmap" aria-current="page">Roadmap</Link></nav>
        <WalletButton />
      </header>

      <section className="roadmap-hero shell">
        <div className="roadmap-orbit" aria-hidden="true"><i /><i /><i /></div>
        <p className="eyebrow">GRAVITY GOONS // FLIGHT PLAN</p>
        <h1>Built in public.<br /><i>Moving in 3D.</i></h1>
        <p>The collection is live. The game works. Every next system is being connected without pretending unfinished work is finished.</p>
        <div className="roadmap-key"><span><b>✓</b> LIVE</span><span><b>◷</b> IN PROGRESS</span></div>
      </section>

      <section className="roadmap-timeline shell" aria-label="Gravity Goons roadmap milestones">
        <div className="roadmap-spine" aria-hidden="true" />
        {milestones.map((milestone, index) => (
          <article className={`roadmap-stop is-${milestone.state}`} key={milestone.title}>
            <div className="roadmap-node" aria-hidden="true"><span>{milestone.state === "complete" ? "✓" : "◷"}</span></div>
            <div className="roadmap-card">
              <span>{String(index + 1).padStart(2, "0")}{" // "}{milestone.state === "complete" ? "LIVE" : "IN PROGRESS"}</span>
              <h2>{milestone.title}</h2>
              <p>{milestone.detail}</p>
              <b aria-hidden="true">{milestone.state === "complete" ? "✓" : "⏳"}</b>
            </div>
          </article>
        ))}
      </section>

      <section className="roadmap-next shell">
        <div><p className="eyebrow">RIGHT NOW</p><h2>Moves first.<br />Escrow next.</h2></div>
        <p>Move Studio reliability is the active production task. Player USDC and Pink Slip systems remain visibly in progress until their contracts, settlement paths, and failure recovery are ready to test.</p>
        <Link className="button primary" href="/moves">OPEN MOVE STUDIO</Link>
      </section>

      <footer className="shell"><span>GRAVITY GOONS © 2026</span><span>ROADMAP STATUS · UPDATED LIVE</span><Link href="/">BACK TO THE BAR</Link></footer>
    </main>
  );
}
