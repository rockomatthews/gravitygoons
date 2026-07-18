"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { createWalletClient, custom, parseEther } from "viem";
import { base } from "viem/chains";
import { collectionAbi, collectionAddress, ZERO_ADDRESS } from "@/lib/contracts";

type Token = {
  token_id: number;
  name: string;
  cast: string;
  species: string;
  discipline: string;
  rarity: string;
  expression: string;
  stats: Record<string, number>;
};

const PAGE_SIZE = 24;
const disciplines = ["All", "Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"];

declare global {
  interface Window { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } }
}

export function CollectionGallery({ tokens }: { tokens: Token[] }) {
  const [discipline, setDiscipline] = useState("All");
  const [cast, setCast] = useState("All");
  const [rarity, setRarity] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => tokens.filter((token) => {
    const search = `${token.name} ${token.species} ${token.discipline}`.toLowerCase();
    return (discipline === "All" || token.discipline === discipline)
      && (cast === "All" || token.cast === cast)
      && (rarity === "All" || token.rarity === rarity)
      && search.includes(query.toLowerCase());
  }), [tokens, discipline, cast, rarity, query]);
  const visible = filtered.slice(0, page * PAGE_SIZE);

  function toggle(tokenId: number) {
    setSelected((current) => {
      if (current.includes(tokenId)) return current.filter((id) => id !== tokenId);
      if (current.length === 5) return current;
      return [...current, tokenId];
    });
  }

  async function mintSelected() {
    if (!window.ethereum) return setStatus("Install or open an EVM wallet first.");
    if (collectionAddress === ZERO_ADDRESS) return setStatus("Contract deployment is the remaining launch gate.");
    try {
      setStatus("Connecting wallet…");
      const wallet = createWalletClient({ chain: base, transport: custom(window.ethereum) });
      const [account] = await wallet.requestAddresses();
      setStatus("Confirm the exact-token mint in your wallet…");
      const hash = await wallet.writeContract({
        address: collectionAddress,
        abi: collectionAbi,
        functionName: "mintSelected",
        args: [selected],
        account,
        value: parseEther((0.003 * selected.length).toFixed(3)),
      });
      setStatus(`Submitted ${hash.slice(0, 12)}…`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Mint cancelled.");
    }
  }

  return (
    <div>
      <div className="filter-bar">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search token, species, sport…" />
        <select value={discipline} onChange={(event) => { setDiscipline(event.target.value); setPage(1); }}>{disciplines.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={cast} onChange={(event) => { setCast(event.target.value); setPage(1); }}>{["All", "Animal", "Human"].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={rarity} onChange={(event) => { setRarity(event.target.value); setPage(1); }}>{["All", "Common", "Uncommon", "Rare", "Epic", "Legendary"].map((item) => <option key={item}>{item}</option>)}</select>
        <span className="result-count">{filtered.length} ATHLETES</span>
      </div>

      <div className="token-grid">
        {visible.map((token) => {
          const active = selected.includes(token.token_id);
          return (
            <article className={`token-card ${active ? "selected" : ""}`} key={token.token_id}>
              <button className="card-image" onClick={() => toggle(token.token_id)} aria-label={`Select ${token.name}`}>
                <Image src="/collection/base-concept.png" alt={token.name} width={1024} height={1024} />
                <span className={`rarity rarity-${token.rarity.toLowerCase()}`}>{token.rarity}</span>
                <span className="select-mark">{active ? "SELECTED" : "+ SELECT"}</span>
              </button>
              <div className="card-copy">
                <div><b>#{String(token.token_id).padStart(4, "0")}</b><span>{token.discipline}</span></div>
                <h3>{token.species}</h3>
                <div className="mini-stats"><span>SPD {token.stats.Speed}</span><span>AIR {token.stats.Air}</span><span>CTL {token.stats.Control}</span><span>STY {token.stats.Style}</span></div>
              </div>
            </article>
          );
        })}
      </div>

      {visible.length < filtered.length && <button className="button load" onClick={() => setPage((value) => value + 1)}>Load more athletes</button>}
      <aside className={`mint-dock ${selected.length ? "show" : ""}`}>
        <div><span>YOUR LINEUP</span><b>{selected.map((id) => `#${String(id).padStart(4, "0")}`).join(" · ")}</b></div>
        <button onClick={mintSelected}>MINT {selected.length} · {(selected.length * 0.003).toFixed(3)} ETH</button>
        {status && <p>{status}</p>}
      </aside>
    </div>
  );
}
