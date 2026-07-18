import collection from "@/data/collection.json";
import { CollectionGallery } from "@/components/CollectionGallery";
import { GravityWorld } from "@/components/GravityWorld";
import { WalletButton } from "@/components/WalletButton";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top"><span>GG</span><b>GRAVITY GOONS</b></a>
        <nav><a href="#roster">Roster</a><a href="#collection">Mint</a><a href="#progression">Game DNA</a><Link href="/manage">Owner</Link></nav>
        <WalletButton />
      </header>

      <section className="hero shell" id="top">
        <GravityWorld />
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">1,000 FULL-BODY ATHLETES · BASE</p>
          <h1><span>BUILT TO</span><br />BREAK<br /><i>GRAVITY.</i></h1>
          <p className="lede">Six sports. Twelve underground labels. Zero mystery. Choose the exact Goon you want and carry their tricks, XP, and permanent history into the future game.</p>
          <div className="hero-actions"><a className="button primary" href="#collection">Choose your Goon</a><span>0.003 ETH · MAX 5</span></div>
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
        <div className="roster-plane"><Image src="/collection/approval-roster-12.png" alt="Twelve representative Gravity Goons across six action sports" width={1536} height={1536} /></div>
      </section>

      <section className="collection-section shell" id="collection">
        <div className="section-heading"><div><p className="eyebrow">LIVE BASE ROSTER</p><h2>Choose, connect, mint.</h2></div><p>Filter all 1,000 characters, connect a Base wallet, select up to five available IDs, and mint them without leaving GravityGoons.com.</p></div>
        <CollectionGallery tokens={collection.tokens} />
      </section>

      <section className="game-section shell" id="progression">
        <div><p className="eyebrow">GAME DNA FROM GENESIS</p><h2>Your Goon keeps learning.</h2></div>
        <div className="game-grid">
          <article><b>01</b><h3>Balanced loadouts</h3><p>Every Goon starts with exactly 30 points across Speed, Air, Control, Style, and Toughness. Rarity never buys an unfair statistical advantage.</p></article>
          <article><b>02</b><h3>Discipline mastery</h3><p>Each sport reserves 64 permanent trick slots with versioned catalogs, prerequisites, XP rewards, and future animation identifiers.</p></article>
          <article><b>03</b><h3>Progress travels</h3><p>Settled XP, levels, tricks, achievements, and history stay with the NFT when it moves to a new wallet.</p></article>
        </div>
      </section>

      <section className="final-cta shell"><div><p className="eyebrow">NO BLIND BOX. NO REVEAL.</p><h2>See the Goon.<br />Choose the Goon.<br /><i>Become the Goon.</i></h2></div><a className="button primary" href="#collection">ENTER THE ROSTER</a></section>

      <footer className="shell"><span>GRAVITY GOONS © 2026</span><span>BUILT TO BREAK GRAVITY · BASE ERC-721</span><span>GRAVITYGOONS.COM</span></footer>
    </main>
  );
}
