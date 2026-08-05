import { TRICK_CATALOG, type Discipline } from "@/lib/pvp";
import Link from "next/link";

export function CharacterMoveLibrary({
  discipline,
  tokenId,
}: {
  discipline: Discipline;
  tokenId: number;
}) {
  const unlockedMoves = TRICK_CATALOG[discipline].filter((trick) => trick.sponsorId === null);

  return (
    <section className="character-move-library">
      <div className="character-move-heading">
        <div>
          <p className="eyebrow">NFT PROFILE // MOVE MOVIES</p>
          <h2>Build this Goon&apos;s reel.</h2>
        </div>
        <p>
          The current NFT holder can create a five-second Seevio movie for
          any unlocked move that still lacks one. Drafts return here for
          approval or rejection before they can appear in a match broadcast.
        </p>
      </div>

      <div className="character-move-summary">
        <div><span>GOON</span><b>#{String(tokenId).padStart(4, "0")}</b></div>
        <div><span>UNLOCKED MOVES</span><b>{unlockedMoves.length}</b></div>
        <div><span>APPROVED MOVIES</span><b>0</b></div>
        <div><span>DRAFTS TO REVIEW</span><b>0</b></div>
      </div>

      <div className="character-move-grid">
        {unlockedMoves.map((trick) => (
          <article key={trick.id}>
            <div><span>DIFFICULTY {trick.difficulty}</span><i>NO MOVIE</i></div>
            <h3>{trick.name}</h3>
            <p>Uses the shared {discipline} choreography template, then adapts it to this Goon&apos;s identity, equipment, stance, and earned sponsor stack.</p>
            <Link href="/profile">CONNECT OWNER</Link>
          </article>
        ))}
      </div>

      <div className="character-move-approval">
        <div><span>REQUEST</span><b>Choose an unlocked move and approve a USDC or future game-credit quote.</b></div>
        <i>→</i>
        <div><span>SEEVIO JOB</span><b>Generate asynchronously from the NFT image and reviewed trick recipe.</b></div>
        <i>→</i>
        <div><span>OWNER REVIEW</span><b>Approve, reject, or use an included reroll before publishing.</b></div>
      </div>
      <p className="character-move-note">LIVE WORKFLOW: WALLET SIGNATURE → OWNERSHIP CHECK → USDC QUOTE → LAND + FALL JOBS → SEPARATE OWNER APPROVALS.</p>
    </section>
  );
}
