import Image from "next/image";
import Link from "next/link";
import { ArenaLobby } from "@/components/ArenaLobby";
import { WalletButton } from "@/components/WalletButton";

export default function ArenaPage() {
  return <main className="public-arena-page">
    <header className="nav shell"><Link className="brand" href="/"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link><nav><Link href="/">Collection</Link><Link href="/game">Game Lab</Link><Link href="/profile">Profile</Link></nav><WalletButton /></header>
    <section className="arena-public-hero shell"><p className="eyebrow">PUBLIC BROADCAST // NO NFT REQUIRED</p><h1>THE<br /><i>ARENA</i></h1><p>See what is live, know what is coming, follow every letter, and check the authoritative result. Watching never requires a wallet. Free predictions require only a signed profile session.</p><div><span><b>6</b> DISCIPLINES</span><span><b>1V1</b> AUTHORITATIVE</span><span><b>0</b> REAL-MONEY GATES OPEN</span></div></section>
    <section className="arena-feed shell"><ArenaLobby /></section>
  </main>;
}
