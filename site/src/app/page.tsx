import collection from "@/data/collection.json";
import { CollectionGallery } from "@/components/CollectionGallery";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top"><span>IC</span> IMPACT CLUB</a>
        <nav><a href="#collection">Athletes</a><a href="#game">Game DNA</a><Link href="/manage">Owner</Link></nav>
      </header>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <p className="eyebrow">SIX SPORTS · ONE CLUB · 1,000 ORIGINALS</p>
          <h1>Pick your athlete.<br/><i>Build their legacy.</i></h1>
          <p className="lede">Every character is visible from day one. Choose the exact rider you want, then carry their stats, tricks, and history into the future game.</p>
          <div className="hero-actions"><a className="button primary" href="#collection">Choose yours</a><span>0.003 ETH · BASE</span></div>
        </div>
        <div className="hero-visual">
          <div className="impact-ring" />
          <Image src="/collection/base-concept.png" alt="Impact Club snow leopard skateboarder" width={1024} height={1024} priority />
          <div className="stat-chip chip-one">STYLE <b>8</b></div>
          <div className="stat-chip chip-two">CONTROL <b>7</b></div>
          <div className="sticker">CHOOSE<br/>THE EXACT<br/>TOKEN</div>
        </div>
      </section>

      <section className="marquee"><div>SKATEBOARDING · SNOWBOARDING · SURFING · BMX · MOTOCROSS · SKIING · </div></section>

      <section className="collection-section shell" id="collection">
        <div className="section-heading"><div><p className="eyebrow">THE STARTING ROSTER</p><h2>All traits. No mystery.</h2></div><p>Filter by discipline and strengths, then select up to five exact characters.</p></div>
        <CollectionGallery tokens={collection.tokens} />
      </section>

      <section className="game-section shell" id="game">
        <div><p className="eyebrow">BUILT BEYOND THE DROP</p><h2>Skills stay with the character.</h2></div>
        <div className="game-grid">
          <article><b>01</b><h3>Balanced strengths</h3><p>Every athlete starts with exactly 30 points across Speed, Air, Control, Style, and Toughness.</p></article>
          <article><b>02</b><h3>Learn 64 tricks</h3><p>Each discipline has dedicated trick slots, prerequisites, levels, XP, and future animations.</p></article>
          <article><b>03</b><h3>Progress travels</h3><p>Learned tricks and permanent achievements follow the NFT when ownership changes.</p></article>
        </div>
      </section>

      <footer className="shell"><span>IMPACT CLUB © 2026</span><span>ORIGINAL CHARACTERS · BASE ERC-721</span></footer>
    </main>
  );
}
