"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createWalletClient, custom, parseEther } from "viem";
import { base } from "viem/chains";
import { collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { useWallet } from "@/components/WalletProvider";

type Token = {
  token_id: number;
  name: string;
  cast: string;
  species: string;
  body_build: string;
  discipline: string;
  rarity: string;
  expression: string;
  parody_brand: string;
  play_style: string;
  trick_specialty: string;
  sport_equipment: string;
  bottom: string;
  footwear: string;
  stats: Record<string, number>;
};

const PAGE_SIZE = 24;
const disciplines = ["All", "Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"];

export function CollectionGallery({ tokens, imageBaseUrl }: { tokens: Token[]; imageBaseUrl: string }) {
  const { connect, message: walletMessage } = useWallet();
  const [discipline, setDiscipline] = useState("All");
  const [cast, setCast] = useState("All");
  const [bodyBuild, setBodyBuild] = useState("All");
  const [rarity, setRarity] = useState("All");
  const [brand, setBrand] = useState("All");
  const [playStyle, setPlayStyle] = useState("All");
  const [availabilityFilter, setAvailabilityFilter] = useState("Available");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState("");
  const [availableIds, setAvailableIds] = useState<Set<number> | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);

  const refreshAvailability = useCallback(async () => {
    if (collectionAddress === ZERO_ADDRESS) {
      setAvailableIds(new Set(tokens.map((token) => token.token_id)));
      setSaleOpen(false);
      return;
    }
    try {
      const [open, words] = await Promise.all([
        publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "mintOpen" }),
        Promise.all([1n, 257n, 513n, 769n].map((start) => publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "availabilityWord", args: [start] }))),
      ]);
      const next = new Set<number>();
      words.forEach((word, wordIndex) => {
        const start = wordIndex * 256 + 1;
        for (let bit = 0; bit < 256 && start + bit <= 1000; bit += 1) if ((word & (1n << BigInt(bit))) !== 0n) next.add(start + bit);
      });
      setAvailableIds(next);
      setSaleOpen(open);
      setSelected((current) => current.filter((id) => next.has(id)));
    } catch {
      setStatus("Live Base availability is temporarily unavailable. Retrying…");
    }
  }, [tokens]);

  useEffect(() => {
    const initial = window.setTimeout(refreshAvailability, 0);
    const timer = window.setInterval(refreshAvailability, 15_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refreshAvailability]);

  const filtered = useMemo(() => tokens.filter((token) => {
    const search = `${token.name} ${token.species} ${token.body_build} ${token.discipline} ${token.parody_brand} ${token.play_style} ${token.trick_specialty}`.toLowerCase();
    return (discipline === "All" || token.discipline === discipline)
      && (cast === "All" || token.cast === cast)
      && (bodyBuild === "All" || token.body_build === bodyBuild)
      && (rarity === "All" || token.rarity === rarity)
      && (brand === "All" || token.parody_brand === brand)
      && (playStyle === "All" || token.play_style === playStyle)
      && (availabilityFilter === "All" || (availabilityFilter === "Available" ? availableIds?.has(token.token_id) !== false : availableIds?.has(token.token_id) === false))
      && search.includes(query.toLowerCase());
  }), [tokens, discipline, cast, bodyBuild, rarity, brand, playStyle, availabilityFilter, availableIds, query]);
  const brands = useMemo(() => ["All", ...Array.from(new Set(tokens.map((token) => token.parody_brand))).sort()], [tokens]);
  const visible = filtered.slice(0, page * PAGE_SIZE);

  function toggle(tokenId: number) {
    if (availableIds?.has(tokenId) === false) return;
    setSelected((current) => {
      if (current.includes(tokenId)) return current.filter((id) => id !== tokenId);
      if (current.length === 5) return current;
      return [...current, tokenId];
    });
  }

  async function mintSelected() {
    if (!window.ethereum) return setStatus("Install or open an EVM wallet first.");
    if (collectionAddress === ZERO_ADDRESS) return setStatus("Contract deployment is the remaining launch gate.");
    if (!saleOpen) return setStatus("Public minting is currently closed.");
    if (!selected.length) return setStatus("Choose at least one available Goon.");
    try {
      const connected = await connect();
      if (!connected) return;
      const wallet = createWalletClient({ chain: base, transport: custom(window.ethereum) });
      setStatus("Confirm the exact-token mint in your wallet…");
      const hash = await wallet.writeContract({
        address: collectionAddress,
        abi: collectionAbi,
        functionName: "mintSelected",
        args: [selected],
        account: connected,
        value: parseEther((0.003 * selected.length).toFixed(3)),
      });
      setStatus(`Mint submitted ${hash.slice(0, 12)}… Waiting for Base confirmation.`);
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Mint confirmed. Your Gravity Goons are now in your wallet.");
      setSelected([]);
      await refreshAvailability();
    } catch (error) {
      await refreshAvailability();
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Mint cancelled.");
    }
  }

  return (
    <div>
      <div className="filter-bar">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search token, species, sport…" />
        <select value={discipline} onChange={(event) => { setDiscipline(event.target.value); setPage(1); }}>{disciplines.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={cast} onChange={(event) => { setCast(event.target.value); setPage(1); }}>{["All", "Animal", "Human"].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={bodyBuild} onChange={(event) => { setBodyBuild(event.target.value); setPage(1); }}>{["All", "Lean", "Athletic", "Power", "Compact"].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={rarity} onChange={(event) => { setRarity(event.target.value); setPage(1); }}>{["All", "Common", "Uncommon", "Rare", "Epic", "Legendary"].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={brand} onChange={(event) => { setBrand(event.target.value); setPage(1); }}>{brands.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={playStyle} onChange={(event) => { setPlayStyle(event.target.value); setPage(1); }}>{["All", "Speed", "Air", "Control", "Style", "Toughness"].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={availabilityFilter} onChange={(event) => { setAvailabilityFilter(event.target.value); setPage(1); }}>{["Available", "Sold", "All"].map((item) => <option key={item}>{item}</option>)}</select>
        <span className={`result-count ${saleOpen ? "live" : ""}`}>{saleOpen ? "● MINT LIVE" : "MINT CLOSED"} · {availableIds?.size ?? "—"} LEFT</span>
      </div>

      <div className="token-grid">
        {visible.map((token) => {
          const active = selected.includes(token.token_id);
          const available = availableIds?.has(token.token_id) !== false;
          return (
            <article className={`token-card ${active ? "selected" : ""} ${available ? "" : "sold"}`} key={token.token_id}>
              <button className="card-image" onClick={() => toggle(token.token_id)} aria-label={available ? `Select ${token.name}` : `${token.name} is sold`} disabled={!available}>
                <Image src={imageBaseUrl + "/" + String(token.token_id).padStart(4, "0") + ".png"} alt={token.name} width={1024} height={1024} />
                <span className={`rarity rarity-${token.rarity.toLowerCase()}`}>{token.rarity}</span>
                <span className="select-mark">{available ? active ? "SELECTED" : "+ SELECT" : "SOLD"}</span>
              </button>
              <div className="card-copy">
                <div><b>#{String(token.token_id).padStart(4, "0")}</b><span>{token.discipline}</span></div>
                <h3>{token.species} · {token.body_build}</h3>
                <p className="card-brand">{token.parody_brand} · {token.sport_equipment}</p>
                <div className="mini-stats"><span>SPD {token.stats.Speed}</span><span>AIR {token.stats.Air}</span><span>CTL {token.stats.Control}</span><span>STY {token.stats.Style}</span><span>TGH {token.stats.Toughness}</span></div>
              </div>
            </article>
          );
        })}
      </div>

      {visible.length < filtered.length && <button className="button load" onClick={() => setPage((value) => value + 1)}>Load more athletes</button>}
      <aside className={`mint-dock ${selected.length ? "show" : ""}`}>
        <div><span>YOUR LINEUP</span><b>{selected.map((id) => `#${String(id).padStart(4, "0")}`).join(" · ")}</b></div>
        <button onClick={mintSelected} disabled={!saleOpen}>MINT {selected.length} · {(selected.length * 0.003).toFixed(3)} ETH</button>
        {(status || walletMessage) && <p>{status || walletMessage}</p>}
      </aside>
    </div>
  );
}
