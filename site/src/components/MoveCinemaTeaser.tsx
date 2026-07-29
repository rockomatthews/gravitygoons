import Link from "next/link";

export function MoveCinemaTeaser({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`move-cinema ${compact ? "move-cinema-compact" : ""}`}>
      <div className="move-cinema-preview">
        <video
          aria-label="Example five-second Gravity Goons move clip"
          autoPlay
          controls
          loop
          muted
          playsInline
          poster="/media/playing-hard-poster.jpg"
          preload="metadata"
        >
          <source src="/media/playing-hard-teaser.mp4" type="video/mp4" />
        </video>
        <div className="move-cinema-hud">
          <span>OWNER-RENDERED MOVE // 05.0 SEC</span>
          <b>READY FOR INSTANT REPLAY</b>
        </div>
      </div>

      <div className="move-cinema-copy">
        <p className="eyebrow">MOVE CINEMA // CONCEPT TEASER</p>
        <h2>Render once.<br /><i>Replay at game speed.</i></h2>
        <p>
          Owners can commission short clips for tricks their Goon has already
          unlocked. The clip is generated away from the live match, reviewed,
          saved to the NFT&apos;s presentation library, and delivered instantly
          whenever that move is called.
        </p>
        <div className="move-cinema-badges">
          <span>NO LIVE AI WAIT</span>
          <span>COSMETIC ONLY</span>
          <span>OWNER FUNDED</span>
          <span>CDN READY</span>
        </div>
        {compact ? (
          <Link className="button primary" href="/moves">Explore Move Studio</Link>
        ) : (
          <div className="move-cinema-status">
            <b>PREVIEW ONLY</b>
            <span>Payments and generation stay closed until the job, moderation, storage, and refund pipeline is ready.</span>
          </div>
        )}
      </div>
    </section>
  );
}
