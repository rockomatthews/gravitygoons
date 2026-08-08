"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createWalletClient, custom, formatEther, getAddress, isAddress } from "viem";
import { base } from "viem/chains";
import { collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { useWallet } from "@/components/WalletProvider";
import { signatureEdgeForRarity } from "@/lib/gameplay";
import { ACTIVE_RULESET_HASH } from "@/lib/match-terms";
import { ensureProfileSession } from "@/lib/profile-auth-client";
import { athleteRankLabel } from "@/lib/rank-display";

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
  ownerName?: string;
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
type CompetitionProduct = "ranked" | "usdc" | "pink_slip";

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
  const { account, connect, provider, signMessage, signProfileChallenge, message: walletMessage } = useWallet();
  const normalizedAccount = account?.toLowerCase() ?? null;
  const [discipline, setDiscipline] = useState("All");
  const [cast, setCast] = useState("All");
  const [bodyBuild, setBodyBuild] = useState("All");
  const [rarity, setRarity] = useState("All");
  const [brand, setBrand] = useState("All");
  const [playStyle, setPlayStyle] = useState("All");
  const [availabilityFilter, setAvailabilityFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState("");
  const [availableIds, setAvailableIds] = useState<Set<number> | null>(null);
  const [directOwnedIds, setDirectOwnedIds] = useState<Set<number>>(new Set());
  const [saleOpen, setSaleOpen] = useState(false);
  const [liveById, setLiveById] = useState<Map<number, AthleteLive>>(new Map());
  const [challengeTarget, setChallengeTarget] = useState<Token | null>(null);
  const [challengerTokenId, setChallengerTokenId] = useState<number | null>(null);
  const [challengeStart, setChallengeStart] = useState("");
  const [challengeBounds, setChallengeBounds] = useState({ min: "", max: "" });
  const [competitionProduct, setCompetitionProduct] = useState<CompetitionProduct>("ranked");
  const [stakeMinor, setStakeMinor] = useState(1_000_000);
  const [transferTarget, setTransferTarget] = useState<Token | null>(null);
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const challengeLinkHandled = useRef(false);

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

  const refreshConnectedOwnership = useCallback(async () => {
    if (!normalizedAccount || collectionAddress === ZERO_ADDRESS || availableIds === null) {
      setDirectOwnedIds(new Set());
      return;
    }
    try {
      const response = await fetch(`/api/ownership?wallet=${encodeURIComponent(normalizedAccount)}`, { cache: "no-store" });
      const data = await response.json() as { tokenIds?: number[]; error?: string };
      if (!response.ok || !Array.isArray(data.tokenIds)) throw new Error(data.error ?? "Ownership verification failed.");
      setDirectOwnedIds(new Set(data.tokenIds));
    } catch {
      // Preserve the last confirmed ownership set. A transient RPC failure must
      // never make owned Goons disappear or change the displayed count.
      setStatus("Ownership refresh is temporarily unavailable. Keeping the last verified count.");
    }
  }, [availableIds, normalizedAccount]);

  useEffect(() => {
    const initial = window.setTimeout(refreshConnectedOwnership, 0);
    return () => window.clearTimeout(initial);
  }, [refreshConnectedOwnership]);

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
    const aMine = normalizedAccount && (directOwnedIds.has(a.token_id) || liveById.get(a.token_id)?.owner === normalizedAccount) ? 1 : 0;
    const bMine = normalizedAccount && (directOwnedIds.has(b.token_id) || liveById.get(b.token_id)?.owner === normalizedAccount) ? 1 : 0;
    return bMine - aMine || a.token_id - b.token_id;
  }), [directOwnedIds, filtered, liveById, normalizedAccount]);
  const visible = ordered.slice(0, normalizedAccount ? Math.max(page * PAGE_SIZE, PAGE_SIZE * 3) : page * PAGE_SIZE);
  const myGoons = useMemo(() => {
    if (!normalizedAccount) return [];
    return tokens.filter((token) => directOwnedIds.has(token.token_id) || liveById.get(token.token_id)?.owner === normalizedAccount);
  }, [directOwnedIds, tokens, liveById, normalizedAccount]);

  useEffect(() => {
    if (challengeLinkHandled.current || !normalizedAccount || availableIds === null || !myGoons.length) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = Number(params.get("challengeToken"));
    if (!Number.isInteger(targetId) || targetId < 1 || targetId > 1000) return;
    const target = tokensById.get(targetId);
    const live = liveById.get(targetId);
    if (!target || availableIds.has(targetId) || live?.owner === normalizedAccount || !live?.owner || live.matchId || live.challengeId) return;
    const eligibleMine = myGoons.filter((candidate) => candidate.discipline === target.discipline && !liveById.get(candidate.token_id)?.matchId);
    if (!eligibleMine.length) return;
    challengeLinkHandled.current = true;
    const timer = window.setTimeout(() => {
      setChallengerTokenId(eligibleMine[0].token_id);
      const now = Date.now();
      setChallengeBounds({ min: new Date(now + 30 * 60_000).toISOString().slice(0, 16), max: new Date(now + 7 * 24 * 60 * 60_000).toISOString().slice(0, 16) });
      setChallengeStart("");
      setCompetitionProduct("ranked");
      setChallengeTarget(target);
      params.delete("challengeToken");
      window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}#collection`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [availableIds, liveById, myGoons, normalizedAccount, tokensById]);

  function toggle(tokenId: number) {
    if (availableIds?.has(tokenId) === false) return;
    setSelected((current) => {
      if (current.includes(tokenId)) return current.filter((id) => id !== tokenId);
      if (current.length === 5) return current;
      return [...current, tokenId];
    });
  }

  async function mintSelected() {
    if (collectionAddress === ZERO_ADDRESS) return setStatus("Contract deployment is the remaining launch gate.");
    if (!saleOpen) return setStatus("Public minting is currently closed.");
    if (!selected.length) return setStatus("Choose at least one available Goon.");
    try {
      const connected = await connect();
      if (!connected || !provider) return setStatus("Choose a wallet, then press mint again.");
      const wallet = createWalletClient({ chain: base, transport: custom(provider) });
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

  async function transferGoon() {
    if (!transferTarget) return;
    if (!isAddress(transferRecipient)) return setTransferStatus("Enter a valid Base wallet address.");
    try {
      const connected = account ?? await connect();
      if (!connected || !provider) throw new Error("Connect the wallet that owns this Goon, then try again.");
      if (connected.toLowerCase() !== normalizedAccount) throw new Error("The connected account changed. Reopen the transfer.");
      const recipient = getAddress(transferRecipient);
      if (recipient.toLowerCase() === connected.toLowerCase()) throw new Error("Choose a different recipient wallet.");
      const wallet = createWalletClient({ chain: base, transport: custom(provider) });
      setTransferStatus("Confirm the NFT transfer in your wallet…");
      const hash = await wallet.writeContract({
        address: collectionAddress,
        abi: collectionAbi,
        functionName: "safeTransferFrom",
        args: [connected, recipient, BigInt(transferTarget.token_id)],
        account: connected,
      });
      setTransferStatus(`Transfer submitted ${hash.slice(0, 12)}… Waiting for Base confirmation.`);
      await publicClient.waitForTransactionReceipt({ hash });
      setTransferStatus(`Transfer confirmed. #${String(transferTarget.token_id).padStart(4, "0")} now belongs to ${recipient.slice(0, 6)}…${recipient.slice(-4)}.`);
      await Promise.all([refreshAvailability(), refreshConnectedOwnership(), refreshRoster()]);
    } catch (error) {
      setTransferStatus(error instanceof Error ? error.message.split("\n")[0] : "Transfer cancelled.");
    }
  }

  async function submitChallenge() {
    if (!challengeTarget || !challengerTokenId) return;
    try {
      if (competitionProduct !== "ranked") throw new Error(`${competitionProduct === "usdc" ? "USDC player stakes" : "Pink Slip custody"} remain locked pending their separate legal and independent contract reviews.`);
      const wallet = account ?? await connect();
      if (!wallet) throw new Error("Choose a wallet, then send the challenge again.");
      await ensureProfileSession({ address: wallet, signMessage, signProfileChallenge, onStatus: setStatus });
      const issuedAt = new Date().toISOString();
      if (!challengeStart) throw new Error("Choose a scheduled start time.");
      const proposedStartAt = new Date(challengeStart).toISOString();
      const lines = [
        "Gravity Goons ranked challenge",
        "Action: create",
        `Wallet: ${wallet.toLowerCase()}`,
        `Your Goon: #${String(challengerTokenId).padStart(4, "0")}`,
        `Opponent Goon: #${String(challengeTarget.token_id).padStart(4, "0")}`,
        "Mode: live_ranked",
        proposedStartAt ? `Scheduled: ${proposedStartAt}` : "",
        `Ruleset: ${ACTIVE_RULESET_HASH}`,
        "USDC wager requested: no",
        "House fee bps: 0",
        `Issued: ${issuedAt}`,
        "Ranked play only. No wager or token transfer.",
      ].filter(Boolean).join("\n");
      const signature = await signMessage(lines, wallet);
      const response = await fetch("/api/challenges", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengerTokenId, challengedTokenId: challengeTarget.token_id, matchMode: "live_ranked", proposedStartAt, wagerRequested: false, issuedAt, signature }),
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

      {account && myGoons.length > 0 && <div className="my-goons-strip"><b>MY GOONS · {myGoons.length} OWNED</b><span>{myGoons.map((token) => `#${String(token.token_id).padStart(4, "0")}`).join(" · ")}</span></div>}
      <div className="token-grid">
        {visible.map((token) => {
          const active = selected.includes(token.token_id);
          const available = availableIds?.has(token.token_id) !== false;
          const live = liveById.get(token.token_id);
          const mine = normalizedAccount !== null && (directOwnedIds.has(token.token_id) || live?.owner === normalizedAccount);
          const eligible = !available && !mine && Boolean(live?.owner) && !live?.matchId && !live?.challengeId
            && myGoons.some((candidate) => candidate.discipline === token.discipline && !liveById.get(candidate.token_id)?.matchId);
          const cardStatus = mine
            ? "Owned by you"
            : available
              ? "Available to mint"
              : `Owned by ${live?.ownerName ?? "Goon Holder"}`;
          return (
            <article className={`token-card ${active ? "selected" : ""} ${mine ? "mine" : ""}`} key={token.token_id}>
              <button className="card-image" onClick={() => toggle(token.token_id)} aria-label={available ? `Select ${token.name}` : `${token.name} is owned`} disabled={!available}>
                <Image src={imageBaseUrl + "/" + String(token.token_id).padStart(4, "0") + ".png"} alt={token.name} width={1024} height={1024} />
                <span className={`rarity rarity-${token.rarity.toLowerCase()}`}>{token.rarity}</span>
                <span className="select-mark">{available ? active ? "SELECTED" : "+ SELECT" : mine ? "YOURS" : "OWNED"}</span>
              </button>
              <div className="card-copy">
                <div><b>#{String(token.token_id).padStart(4, "0")}</b><span>{token.discipline}</span></div>
                <h3>{token.species} · {token.body_build}</h3>
                <p className="card-brand">{token.parody_brand} · {token.sport_equipment}</p>
                <p className="card-price">MINT · {displayEth(RARITY_PRICE_WEI[token.rarity] ?? 0n)} ETH</p>
                <p className={`athlete-status status-${cardStatus.toLowerCase().replaceAll(" ", "-")}`}>{cardStatus}</p>
                {!available && !mine && live?.matchId && <p className="athlete-state">IN MATCH</p>}
                {!available && !mine && !live?.matchId && live?.challengeId && <p className="athlete-state">CHALLENGE PENDING</p>}
                <p className="athlete-record">{athleteRankLabel(live?.discipline_rank, live?.matches_played ?? 0)} · {live?.wins ?? 0}W–{live?.losses ?? 0}L · ELO {Math.round(live?.rating ?? 1500)}</p>
                <p className="signature-edge">{token.trick_specialty} · SIGNATURE EDGE +{signatureEdgeForRarity(token.rarity)}%</p>
                <div className="mini-stats"><span>SPD {token.stats.Speed}</span><span>AIR {token.stats.Air}</span><span>CTL {token.stats.Control}</span><span>STY {token.stats.Style}</span><span>TGH {token.stats.Toughness}</span></div>
                {mine && <button className="transfer-button" onClick={() => { setTransferTarget(token); setTransferRecipient(""); setTransferStatus(""); }}>TRANSFER GOON</button>}
                {eligible && <button className="challenge-button" onClick={() => {
                  const eligibleMine = myGoons.filter((candidate) => candidate.discipline === token.discipline && !liveById.get(candidate.token_id)?.matchId);
                  setChallengerTokenId(eligibleMine[0]?.token_id ?? null);
                  const now = Date.now();
                  setChallengeBounds({ min: new Date(now + 30 * 60_000).toISOString().slice(0, 16), max: new Date(now + 7 * 24 * 60 * 60_000).toISOString().slice(0, 16) });
                  setChallengeStart("");
                  setCompetitionProduct("ranked");
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
          <p className="eyebrow">SIGNED LIVE 1V1</p>
          <h2 id="challenge-title">Challenge #{String(challengeTarget.token_id).padStart(4, "0")}</h2>
          <p>Both Goons are rechecked on Base when the challenge is accepted. They must remain owned, unlocked, and in the same discipline.</p>
          <label>YOUR {challengeTarget.discipline.toUpperCase()} GOON
            <select value={challengerTokenId ?? ""} onChange={(event) => setChallengerTokenId(Number(event.target.value))}>
              {myGoons.filter((token) => token.discipline === challengeTarget.discipline).map((token) => <option value={token.token_id} key={token.token_id}>#{String(token.token_id).padStart(4, "0")} · {token.species} · {token.rarity}</option>)}
            </select>
          </label>
          <p className="challenge-live-lock">LIVE RANKED · BOTH PLAYERS CHECK IN · PUBLIC SCOREBOARD</p>
          <div className="competition-products" aria-label="Competition type">
            <button className={competitionProduct === "ranked" ? "active" : ""} onClick={() => setCompetitionProduct("ranked")}><span>RANKED</span><b>NO WAGER</b><small>AVAILABLE NOW</small></button>
            <button className={competitionProduct === "usdc" ? "active locked" : "locked"} onClick={() => setCompetitionProduct("usdc")}><span>USDC STAKE</span><b>1 · 5 · 10 · 25 USDC</b><small>LOCKED · AUDIT + LEGAL GATE</small></button>
            <button className={competitionProduct === "pink_slip" ? "active pink-slip locked" : "pink-slip locked"} onClick={() => setCompetitionProduct("pink_slip")}><span>PINK SLIP</span><b>WINNER TAKES BOTH GOONS</b><small>LOCKED · SEPARATE NFT ESCROW REQUIRED</small></button>
          </div>
          {competitionProduct === "usdc" && <label>PLAYER STAKE · EACH PLAYER<select value={stakeMinor} onChange={(event) => setStakeMinor(Number(event.target.value))}><option value={1_000_000}>1 USDC</option><option value={5_000_000}>5 USDC</option><option value={10_000_000}>10 USDC</option><option value={25_000_000}>25 USDC</option></select></label>}
          {competitionProduct === "pink_slip" && <p className="pink-slip-warning"><b>PINK SLIP — WINNER TAKES BOTH GOONS</b><span>This will require two explicit custody confirmations from each player, Safe-controlled disputes, and a separately audited NFT escrow. It cannot be enabled by opening the mint.</span></p>}
          <label>START TIME · YOUR LOCAL TIME<input type="datetime-local" value={challengeStart} min={challengeBounds.min} max={challengeBounds.max} onChange={(event) => setChallengeStart(event.target.value)} /></label>
          <p className="challenge-money-lock">PLAYER USDC: LOCKED · PINK SLIP: LOCKED · FREE SPECTATOR PICKS: LIVE</p>
          <div className="challenge-comparison">
            <span>{athleteRankLabel(liveById.get(challengerTokenId ?? 0)?.discipline_rank, liveById.get(challengerTokenId ?? 0)?.matches_played ?? 0)}</span>
            <b>{challengeTarget.discipline.toUpperCase()}</b>
            <span>{athleteRankLabel(liveById.get(challengeTarget.token_id)?.discipline_rank, liveById.get(challengeTarget.token_id)?.matches_played ?? 0)}</span>
          </div>
          <button className="button primary" disabled={competitionProduct !== "ranked"} onClick={submitChallenge}>{competitionProduct === "ranked" ? "SIGN + SEND RANKED CHALLENGE" : competitionProduct === "usdc" ? "USDC STAKES LOCKED" : "PINK SLIP LOCKED"}</button>
        </div>
      </div>}
      {transferTarget && <div className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
        <div>
          <button className="challenge-close" onClick={() => setTransferTarget(null)} aria-label="Close transfer">×</button>
          <p className="eyebrow">BASE MAINNET · WALLET CONFIRMATION REQUIRED</p>
          <h2 id="transfer-title">Transfer #{String(transferTarget.token_id).padStart(4, "0")}</h2>
          <p>This moves the NFT to another wallet. Gravity Goons never receives custody and cannot reverse the transfer.</p>
          <label>RECIPIENT BASE ADDRESS
            <input value={transferRecipient} onChange={(event) => setTransferRecipient(event.target.value.trim())} placeholder="0x…" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </label>
          {transferStatus && <p className="transfer-status" aria-live="polite">{transferStatus}</p>}
          <button className="button primary" onClick={transferGoon}>REVIEW IN WALLET</button>
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
