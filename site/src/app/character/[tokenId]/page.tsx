import collection from "@/data/collection.json";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CharacterPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId: raw } = await params;
  const tokenId = Number(raw);
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000) notFound();
  const token = collection.tokens[tokenId - 1];
  return (
    <main className="character-page shell">
      <Link className="back-link" href="/#collection">← Back to roster</Link>
      <div className="character-layout">
        <div className="character-image"><Image src="/collection/base-concept.png" alt={token.name} width={1024} height={1024} priority /></div>
        <div className="character-detail">
          <p className="eyebrow">{token.rarity} · {token.discipline}</p>
          <h1>{token.name}</h1>
          <p>{token.species} · {token.expression} · {token.stance}</p>
          <div className="large-stats">{Object.entries(token.stats).map(([name, value]) => <div key={name}><span>{name}</span><b>{value}</b><i style={{ width: `${value * 10}%` }} /></div>)}</div>
          <h2>Genesis traits</h2>
          <dl>{["cast", "species", "archetype", "complexion", "headwear", "eyewear", "apparel", "accessory", "background"].map((key) => <div key={key}><dt>{key.replace("_", " ")}</dt><dd>{String(token[key as keyof typeof token])}</dd></div>)}</dl>
          <div className="progress-preview"><span>FUTURE PROGRESSION</span><b>LEVEL 1 · 0 XP · 0/64 TRICKS</b></div>
        </div>
      </div>
    </main>
  );
}
