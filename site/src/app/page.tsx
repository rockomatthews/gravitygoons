import collection from "@/data/collection.json";
import { CollectionGallery } from "@/components/CollectionGallery";
import { ZeroGBar } from "@/components/ZeroGBar";
import { WalletButton } from "@/components/WalletButton";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const collectionImageBaseUrl = (process.env.NEXT_PUBLIC_COLLECTION_IMAGE_BASE_URL
    ?? "https://bafybeignb4b2xm55obk2x66vyrvmg62pgu7gutoopb4xdt2f43kgjrhzrq.ipfs.dweb.link").replace(/\/$/, "");
  const collectionReady = Boolean(collectionImageBaseUrl);

  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top" aria-label="Gravity Goons home">
          <Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority />
        </a>
        <nav><Link href="/arena">Live Arena</Link><Link href="/collection">Enter the Roster</Link><Link href="/gooniverse">Gooniverse</Link><Link className="roadmap-link" href="/roadmap">Roadmap</Link></nav>
        <WalletButton />
      </header>

      <ZeroGBar />

      <section className="collection-section shell" id="collection">
        <div className="section-heading"><div><p className="eyebrow">{collectionReady ? "THE LIVE COLLECTION LOBBY" : "FINAL RENDER PREVIEW"}</p><h2>{collectionReady ? "Own one. Rank one. Challenge one." : "Real Goons. Real collection art."}</h2></div><p>{collectionReady ? "All 1,000 athletes live here. See exact-ID tier prices, ownership, records, discipline rank, match state, and same-discipline challenge eligibility. Public exact-ID minting is open on Base." : "Preview accepted final renders pulled directly from the production collection."}</p></div>
        <CollectionGallery tokens={collection.tokens} imageBaseUrl={collectionImageBaseUrl} />
      </section>

      <footer className="shell"><span>GRAVITY GOONS © 2026</span><span>BUILT TO BREAK GRAVITY · BASE ERC-721</span><span>GRAVITYGOONS.COM</span></footer>
    </main>
  );
}
