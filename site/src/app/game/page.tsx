import collection from "@/data/collection.json";
import { GameArena, type ArenaGoon } from "@/components/GameArena";
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
      <nav><Link href="/">Collection</Link><a href="#arena">Arena</a><a href="#rules">Rules</a></nav>
      <WalletButton />
    </header>
    <section className="game-hero shell"><p className="eyebrow">PVP MECHANICS LAB // V0.1</p><h1>CALL IT.<br /><i>LAND IT.</i><br />DON&apos;T SPELL OUT.</h1><p>Two discipline-matched Goons lock tricks in secret. Difficulty sets the risk. Originality decays when a move is repeated. The loser takes the next letter.</p></section>
    <section id="arena" className="shell"><GameArena goons={goons} /></section>
    <section id="rules" className="game-rules shell">
      <article><b>01</b><h2>Hidden selection</h2><p>Both players lock a trick before either choice is revealed. No counter-picking after seeing the opponent&apos;s move.</p></article>
      <article><b>02</b><h2>Risk vs. reward</h2><p>Harder tricks score higher but land less often. Five visible stats shape each athlete&apos;s chance.</p></article>
      <article><b>03</b><h2>Originality decays</h2><p>A trick starts at 100 originality. Every repeat by that athlete in the match removes 22 points, down to a 34-point floor.</p></article>
      <article><b>04</b><h2>Spectate freely</h2><p>No NFT is required to watch or make play-point predictions. Real-money wagering stays disabled unless a licensed, compliant partner operates it.</p></article>
    </section>
  </main>;
}
