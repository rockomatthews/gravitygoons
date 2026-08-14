import Image from "next/image";
import Link from "next/link";
import collection from "@/data/collection.json";
import { AthleteChallengeAction } from "@/components/AthleteChallengeAction";
import { athleteRankLabel } from "@/lib/rank-display";
import type { getAthleteProfile } from "@/lib/athlete-profile";

type Profile = NonNullable<Awaited<ReturnType<typeof getAthleteProfile>>>;

function label(value: string) { return value.replaceAll("_", " "); }

export function AthleteProfilePage({ profile }: { profile: Profile }) {
  const { token, career, record, ownership } = profile;
  const eligibleTokenIds = collection.tokens.filter((item) => item.discipline === token.discipline).map((item) => item.token_id);
  const listing = profile.listing as { currency?: string; price_minor?: string } | null;
  const price = listing?.price_minor ? `${Number(listing.price_minor) / (listing.currency === "USDC" ? 1e6 : 1e18)} ${listing.currency}` : null;
  const unlocked = career.unlockedTricks ?? [];
  const locked = career.lockedTricks ?? [];

  return <main className="athlete-profile-page">
    <header className="nav shell">
      <Link className="brand" href="/"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link>
      <nav><Link href="/collection">Roster</Link><Link href="/arena">Arena</Link><Link href="/profile">Wallet Profile</Link></nav>
    </header>

    <section className="athlete-profile-hero shell">
      <div className="athlete-profile-image"><Image src={profile.imageUrl} alt={token.name} width={1024} height={1024} priority /><span>{token.rarity}</span></div>
      <div className="athlete-profile-intro">
        <p className="eyebrow">NFT ATHLETE {"//"} #{String(token.token_id).padStart(4, "0")} {"//"} {token.discipline}</p>
        <h1>{token.name}</h1>
        <p className="athlete-build">{token.species} · {token.body_build} · {token.play_style} build</p>
        <div className="athlete-record-grid">
          <div><b>{record.wins}–{record.losses}</b><span>RECORD</span></div>
          <div><b>{athleteRankLabel(record.discipline_rank, record.matches_played)}</b><span>{token.discipline.toUpperCase()} RANK</span></div>
          <div><b>{Math.round(record.rating)}</b><span>ELO</span></div>
          <div><b>LVL {career.economy.level}</b><span>{career.economy.xp} XP</span></div>
        </div>
        <div className="athlete-owner-state">
          <span>{ownership.minted ? "OWNED ON BASE" : "AVAILABLE TO MINT"}</span>
          {profile.ownerProfile ? <Link href={`/${profile.ownerProfile.username}`}>{profile.ownerProfile.display_name} →</Link> : ownership.owner ? <code>{ownership.owner.slice(0, 6)}…{ownership.owner.slice(-4)}</code> : null}
          <b>{price ? `LISTED · ${price}` : ownership.minted ? "NOT FOR SALE" : "PUBLIC MINT"}</b>
        </div>
        <AthleteChallengeAction tokenId={token.token_id} discipline={token.discipline} eligibleTokenIds={eligibleTokenIds} minted={ownership.minted} owner={ownership.owner} locked={Boolean(profile.activeLock || profile.activeChallenge)} />
      </div>
    </section>

    <section className="athlete-profile-body shell">
      <article className="athlete-panel athlete-stats-panel"><p className="eyebrow">COMPETITIVE BUILD</p><h2>Core stats.</h2><div className="large-stats">{Object.entries(token.stats).map(([name, value]) => <div key={name}><span>{name}</span><b>{value}</b><i style={{ width: `${value * 10}%` }} /></div>)}</div><p><b>SIGNATURE:</b> {token.trick_specialty}</p></article>
      <article className="athlete-panel"><p className="eyebrow">CAREER LOADOUT</p><h2>Progress.</h2><dl className="athlete-career-dl"><div><dt>Sponsors</dt><dd>{profile.sponsors.length}</dd></div><div><dt>Trophies</dt><dd>{career.trophies.length}</dd></div><div><dt>Equipment</dt><dd>{career.inventory.length}</dd></div><div><dt>Lifetime GRIT</dt><dd>{career.economy.lifetime_grit_earned}</dd></div></dl>{profile.sponsors.length ? <ul>{profile.sponsors.map((sponsor) => <li key={sponsor.sponsor_id}>{label(sponsor.sponsor_id)} · accepted at {sponsor.accepted_at_wins} wins</li>)}</ul> : <p>No sponsor signed yet.</p>}</article>
    </section>

    <section className="athlete-tricks shell">
      <header><div><p className="eyebrow">CANONICAL ARSENAL</p><h2>Unlocked and locked tricks.</h2></div><p>{unlocked.length} unlocked · {locked.length} still to master. Approved move movies appear beside their trick.</p></header>
      <div className="athlete-trick-grid">
        {unlocked.map((trick) => { const movie = profile.moveMovies[String(trick.id)] ?? profile.moveMovies[trick.id]; return <article className="unlocked" key={trick.id}><span>UNLOCKED · D{trick.difficulty}</span><b>{trick.name}</b>{movie?.videoUrl ? <video controls playsInline preload="metadata" poster={movie.posterUrl ?? undefined} src={movie.videoUrl} /> : <small>MOVIE NOT CREATED YET</small>}</article>; })}
        {locked.map((trick) => <article className="locked" key={trick.id}><span>LOCKED · D{trick.difficulty}</span><b>{trick.name}</b><small>SPONSOR OR TRICK LINE MASTERY REQUIRED</small></article>)}
      </div>
    </section>

    <section className="athlete-history shell"><header><p className="eyebrow">AUTHORITATIVE MATCH HISTORY</p><h2>Every result.</h2></header><div>{profile.matches.map((match) => <Link href={`/arena/matches/${match.id}`} key={match.id}><b className={`outcome-${match.outcome}`}>{String(match.outcome).toUpperCase()}</b><span>VS #{String(match.opponentTokenId).padStart(4, "0")}</span><span>{match.match_mode ?? "RANKED"}</span><time>{new Date(match.completed_at ?? match.created_at).toLocaleDateString("en-US")}</time></Link>)}{!profile.matches.length && <p>No completed matches yet.</p>}</div></section>

    <section className="athlete-metadata shell"><p className="eyebrow">IMMUTABLE GENESIS METADATA</p><dl>{["cast","species","archetype","body_build","expression","parody_brand","headwear","eyewear","apparel","bottom","footwear","sport_equipment","stance","play_style","trick_specialty","accessory","background"].map((key) => <div key={key}><dt>{label(key)}</dt><dd>{String(token[key as keyof typeof token] ?? "—")}</dd></div>)}</dl></section>
  </main>;
}
