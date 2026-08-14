import Image from "next/image";
import Link from "next/link";
import { MoveCinemaTeaser } from "@/components/MoveCinemaTeaser";
import { WalletButton } from "@/components/WalletButton";

const studioSteps = [
  {
    number: "01",
    title: "Own it + unlock it",
    copy: "Connect the current owner wallet and choose one trick already unlocked by that NFT. Buying a clip never unlocks a move or improves its odds.",
  },
  {
    number: "02",
    title: "Fund one render",
    copy: "Approve a clearly quoted one-time crypto payment. The server verifies payment before creating an asynchronous render job.",
  },
  {
    number: "03",
    title: "Review the take",
    copy: "The owner approves a safe five-second clip after automated equipment, identity, brand, and content checks. Failed jobs follow a defined retry or refund policy.",
  },
  {
    number: "04",
    title: "Enter the broadcast",
    copy: "The approved clip is cached and keyed to that Goon and trick. Matches replay it immediately; a fast 2.5D fallback covers every move without a clip.",
  },
];

export default function MovesPage() {
  return (
    <main className="move-studio-page">
      <header className="nav shell">
        <Link className="brand" href="/">
          <Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority />
        </Link>
        <nav><Link href="/">Collection</Link><Link href="/game">Arena</Link><a href="#workflow">Workflow</a></nav>
        <WalletButton />
      </header>

      <section className="move-studio-hero shell">
        <MoveCinemaTeaser />
      </section>

      <section id="workflow" className="move-studio-workflow shell">
        <div className="move-studio-heading">
          <div><p className="eyebrow">OWNER CREATION LOOP</p><h2>A move library that<br />grows with the athlete.</h2></div>
          <p>Move clips make the broadcast richer without making the game pay-to-win. They add presentation history, creator credit, sponsor placement, and collection personality—not stats, score, landing chance, or competitive access.</p>
        </div>
        <div className="move-studio-steps">
          {studioSteps.map((step) => <article key={step.number}><b>{step.number}</b><h3>{step.title}</h3><p>{step.copy}</p></article>)}
        </div>
        <div className="move-studio-boundary">
          <div><span>ATHLETE PROGRESSION</span><b>Wins, sponsor contracts, and trick unlocks are still earned through verified play.</b></div>
          <div><span>CINEMA PROGRESSION</span><b>Approved clips can build a separate cosmetic reel, creator level, and spectator-favorite history.</b></div>
          <Link className="button primary" href="/34">Preview a Goon profile</Link>
        </div>
      </section>
    </main>
  );
}
