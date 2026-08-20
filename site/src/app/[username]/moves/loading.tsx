import Link from "next/link";

export default function MoveStudioLoading() {
  return <main className="move-studio-owner-page shell" aria-busy="true">
    <div className="profile-empty">
      <b>OPENING MOVE STUDIO</b>
      <p>The Goon and trick catalog are ready. Live movie status and ownership controls are loading.</p>
      <Link className="button" href="/collection">BACK TO ROSTER</Link>
    </div>
  </main>;
}
