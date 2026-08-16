import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BlackoutCircuit } from "@/components/BlackoutCircuit";
import { WalletButton } from "@/components/WalletButton";

export const metadata: Metadata = { title: "Blackout Circuit — Gravity Goons", description: "A five-level, stat-driven Gravity Goons career campaign. One owned Goon is all you need." };

export default function CircuitPage() {
  return <main className="circuit-page"><header className="nav shell"><Link href="/" className="brand"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority/></Link><nav><Link href="/gooniverse">Gooniverse</Link><Link href="/arena">Arena</Link><Link href="/collection">Roster</Link></nav><WalletButton/></header><div className="shell"><BlackoutCircuit/></div></main>;
}
