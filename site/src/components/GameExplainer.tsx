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
      { name: "360 FLIP", difficulty: 7, chance: 58, status: "CALLED" },
      { name: "KICKFLIP", difficulty: 4, chance: 79, status: "CATALOGUE" },
      { name: "BOARDSLIDE", difficulty: 5, chance: 72, status: "CATALOGUE" },
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
      { name: "360 FLIP", difficulty: 7, chance: 46, status: "TEMP TRY" },
      { name: "HEELFLIP", difficulty: 4, chance: 80, status: "SIMILAR" },
      { name: "OLLIE", difficulty: 2, chance: 94, status: "CATALOGUE" },
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
        <p>Gravity Goons plays like SKATE and HORSE. One player has 60 seconds to call a trick. Land it and the opponent&apos;s required replication runs automatically; miss the replication and take a letter. Grit creates visible offensive strategy that spectators can follow without owning an NFT.</p>
      </div>

      <div className="primer-personas">
        <article>
          <span className="persona-number">01</span>
          <div><b>NFT OWNER // COMPETE</b><h3>Your Goon. Your calls. Their career.</h3><p>Choose a trick your Goon knows, land it to set the challenge, and force the opponent to answer. Earn wins, attract sponsors, and expand the NFT&apos;s permanent trick catalogue.</p></div>
        </article>
        <article>
          <span className="persona-number">02</span>
          <div><b>SPECTATOR // PREDICT</b><h3>No NFT required.</h3><p>Connect a Base wallet, inspect both athletes, follow visible landing percentages, and make free play-point predictions. Play points have no cash value.</p></div>
        </article>
      </div>

      <div className="battle-console" aria-label="Concept preview of a Gravity Goons card battle">
        <div className="console-grid" aria-hidden="true" />
        <div className="console-topline"><span>RANKED // SKATEBOARDING</span><b>TURN 03</b><span>RULESET 0.4</span></div>
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
                <div className="move-stack">{athlete.moves.map((move, index) => <div className={index === 0 ? "move-card selected" : "move-card"} key={`${move.name}-${index}`}><span>D{move.difficulty}</span><b>{move.name}</b><small>LAND <strong>{move.chance}%</strong></small><small>{move.status}</small></div>)}</div>
              </div>
            </article>
          ))}
          <div className="battle-versus"><span>CALLED</span><b>360</b><small>SET // ANSWER</small></div>
        </div>
        <div className="resolution-rail">
          <span><i>1</i> CALL</span><span><i>2</i> SETTER TRIES</span><span><i>3</i> RESPONDER TRIES</span><span><i>4</i> LETTER OR TURN</span><span><i>5</i> NEXT CALL</span>
        </div>
      </div>

      <div className="record-layers">
        <article><span>NFT GENESIS</span><h3>Stats that matter</h3><p>Speed, Air, Control, Style, Toughness, discipline, stance, and signature trick are visible before mint and shape every matchup.</p><b>IMMUTABLE CHARACTER DNA</b></article>
        <article><span>MATCH RECORD</span><h3>History you can audit</h3><p>Every call, attempt, chance, learning bonus, letter, turn change, and revealed resolution seed forms a signed match transcript.</p><b>SERVER-VERIFIED + REPLAYABLE</b></article>
        <article><span>BASE PROGRESSION</span><h3>Progress that travels</h3><p>Settled XP, level, unlocked-trick bitmap, achievements, sponsor history, and progression nonce remain attached to the NFT.</p><b>ONCHAIN CAREER STATE</b></article>
      </div>

      <div className="primer-cta"><p><b>SKATE. SHRED. WAVES. BIKE. MOTO. SLOPE.</b><span>Miss the answer. Take a letter. Spell the word and the match is over.</span></p><Link className="button primary" href="/game">OPEN THE PVP LAB</Link></div>
    </section>
  );
}
