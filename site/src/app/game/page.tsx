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
    <section className="game-hero shell"><p className="eyebrow">LOCAL 1V1 RULES LAB // V0.4</p><h1>CALL IT.<br /><i>LAND IT.</i><br />DON&apos;T SPELL OUT.</h1><p>This is turn-based SKATE, not a points contest. The setter chooses a trick and can spend scarce Grit to send a harder version. If it lands, the second player chooses whether to trust their Goon or spend Grit to focus the answer. Stats, catalogue breadth, practice, visible pressure, and resource timing all matter.</p></section>
    <section id="outcomes" className="shell game-outcome-teaser"><TrickOutcomeTeaser /></section>
    <section id="cinema" className="shell game-cinema-teaser"><MoveCinemaTeaser compact /></section>
    <section id="arena" className="shell"><GameArena goons={goons} /></section>
    <section id="rules" className="game-rules shell">
      <article><b>01</b><h2>Call a known trick</h2><p>The setter chooses from that Goon&apos;s permanent catalogue. Sponsor progression expands which tricks the Goon is allowed to call.</p></article>
      <article><b>02</b><h2>Land it to set it</h2><p>The setter attempts first. If they miss, no letter is given and the opponent takes the next call.</p></article>
      <article><b>03</b><h2>Answer or take a letter</h2><p>If the setter lands, the responder attempts the exact same trick. Land it and take the call; miss it and take the next letter.</p></article>
      <article><b>04</b><h2>Spend Grit wisely</h2><p>Each player gets three Grit. Spend one while setting to SEND IT, or save it to add eight points to a forced answer. Once it is spent, it is gone for the match.</p></article>
      <article><b>05</b><h2>Adapt before pressure hits</h2><p>Forced practice adds two points per repeat, capped at six. After four letterless turns, visible crowd pressure steadily reduces the responder&apos;s chance until a letter resets the heat.</p></article>
      <article><b>06</b><h2>Lock predictions first</h2><p>No NFT is required to watch or make free play-point predictions. Predictions lock at the first call. USDC player stakes and spectator markets remain gated until authoritative settlement and partner compliance are live.</p></article>
    </section>
  </main>;
}
