"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createWalletClient, custom, formatEther } from "viem";
import { base } from "viem/chains";
import { collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { useWallet } from "@/components/WalletProvider";
import { signatureEdgeForRarity } from "@/lib/gameplay";

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
type AthleteLive = {
  tokenId: number;
  owner?: string;
  matches_played?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  current_streak?: number;
  rating?: number;
  discipline_rank?: number | null;
  matchId?: string;
  challengeId?: string;
  challengeStatus?: string;
};

const PAGE_SIZE = 24;
const disciplines = ["All", "Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"];
const RARITY_PRICE_WEI: Record<string, bigint> = {
  Common: 15_000_000_000_000_000n,
  Uncommon: 22_500_000_000_000_000n,
  Rare: 35_000_000_000_000_000n,
  Epic: 55_000_000_000_000_000n,
  Legendary: 80_000_000_000_000_000n,
};

function displayEth(wei: bigint): string {
  return Number(formatEther(wei)).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function CollectionGallery({ tokens, imageBaseUrl }: { tokens: Token[]; imageBaseUrl: string }) {
  const { account, connect, message: walletMessage } = useWallet();
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
  const [liveById, setLiveById] = useState<Map<number, AthleteLive>>(new Map());
  const [challengeTarget, setChallengeTarget] = useState<Token | null>(null);
  const [challengerTokenId, setChallengerTokenId] = useState<number | null>(null);

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

  const refreshRoster = useCallback(async () => {
    try {
      const response = await fetch("/api/roster", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setLiveById(new Map((data.athletes as AthleteLive[]).map((row) => [row.tokenId, row])));
    } catch { /* chain availability remains usable while lobby data retries */ }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(refreshRoster, 0);
    const timer = window.setInterval(refreshRoster, 15_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refreshRoster]);

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
  const tokensById = useMemo(() => new Map(tokens.map((token) => [token.token_id, token])), [tokens]);
  const selectedTotal = useMemo(() => selected.reduce((total, tokenId) => total + (RARITY_PRICE_WEI[tokensById.get(tokenId)?.rarity ?? ""] ?? 0n), 0n), [selected, tokensById]);
  const ordered = useMemo(() => [...filtered].sort((a, b) => {
    const aMine = liveById.get(a.token_id)?.owner === account?.toLowerCase() ? 1 : 0;
    const bMine = liveById.get(b.token_id)?.owner === account?.toLowerCase() ? 1 : 0;
    return bMine - aMine || a.token_id - b.token_id;
  }), [filtered, liveById, account]);
  const visible = ordered.slice(0, page * PAGE_SIZE);
  const myGoons = useMemo(() => tokens.filter((token) => liveById.get(token.token_id)?.owner === account?.toLowerCase()), [tokens, liveById, account]);

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
      const authoritativePrice = await publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "mintPriceFor", args: [selected] });
      if (authoritativePrice !== selectedTotal) throw new Error("The on-chain rarity price changed. Refresh the collection before minting.");
      setStatus("Confirm the exact-token mint in your wallet…");
      const hash = await wallet.writeContract({
        address: collectionAddress,
        abi: collectionAbi,
        functionName: "mintSelected",
        args: [selected],
        account: connected,
        value: authoritativePrice,
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

  async function submitChallenge() {
    if (!challengeTarget || !challengerTokenId) return;
    try {
      const wallet = account ?? await connect();
      if (!wallet || !window.ethereum) throw new Error("Connect your wallet first.");
      const issuedAt = new Date().toISOString();
      const lines = [
        "Gravity Goons ranked challenge",
        "Action: create",
        `Wallet: ${wallet.toLowerCase()}`,
        `Your Goon: #${String(challengerTokenId).padStart(4, "0")}`,
        `Opponent Goon: #${String(challengeTarget.token_id).padStart(4, "0")}`,
        `Issued: ${issuedAt}`,
        "Ranked play only. No wager or token transfer.",
      ].join("\n");
      const signature = await window.ethereum.request({ method: "personal_sign", params: [lines, wallet] });
      const response = await fetch("/api/challenges", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengerTokenId, challengedTokenId: challengeTarget.token_id, issuedAt, signature }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(`Challenge sent for #${String(challengeTarget.token_id).padStart(4, "0")}. It expires in 72 hours.`);
      setChallengeTarget(null);
      await refreshRoster();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to send challenge."); }
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

      {account && myGoons.length > 0 && <div className="my-goons-strip"><b>MY GOONS</b><span>{myGoons.map((token) => `#${String(token.token_id).padStart(4, "0")}`).join(" · ")}</span></div>}
      <div className="token-grid">
        {visible.map((token) => {
          const active = selected.includes(token.token_id);
          const available = availableIds?.has(token.token_id) !== false;
          const live = liveById.get(token.token_id);
          const mine = live?.owner === account?.toLowerCase();
          const eligible = !available && !mine && Boolean(live?.owner) && !live?.matchId && !live?.challengeId
            && myGoons.some((candidate) => candidate.discipline === token.discipline && !liveById.get(candidate.token_id)?.matchId);
          const cardStatus = mine ? "Owned by you" : available ? "Available to mint" : live?.matchId ? "In match" : live?.challengeId ? "Challenge pending" : eligible ? "Challengeable" : "Held";
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
                <p className="card-price">MINT · {displayEth(RARITY_PRICE_WEI[token.rarity] ?? 0n)} ETH</p>
                <p className={`athlete-status status-${cardStatus.toLowerCase().replaceAll(" ", "-")}`}>{cardStatus}</p>
                <p className="athlete-record">{(live?.matches_played ?? 0) < 5 ? "UNRANKED" : `#${live?.discipline_rank} ${token.discipline}`} · {live?.wins ?? 0}W–{live?.losses ?? 0}L · ELO {Math.round(live?.rating ?? 1500)}</p>
                <p className="signature-edge">{token.trick_specialty} · SIGNATURE EDGE +{signatureEdgeForRarity(token.rarity)}%</p>
                <div className="mini-stats"><span>SPD {token.stats.Speed}</span><span>AIR {token.stats.Air}</span><span>CTL {token.stats.Control}</span><span>STY {token.stats.Style}</span><span>TGH {token.stats.Toughness}</span></div>
                {eligible && <button className="challenge-button" onClick={() => {
                  const eligibleMine = myGoons.filter((candidate) => candidate.discipline === token.discipline && !liveById.get(candidate.token_id)?.matchId);
                  setChallengerTokenId(eligibleMine[0]?.token_id ?? null);
                  setChallengeTarget(token);
                }}>CHALLENGE</button>}
              </div>
            </article>
          );
        })}
      </div>

      {visible.length < ordered.length && <button className="button load" onClick={() => setPage((value) => value + 1)}>Load more athletes</button>}
      {challengeTarget && <div className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-title">
        <div>
          <button className="challenge-close" onClick={() => setChallengeTarget(null)} aria-label="Close challenge">×</button>
          <p className="eyebrow">SIGNED 1V1 · NO WAGER</p>
          <h2 id="challenge-title">Challenge #{String(challengeTarget.token_id).padStart(4, "0")}</h2>
          <p>Both Goons are rechecked on Base when the challenge is accepted. They must remain owned, unlocked, and in the same discipline.</p>
          <label>YOUR {challengeTarget.discipline.toUpperCase()} GOON
            <select value={challengerTokenId ?? ""} onChange={(event) => setChallengerTokenId(Number(event.target.value))}>
              {myGoons.filter((token) => token.discipline === challengeTarget.discipline).map((token) => <option value={token.token_id} key={token.token_id}>#{String(token.token_id).padStart(4, "0")} · {token.species} · {token.rarity}</option>)}
            </select>
          </label>
          <div className="challenge-comparison">
            <span>RANK {(liveById.get(challengerTokenId ?? 0)?.matches_played ?? 0) < 5 ? "UNRANKED" : `#${liveById.get(challengerTokenId ?? 0)?.discipline_rank}`}</span>
            <b>{challengeTarget.discipline.toUpperCase()}</b>
            <span>RANK {(liveById.get(challengeTarget.token_id)?.matches_played ?? 0) < 5 ? "UNRANKED" : `#${liveById.get(challengeTarget.token_id)?.discipline_rank}`}</span>
          </div>
          <button className="button primary" onClick={submitChallenge}>SIGN + SEND CHALLENGE</button>
        </div>
      </div>}
      <aside className={`mint-dock ${selected.length ? "show" : ""}`}>
        <div><span>YOUR LINEUP</span><b>{selected.map((id) => `#${String(id).padStart(4, "0")}`).join(" · ")}</b></div>
        <button onClick={mintSelected} disabled={!saleOpen}>MINT {selected.length} · {displayEth(selectedTotal)} ETH</button>
        {(status || walletMessage) && <p>{status || walletMessage}</p>}
      </aside>
    </div>
  );
}
