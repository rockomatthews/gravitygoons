import Image from "next/image";
import Link from "next/link";

export default function ProfileLoading() {
  return <main className="athlete-profile-page" aria-busy="true">
    <header className="nav shell">
      <Link className="brand" href="/"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link>
      <nav><Link href="/collection">Roster</Link><Link href="/arena">Arena</Link><Link href="/profile">Wallet Profile</Link></nav>
    </header>
    <section className="athlete-profile-hero shell">
      <div className="athlete-profile-image profile-loading-card" />
      <div className="athlete-profile-intro">
        <p className="eyebrow">NFT ATHLETE // LOADING LIVE CAREER</p>
        <h1>Opening Goon profile…</h1>
        <p className="athlete-build">The NFT identity is ready. Live ownership, ranking, movies, and match history are loading now.</p>
        <div className="athlete-record-grid"><div><b>—</b><span>RECORD</span></div><div><b>—</b><span>RANK</span></div><div><b>—</b><span>ELO</span></div><div><b>—</b><span>LEVEL</span></div></div>
      </div>
    </section>
  </main>;
}
