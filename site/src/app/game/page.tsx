import collection from "@/data/collection.json";
import { GameArena, type ArenaGoon } from "@/components/GameArena";
import { MoveCinemaTeaser } from "@/components/MoveCinemaTeaser";
import { TrickOutcomeTeaser } from "@/components/TrickOutcomeTeaser";
import { WalletButton } from "@/components/WalletButton";
import Image from "next/image";
import Link from "next/link";

const previewIds = [30, 31, 32, 33, 34, 35, 36, 38, 39, 40, 41, 42];

export default function GamePage() {
  const goons = collection.tokens.filter((token) => previewIds.includes(token.token_id)).map((token) => ({
    tokenId: token.token_id,
    name: token.name,
    discipline: token.discipline,
    rarity: token.rarity,
    trickSpecialty: token.trick_specialty,
    stats: token.stats,
    species: token.species,
    parodyBrand: token.parody_brand,
    image: `/collection/production-preview/${String(token.token_id).padStart(4, "0")}.png`,
  })) as ArenaGoon[];

  return <main className="game-lab">
    <header className="nav shell">
      <Link className="brand" href="/"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link>
      <nav><Link href="/">Collection</Link><a href="#outcomes">Outcomes</a><a href="#arena">Arena</a><a href="#cinema">Move Cinema</a><a href="#rules">Rules</a></nav>
      <WalletButton />
    </header>
    <section className="game-hero shell"><p className="eyebrow">PVP MECHANICS LAB // V0.3</p><h1>CALL IT.<br /><i>LAND IT.</i><br />DON&apos;T SPELL OUT.</h1><p>This is SKATE, not a points contest. The setter calls one unlocked trick and must land it before the responder answers. A responder can temporarily try an unfamiliar trick, with odds shaped by stats, similar known moves, and prior attempts. Ranked wins attract fictional sponsors, adding permanent stickers and more tricks the Goon can call.</p></section>
    <section id="outcomes" className="shell game-outcome-teaser"><TrickOutcomeTeaser /></section>
    <section id="cinema" className="shell game-cinema-teaser"><MoveCinemaTeaser compact /></section>
    <section id="arena" className="shell"><GameArena goons={goons} /></section>
    <section id="rules" className="game-rules shell">
      <article><b>01</b><h2>Call a known trick</h2><p>The setter chooses from that Goon&apos;s permanent catalogue. Sponsor progression expands which tricks the Goon is allowed to call.</p></article>
      <article><b>02</b><h2>Land it to set it</h2><p>The setter attempts first. If they miss, no letter is given and the opponent takes the next call.</p></article>
      <article><b>03</b><h2>Answer or take a letter</h2><p>If the setter lands, the responder attempts the exact same trick. Land it and take the call; miss it and take the next letter.</p></article>
      <article><b>04</b><h2>Temporary attempts learn</h2><p>A responder may try a trick outside their catalogue. Similar known tricks improve the odds, and every forced attempt adds practice for the next time it returns.</p></article>
      <article><b>05</b><h2>Reuse it later</h2><p>The same called trick cannot appear twice in a row. It can return on a later turn, when the responder&apos;s accumulated practice may make it less effective.</p></article>
      <article><b>06</b><h2>Spectate freely</h2><p>No NFT is required to watch or make play-point predictions. Real-money wagering stays disabled unless a licensed, compliant partner operates it.</p></article>
    </section>
  </main>;
}
