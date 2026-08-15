import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import collection from "@/data/collection.json";
import { CollectionGallery } from "@/components/CollectionGallery";
import { WalletButton } from "@/components/WalletButton";

const DISCIPLINES = new Set(["Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"]);

export const metadata: Metadata = {
  title: "Choose Your Gravity Goon | Live Base NFT Roster",
  description: "Browse all 1,000 Gravity Goons by sport, rarity, traits, and live availability. Choose the exact action-sports athlete you want to mint on Base.",
  alternates: { canonical: "/collection" },
  openGraph: {
    title: "Pick Your Goon. Call Your Trick.",
    description: "Choose an exact-ID Gravity Goon, enter the live 1v1 Arena, and climb your discipline.",
    url: "https://gravitygoons.com/collection",
    images: ["/og-arcade-v2.png"],
  },
};

export default async function CollectionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requestedDiscipline = typeof params.discipline === "string" ? params.discipline : "All";
  const initialDiscipline = DISCIPLINES.has(requestedDiscipline) ? requestedDiscipline : "All";
  const collectionImageBaseUrl = (process.env.NEXT_PUBLIC_COLLECTION_IMAGE_BASE_URL
    ?? "https://bafybeignb4b2xm55obk2x66vyrvmg62pgu7gutoopb4xdt2f43kgjrhzrq.ipfs.dweb.link").replace(/\/$/, "");

  return <main className="collection-campaign-page">
    <header className="nav shell">
      <Link className="brand" href="/" aria-label="Gravity Goons home"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link>
      <nav><Link href="/arena">Live Arena</Link><Link href="/collection" aria-current="page">Roster</Link><Link className="roadmap-link" href="/roadmap">Roadmap</Link></nav>
      <WalletButton />
    </header>
    <section className="collection-campaign-hero shell">
      <p className="eyebrow">1,000 COMPETITORS · SIX SPORTS · ONE CONNECTED LEAGUE</p>
      <h1>Pick your Goon.<br /><i>Call the trick.</i><br />Take the letters.</h1>
      <p>Choose the exact athlete you want. Mint on Base, create your profile, challenge a same-discipline rival, and build an authoritative record in the live Arena.</p>
      <div><Link className="button primary" href="/arena">WATCH THE ARENA</Link><span>{initialDiscipline === "All" ? "ALL DISCIPLINES" : `${initialDiscipline.toUpperCase()} ROSTER`}</span></div>
    </section>
    <section className="collection-section shell" id="collection">
      <div className="section-heading"><div><p className="eyebrow">EXACT-ID MINT · BASE MAINNET</p><h2>Own one. Rank one. Challenge one.</h2></div><p>Filter the complete roster by sport, rarity, traits, play style, or availability. Public tier pricing is calculated directly from the selected Goons.</p></div>
      <CollectionGallery tokens={collection.tokens} imageBaseUrl={collectionImageBaseUrl} initialDiscipline={initialDiscipline} />
    </section>
  </main>;
}
