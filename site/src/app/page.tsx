import collection from "@/data/collection.json";
import { ApprovalRoster } from "@/components/ApprovalRoster";
import { CollectionGallery } from "@/components/CollectionGallery";
import { GravityWorld } from "@/components/GravityWorld";
import { WalletButton } from "@/components/WalletButton";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const collectionImageBaseUrl = process.env.NEXT_PUBLIC_COLLECTION_IMAGE_BASE_URL?.replace(/\/$/, "");
  const collectionReady = process.env.NEXT_PUBLIC_COLLECTION_READY === "true" && Boolean(collectionImageBaseUrl);

  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top"><span>GG</span><b>GRAVITY GOONS</b></a>
        <nav><a href="#roster">Roster</a><a href="#collection">{collectionReady ? "Mint" : "Production"}</a><a href="#progression">Game DNA</a><Link href="/manage">Owner</Link></nav>
        <WalletButton />
      </header>

      <section className="hero shell" id="top">
        <GravityWorld />
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">1,000 FULL-BODY ATHLETES · BASE</p>
          <h1><span>BUILT TO</span><br />BREAK<br /><i>GRAVITY.</i></h1>
          <p className="lede">Six disciplines. Zero mystery. Choose your exact Goon, face rivals in the same sport, and call your tricks. Their stats shape the odds—but deciding when to play safe or risk everything is up to you.</p>
          <div className="hero-actions"><a className="button primary" href="#collection">{collectionReady ? "Choose your Goon" : "Preview the Goons"}</a><span>{collectionReady ? "0.003 ETH · MAX 5" : "FINAL ART IN PROGRESS"}</span></div>
          <div className="launch-data"><div><b>1000</b><span>TOTAL GOONS</span></div><div><b>06</b><span>DISCIPLINES</span></div><div><b>64</b><span>TRICK SLOTS</span></div></div>
        </div>
        <div className="hero-visual">
          <div className="gravity-halo" />
          <div className="goon-card-3d"><Image src="/collection/base-concept.png" alt="Gravity Goons snow leopard skateboarder" width={1024} height={1024} priority /></div>
          <div className="floating-tag tag-one">SKATE // 001</div>
          <div className="floating-tag tag-two">STYLE <b>08</b></div>
          <div className="floating-tag tag-three">MIKE™*</div>
          <div className="sticker">PICK<br />THE EXACT<br />GOON</div>
        </div>
      </section>

      <section className="marquee"><div>SKATEBOARDING · SNOWBOARDING · SURFING · BMX · MOTOCROSS · SKIING · BREAK GRAVITY · SKATEBOARDING · SNOWBOARDING · SURFING · BMX · MOTOCROSS · SKIING · BREAK GRAVITY · </div></section>

      <section className="banner-cinema" aria-label="Gravity Goons cinematic collection banner">
        <Image src="/collection/gravity-goons-banner.png" alt="Gravity Goons athletes gathered in a futuristic action-sports arena" width={2048} height={768} />
        <div className="banner-vignette" />
        <div className="banner-caption"><span>THE GOONS HAVE LANDED</span><b>06 SPORTS // 1000 ATHLETES // ONE GRAVITY FIELD</b></div>
      </section>

      <section className="roster-showcase shell" id="roster">
        <div className="roster-copy"><p className="eyebrow">THE GOONIVERSE</p><h2>Every sport reads instantly.</h2><p>No generic floating heads. Every Goon has a full-body silhouette, visible equipment, discipline-compatible gear, and one of twelve fictional underground labels.</p><div className="brand-run">MIKE · AVOIDAS · POOMA · VANISH · NORTH FAKE · OFF-BEIGE · CARHEART · PROCRASTIGONIA · BURNTON · VOLCANO · FAUX RACING · QUEAZY</div></div>
        <div className="roster-plane"><Image src="/collection/approval-roster-12.png" alt="Twelve metadata-matched Gravity Goons production proofs across six action sports" width={1536} height={1152} /></div>
      </section>

      <section className="collection-section shell" id="collection">
        <div className="section-heading"><div><p className="eyebrow">{collectionReady ? "LIVE BASE ROSTER" : "APPROVAL ROSTER"}</p><h2>{collectionReady ? "Choose, connect, mint." : "Twelve Goons. Twelve real looks."}</h2></div><p>{collectionReady ? "Filter all 1,000 characters, connect a Base wallet, select up to five available IDs, and mint them without leaving GravityGoons.com." : "The collection system contains 1,000 fixed trait assignments. These 12 concepts establish the visual range while the final 1,000 unique images are produced and validated."}</p></div>
        {collectionReady && collectionImageBaseUrl
          ? <CollectionGallery tokens={collection.tokens} imageBaseUrl={collectionImageBaseUrl} />
          : <ApprovalRoster />}
      </section>

      <section className="game-section shell" id="progression">
        <div><p className="eyebrow">THE FIRST GAME CONCEPT</p><h2>Call the trick.<br />Play the odds.</h2><p className="game-intro">Gravity Goons is planned as a blockchain-backed, turn-based trick battle. Skateboarders face skateboarders, BMX riders face BMX riders, and every other Goon competes within their own discipline. The exact rules, probability model, and game engine will be designed later.</p></div>
        <div className="game-grid">
          <article><b>01</b><h3>Match your discipline</h3><p>Skaters battle skaters. Surfers battle surfers. Each of the six sports gets its own trick catalog, matchup identity, and strategic rhythm.</p></article>
          <article><b>02</b><h3>Choose the trick</h3><p>Call the move you want your Goon to attempt. Safer tricks can apply steady pressure; ambitious tricks can change the entire battle.</p></article>
          <article><b>03</b><h3>Know your odds</h3><p>Every Goon starts with 30 balanced stat points. Rarity adds a small signature-trick edge: Common +0, Uncommon +1, Rare +2, Epic +3, and Legendary +4 percentage points. Stats still drive the matchup; rarity never guarantees the landing.</p></article>
          <article><b>04</b><h3>Progress travels</h3><p>Future XP, learned tricks, achievements, and battle history are designed to stay with the NFT—even when the Goon changes wallets.</p></article>
        </div>
      </section>

      <section className="final-cta shell"><div><p className="eyebrow">NO BLIND BOX. NO REVEAL.</p><h2>See the Goon.<br />Choose the Goon.<br /><i>Become the Goon.</i></h2></div><a className="button primary" href="#collection">{collectionReady ? "ENTER THE ROSTER" : "VIEW CONCEPT ROSTER"}</a></section>

      <footer className="shell"><span>GRAVITY GOONS © 2026</span><span>BUILT TO BREAK GRAVITY · BASE ERC-721</span><span>GRAVITYGOONS.COM</span></footer>
    </main>
  );
}
