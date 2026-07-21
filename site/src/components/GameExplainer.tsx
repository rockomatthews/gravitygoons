import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

const athletes = [
  {
    id: 34,
    species: "BOAR",
    brand: "MIKE",
    image: "/collection/production-preview/0034.png",
    record: "18–7",
    rating: "1,684",
    letters: "SK",
    stats: { SPD: 5, AIR: 7, CTL: 6, STY: 8, TGH: 4 },
    moves: [
      { name: "360 FLIP", difficulty: 7, chance: 58, originality: 100 },
      { name: "KICKFLIP", difficulty: 4, chance: 79, originality: 78 },
      { name: "BOARDSLIDE", difficulty: 5, chance: 72, originality: 100 },
    ],
    accent: "#18f1dc",
  },
  {
    id: 35,
    species: "RACCOON",
    brand: "PROCRASTIGONIA",
    image: "/collection/production-preview/0035.png",
    record: "14–9",
    rating: "1,597",
    letters: "S",
    stats: { SPD: 5, AIR: 6, CTL: 7, STY: 8, TGH: 4 },
    moves: [
      { name: "HARD FLIP", difficulty: 8, chance: 51, originality: 100 },
      { name: "HEELFLIP", difficulty: 4, chance: 80, originality: 100 },
      { name: "OLLIE", difficulty: 2, chance: 94, originality: 56 },
    ],
    accent: "#ff4b35",
  },
];

export function GameExplainer() {
  return (
    <section className="game-primer shell" id="how-to-play">
      <div className="primer-heading">
        <div>
          <p className="eyebrow">ONE ARENA // TWO WAYS IN</p>
          <h2>Own the athlete.<br /><i>Or call the winner.</i></h2>
        </div>
        <p>Gravity Goons begins as a strategic card-versus-card action-sports battle. Players call tricks from an athlete&apos;s arsenal. Spectators follow every choice, percentage, letter, and result—without needing an NFT.</p>
      </div>

      <div className="primer-personas">
        <article>
          <span className="persona-number">01</span>
          <div><b>NFT OWNER // COMPETE</b><h3>Your Goon. Your calls. Their career.</h3><p>Enter discipline-matched battles, lock a trick in secret, manage risk and originality, earn wins, attract sponsors, and expand the NFT&apos;s permanent trick arsenal.</p></div>
        </article>
        <article>
          <span className="persona-number">02</span>
          <div><b>SPECTATOR // PREDICT</b><h3>No NFT required.</h3><p>Connect a Base wallet, inspect both athletes, follow visible landing percentages, and make free play-point predictions. Play points have no cash value.</p></div>
        </article>
      </div>

      <div className="battle-console" aria-label="Concept preview of a Gravity Goons card battle">
        <div className="console-grid" aria-hidden="true" />
        <div className="console-topline"><span>RANKED // SKATEBOARDING</span><b>ROUND 03</b><span>RULESET 0.2</span></div>
        <div className="battle-cards">
          {athletes.map((athlete, athleteIndex) => (
            <article className={`battle-card battle-card-${athleteIndex + 1}`} style={{ "--card-accent": athlete.accent } as CSSProperties} key={athlete.id}>
              <div className="battle-card-image">
                <Image src={athlete.image} alt={`Gravity Goons #${String(athlete.id).padStart(4, "0")} ${athlete.species}`} width={1024} height={1024} sizes="(max-width: 760px) 88vw, 36vw" />
                <span>#{String(athlete.id).padStart(4, "0")}</span>
                <b>{athlete.letters || "—"}</b>
              </div>
              <div className="battle-card-copy">
                <div className="battle-identity"><div><span>{athlete.species} {"//"} {athlete.brand}</span><h3>GOON #{String(athlete.id).padStart(4, "0")}</h3></div><div><span>RECORD</span><b>{athlete.record}</b></div></div>
                <div className="battle-stat-row">{Object.entries(athlete.stats).map(([stat, value]) => <span key={stat}>{stat}<i><em style={{ width: `${value * 10}%` }} /></i><b>{value}</b></span>)}</div>
                <div className="arsenal-label"><span>TRICK ARSENAL</span><b>RATING {athlete.rating}</b></div>
                <div className="move-stack">{athlete.moves.map((move, index) => <div className={index === 0 ? "move-card selected" : "move-card"} key={move.name}><span>D{move.difficulty}</span><b>{move.name}</b><small>LAND <strong>{move.chance}%</strong></small><small>ORIG <strong>{move.originality}%</strong></small></div>)}</div>
              </div>
            </article>
          ))}
          <div className="battle-versus"><span>LOCKED</span><b>VS</b><small>REVEAL IN 03</small></div>
        </div>
        <div className="resolution-rail">
          <span><i>1</i> CHOOSE</span><span><i>2</i> SIGN + LOCK</span><span><i>3</i> REVEAL</span><span><i>4</i> RESOLVE</span><span><i>5</i> SETTLE</span>
        </div>
      </div>

      <div className="record-layers">
        <article><span>NFT GENESIS</span><h3>Stats that matter</h3><p>Speed, Air, Control, Style, Toughness, discipline, stance, and signature trick are visible before mint and shape every matchup.</p><b>IMMUTABLE CHARACTER DNA</b></article>
        <article><span>MATCH RECORD</span><h3>History you can audit</h3><p>Wins, losses, rating, streaks, selections, originality, and the revealed resolution seed form a signed match transcript.</p><b>SERVER-VERIFIED + REPLAYABLE</b></article>
        <article><span>BASE PROGRESSION</span><h3>Progress that travels</h3><p>Settled XP, level, unlocked-trick bitmap, achievements, sponsor history, and progression nonce remain attached to the NFT.</p><b>ONCHAIN CAREER STATE</b></article>
      </div>

      <div className="primer-cta"><p><b>SKATE. SHRED. WAVES. BIKE. MOTO. SLOPE.</b><span>Lose rounds. Take letters. Spell the word and the match is over.</span></p><Link className="button primary" href="/game">OPEN THE PVP LAB</Link></div>
    </section>
  );
}
