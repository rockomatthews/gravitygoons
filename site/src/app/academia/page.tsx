import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AcademiaCampus } from "@/components/AcademiaCampus";
import { WalletButton } from "@/components/WalletButton";

export const metadata: Metadata = { title: "Academia — Gravity Goons", description: "Learn crypto, Base, NFT safety, and how to buy a Gravity Goon. Pass lessons to earn token-bound GRIT." };

export default function AcademiaPage() {
  return <main className="academia-page"><header className="nav shell"><Link href="/" className="brand"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority/></Link><nav><Link href="/gooniverse">Gooniverse</Link><Link href="/collection">Buy a Goon</Link><Link href="/circuit">Circuit</Link></nav><WalletButton/></header><AcademiaCampus/></main>;
}
