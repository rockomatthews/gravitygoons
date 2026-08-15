import Image from "next/image";
import Link from "next/link";
import { ArenaMatchView } from "@/components/ArenaMatchView";
import { WalletButton } from "@/components/WalletButton";

export default async function ArenaMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="public-arena-page"><header className="nav shell"><Link className="brand" href="/"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link><nav><Link href="/arena">Arena</Link><Link href="/game">Game Lab</Link><Link href="/profile">Profile</Link></nav><WalletButton /></header><section className="match-broadcast shell"><ArenaMatchView matchId={id} /></section></main>;
}
