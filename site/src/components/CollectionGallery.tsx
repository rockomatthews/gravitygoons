"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createWalletClient, custom, formatEther, formatUnits, getAddress, isAddress, parseEther, parseUnits } from "viem";
import { base } from "viem/chains";
import { Seaport } from "@opensea/seaport-js";
import { ItemType, NO_CONDUIT } from "@opensea/seaport-js/lib/constants";
import { BrowserProvider } from "ethers";
import { collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { useWallet } from "@/components/WalletProvider";
import { signatureEdgeForRarity } from "@/lib/gameplay";
import { ACTIVE_RULESET_HASH } from "@/lib/match-terms";
import { challengeScheduleWindow } from "@/lib/challenge-scheduling";
import { ensureProfileSession } from "@/lib/profile-auth-client";
import { athleteRankLabel } from "@/lib/rank-display";
import { trackMarketingEvent } from "@/lib/analytics";
import { collectionVisibleCount } from "@/lib/collection-pagination";

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
type Listing = { id: string; order_hash: string; token_id: number; offerer_wallet: string; currency: "ETH" | "USDC"; price_minor: string; status: string; expires_at: string; order_payload?: { parameters: Record<string, unknown>; signature: string } };

const SEAPORT_16_ADDRESS = "0x0000000000000068F116a894984e2DB1123eB395";
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

export function CollectionGallery({ tokens, imageBaseUrl, initialDiscipline = "All" }: { tokens: Token[]; imageBaseUrl: string; initialDiscipline?: string }) {
  const router = useRouter();
  const { account, connect, provider, signMessage, signProfileChallenge, message: walletMessage } = useWallet();
  const normalizedAccount = account?.toLowerCase() ?? null;
  const [discipline, setDiscipline] = useState(disciplines.includes(initialDiscipline) ? initialDiscipline : "All");
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
  const [saleOpen, setSaleOpen] = useState<boolean | null>(null);
  const [liveById, setLiveById] = useState<Map<number, AthleteLive>>(new Map());
  const [challengeTarget, setChallengeTarget] = useState<Token | null>(null);
  const [challengerTokenId, setChallengerTokenId] = useState<number | null>(null);
  const [challengeStart, setChallengeStart] = useState("");
  const [challengeBounds, setChallengeBounds] = useState({ min: "", max: "" });
  const [competitionProduct, setCompetitionProduct] = useState<CompetitionProduct>("ranked");
  const [stakeMinor, setStakeMinor] = useState(1_000_000);
  const [challengerGrit, setChallengerGrit] = useState(0);
  const [challengerSpendableGrit, setChallengerSpendableGrit] = useState(0);
  const [transferTarget, setTransferTarget] = useState<Token | null>(null);
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferStatus, setTransferStatus] = useState("");
  const [listingTarget, setListingTarget] = useState<Token | null>(null);
  const [listingPrice, setListingPrice] = useState("");
  const [listingCurrency, setListingCurrency] = useState<"ETH" | "USDC">("ETH");
  const [listingDays, setListingDays] = useState(7);
  const [listingStatus, setListingStatus] = useState("");
  const [listingsById, setListingsById] = useState<Map<number, Listing>>(new Map());
  const [seaportEnabled, setSeaportEnabled] = useState(false);
  const challengeLinkHandled = useRef(false);
  const matchHouseFeeBps = Math.min(250, Math.max(0, Number(process.env.NEXT_PUBLIC_MATCH_ESCROW_FEE_BPS ?? "0")));

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

  const refreshListings = useCallback(async () => {
    try {
      const response = await fetch("/api/listings", { cache: "no-store" });
      const data = await response.json() as { protocol?: { enabled?: boolean }; listings?: Listing[] };
      if (response.ok) {
        setSeaportEnabled(Boolean(data.protocol?.enabled));
        setListingsById(new Map((data.listings ?? []).map((listing) => [listing.token_id, listing])));
      }
    } catch { /* primary mint and roster remain usable */ }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(refreshListings, 0);
    const timer = window.setInterval(refreshListings, 20_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refreshListings]);

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
  const visibleCount = collectionVisibleCount(page, Boolean(normalizedAccount));
  const visible = ordered.slice(0, visibleCount);
  const myGoons = useMemo(() => {
    if (!normalizedAccount) return [];
    return tokens.filter((token) => directOwnedIds.has(token.token_id) || liveById.get(token.token_id)?.owner === normalizedAccount);
  }, [directOwnedIds, tokens, liveById, normalizedAccount]);
  const challengeEligibleByDiscipline = useMemo(() => {
    const eligible = new Map<string, Token[]>();
    for (const token of myGoons) {
      const live = liveById.get(token.token_id);
      if (live?.matchId || live?.challengeId) continue;
      eligible.set(token.discipline, [...(eligible.get(token.discipline) ?? []), token]);
    }
    return eligible;
  }, [liveById, myGoons]);
  const eligibleChallengeGoons = challengeTarget ? challengeEligibleByDiscipline.get(challengeTarget.discipline) ?? [] : [];

  useEffect(() => {
    if (challengeLinkHandled.current || !normalizedAccount || availableIds === null || !myGoons.length) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = Number(params.get("challengeToken"));
    if (!Number.isInteger(targetId) || targetId < 1 || targetId > 1000) return;
    const target = tokensById.get(targetId);
    const live = liveById.get(targetId);
    if (!target || availableIds.has(targetId) || live?.owner === normalizedAccount || !live?.owner || live.matchId || live.challengeId) return;
    const eligibleMine = challengeEligibleByDiscipline.get(target.discipline) ?? [];
    if (!eligibleMine.length) return;
    challengeLinkHandled.current = true;
    const timer = window.setTimeout(() => {
      setChallengerTokenId(null);
      const schedule = challengeScheduleWindow();
      setChallengeBounds({ min: schedule.min, max: schedule.max });
      setChallengeStart(schedule.suggested);
      setCompetitionProduct("ranked");
      setChallengeTarget(target);
      params.delete("challengeToken");
      window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}#collection`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [availableIds, challengeEligibleByDiscipline, liveById, myGoons, normalizedAccount, tokensById]);

  function openChallenge(target: Token) {
    setChallengerTokenId(null);
    const schedule = challengeScheduleWindow();
    setChallengeBounds({ min: schedule.min, max: schedule.max });
    setChallengeStart(schedule.suggested);
    setCompetitionProduct("ranked");
    setChallengerGrit(0);
    setChallengerSpendableGrit(0);
    setChallengeTarget(target);
  }

  useEffect(()=>{let live=true;if(!challengerTokenId){queueMicrotask(()=>{if(live){setChallengerSpendableGrit(0);setChallengerGrit(0)}});return()=>{live=false};}fetch(`/api/goons/${challengerTokenId}/career`,{cache:"no-store"}).then(r=>r.json()).then(data=>{if(!live)return;const balance=Number(data.economy?.grit_balance??0),reserved=Number(data.economy?.grit_reserved??0);setChallengerSpendableGrit(Math.max(0,balance-reserved));setChallengerGrit(value=>Math.min(value,10,Math.max(0,balance-reserved)));}).catch(()=>{if(live)setChallengerSpendableGrit(0)});return()=>{live=false};},[challengerTokenId]);

  function toggle(tokenId: number) {
    if (availableIds?.has(tokenId) === false) return;
    setSelected((current) => {
      if (current.includes(tokenId)) return current.filter((id) => id !== tokenId);
      if (current.length === 5) return current;
      const token = tokensById.get(tokenId);
      trackMarketingEvent("mint_selected", { token_id: tokenId, discipline: token?.discipline, rarity: token?.rarity, selection_size: current.length + 1 });
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
      trackMarketingEvent("mint_started", { token_count: selected.length, total_eth: displayEth(authoritativePrice), token_ids: selected.join(",") });
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
      trackMarketingEvent("mint_succeeded", { token_count: selected.length, total_eth: displayEth(authoritativePrice), token_ids: selected.join(","), transaction_hash: hash });
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
      if (!eligibleChallengeGoons.some((token) => token.token_id === challengerTokenId)) throw new Error("Choose an eligible Goon you own for this challenge.");
      if (competitionProduct === "pink_slip") throw new Error("Pink Slip custody is a separate contract and is not active.");
      const wagerRequested = competitionProduct === "usdc";
      if (wagerRequested && process.env.NEXT_PUBLIC_WAGERING_ENABLED !== "true") throw new Error("USDC challenge creation is not active on this deployment yet.");
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
        `USDC wager requested: ${wagerRequested ? "yes" : "no"}`,
        wagerRequested ? `Stake minor units: ${stakeMinor}` : "",
        `House fee bps: ${matchHouseFeeBps}`,
        `Challenger GRIT: ${challengerGrit}`,
        `Issued: ${issuedAt}`,
        wagerRequested ? "Equal player stakes are held by the non-custodial Gravity Goons escrow on Base." : "Ranked play only. No wager or token transfer.",
      ].filter(Boolean).join("\n");
      const signature = await signMessage(lines, wallet);
      const response = await fetch("/api/challenges", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengerTokenId, challengedTokenId: challengeTarget.token_id, challengerGritCommitment: challengerGrit, matchMode: "live_ranked", proposedStartAt, wagerRequested, stakeMinor: wagerRequested ? stakeMinor : null, issuedAt, signature }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      trackMarketingEvent("challenge_created", { challenger_token_id: challengerTokenId, challenged_token_id: challengeTarget.token_id, discipline: challengeTarget.discipline, product: competitionProduct, stake_minor: wagerRequested ? stakeMinor : null });
      setStatus(`Challenge sent for #${String(challengeTarget.token_id).padStart(4, "0")}. It expires in 72 hours.`);
      window.dispatchEvent(new Event("gravity-goons:economy"));
      setChallengeTarget(null);
      await refreshRoster();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to send challenge."); }
  }

  function seaportForConnectedWallet() {
    if (!provider) throw new Error("Connect a wallet first.");
    const ethersProvider = new BrowserProvider(provider as never);
    return ethersProvider.getSigner().then((signer) => new Seaport(signer as never, { overrides: {
      seaportVersion: "1.6", contractAddress: SEAPORT_16_ADDRESS, defaultConduitKey: NO_CONDUIT,
    } }));
  }

  async function createListing() {
    if (!listingTarget) return;
    setListingStatus("");
    try {
      if (!seaportEnabled) throw new Error("Seaport listing creation is not active yet.");
      const connected = account ?? await connect();
      if (!connected || !provider) throw new Error("Connect the owner wallet, then try again.");
      await ensureProfileSession({ address: connected, signMessage, signProfileChallenge, onStatus: setListingStatus });
      const currentOwner = await publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "ownerOf", args: [BigInt(listingTarget.token_id)] });
      if (currentOwner.toLowerCase() !== connected.toLowerCase()) throw new Error("The connected wallet no longer owns this Goon.");
      const priceMinor = listingCurrency === "ETH" ? parseEther(listingPrice) : parseUnits(listingPrice, 6);
      if (priceMinor <= 0n) throw new Error("Enter a price greater than zero.");
      const royaltyRecipient = process.env.NEXT_PUBLIC_ROYALTY_RECIPIENT_ADDRESS;
      if (!royaltyRecipient || !isAddress(royaltyRecipient) || royaltyRecipient === ZERO_ADDRESS) throw new Error("The royalty recipient is not configured.");
      const usdc = process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS;
      if (listingCurrency === "USDC" && (!usdc || !isAddress(usdc))) throw new Error("Base USDC is not configured.");
      const now = Math.floor(Date.now() / 1000);
      const seaport = await seaportForConnectedWallet();
      setListingStatus("Preparing exact Seaport 1.6 approval and listing signature…");
      const useCase = await seaport.createOrder({
        conduitKey: NO_CONDUIT, startTime: String(now - 60), endTime: String(now + listingDays * 24 * 60 * 60),
        offer: [{ itemType: ItemType.ERC721, token: collectionAddress, identifier: String(listingTarget.token_id) }],
        consideration: [{ amount: priceMinor.toString(), recipient: connected, ...(listingCurrency === "USDC" ? { token: usdc! } : {}) }],
        fees: [{ recipient: royaltyRecipient, basisPoints: 500 }], allowPartialFills: false, restrictedByZone: false,
      }, connected, true);
      setListingStatus(useCase.actions.some((action) => action.type === "approval") ? "Approve only this Goon, then sign the fixed-price listing." : "Sign the fixed-price listing in your wallet.");
      const order = await useCase.executeAllActions();
      if (!("parameters" in order) || !("signature" in order)) throw new Error("Seaport did not return a signed order.");
      const response = await fetch("/api/listings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        tokenId: listingTarget.token_id, currency: listingCurrency, priceMinor: priceMinor.toString(), order,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      trackMarketingEvent("listing_created", { token_id: listingTarget.token_id, currency: listingCurrency, price_minor: priceMinor.toString(), listing_days: listingDays });
      setListingStatus("Listing is live. The Goon stays in your wallet until a buyer fulfills it.");
      await refreshListings();
    } catch (error) { setListingStatus(error instanceof Error ? error.message.split("\n")[0] : "Unable to create listing."); }
  }

  async function buyListing(listing: Listing) {
    try {
      const connected = account ?? await connect();
      if (!connected || !provider) throw new Error("Connect the buying wallet, then press BUY again.");
      await ensureProfileSession({ address: connected, signMessage, signProfileChallenge, onStatus: setStatus });
      const response = await fetch(`/api/listings/${listing.id}`, { cache: "no-store" });
      const data = await response.json() as { listing?: Listing; error?: string };
      if (!response.ok || !data.listing?.order_payload) throw new Error(data.error ?? "Listing is no longer available.");
      if (data.listing.offerer_wallet === connected.toLowerCase()) throw new Error("Use CANCEL LISTING from the owner wallet.");
      const seaport = await seaportForConnectedWallet();
      setStatus(`Review the ${listing.currency} purchase and 5% creator royalty in your wallet…`);
      const useCase = await seaport.fulfillOrder({ order: data.listing.order_payload as never, accountAddress: connected, exactApproval: true });
      const result = await useCase.executeAllActions();
      if (!("wait" in result) || typeof result.wait !== "function") throw new Error("Seaport did not return a fulfillment transaction.");
      const transaction = result as unknown as { hash: string; wait: () => Promise<{ hash?: string } | null> };
      const receipt = await transaction.wait();
      const sync = await fetch(`/api/listings/${listing.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ txHash: receipt?.hash ?? transaction.hash }) });
      if (!sync.ok) throw new Error((await sync.json()).error ?? "Purchase confirmed, but listing sync failed.");
      setStatus("Purchase confirmed on Base. Ownership and the collection wall are refreshing.");
      await Promise.all([refreshListings(), refreshConnectedOwnership(), refreshRoster()]);
    } catch (error) { setStatus(error instanceof Error ? error.message.split("\n")[0] : "Purchase cancelled."); }
  }

  async function cancelListing(listing: Listing) {
    try {
      const connected = account ?? await connect();
      if (!connected || !provider || listing.offerer_wallet !== connected.toLowerCase()) throw new Error("Connect the wallet that created this listing.");
      await ensureProfileSession({ address: connected, signMessage, signProfileChallenge, onStatus: setStatus });
      const response = await fetch(`/api/listings/${listing.id}`, { cache: "no-store" });
      const data = await response.json() as { listing?: Listing; error?: string };
      if (!response.ok || !data.listing?.order_payload) throw new Error(data.error ?? "Listing not found.");
      const seaport = await seaportForConnectedWallet();
      setStatus("Confirm the Seaport cancellation on Base…");
      const transaction = await seaport.cancelOrders([data.listing.order_payload.parameters as never], connected).transact();
      const receipt = await transaction.wait();
      await fetch(`/api/listings/${listing.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ txHash: receipt?.hash ?? transaction.hash }) });
      setStatus("Listing cancelled on Base.");
      await refreshListings();
    } catch (error) { setStatus(error instanceof Error ? error.message.split("\n")[0] : "Cancellation failed."); }
  }

  return (
    <div>
      <div className="filter-bar">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search token, species, sport…" />
        <select value={discipline} onChange={(event) => { setDiscipline(event.target.value); setPage(1); trackMarketingEvent("roster_filter_used", { filter: "discipline", value: event.target.value }); }}>{disciplines.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={cast} onChange={(event) => { setCast(event.target.value); setPage(1); }}>{["All", "Animal", "Human"].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={bodyBuild} onChange={(event) => { setBodyBuild(event.target.value); setPage(1); }}>{["All", "Lean", "Athletic", "Power", "Compact"].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={rarity} onChange={(event) => { setRarity(event.target.value); setPage(1); trackMarketingEvent("roster_filter_used", { filter: "rarity", value: event.target.value }); }}>{["All", "Common", "Uncommon", "Rare", "Epic", "Legendary"].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={brand} onChange={(event) => { setBrand(event.target.value); setPage(1); }}>{brands.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={playStyle} onChange={(event) => { setPlayStyle(event.target.value); setPage(1); }}>{["All", "Speed", "Air", "Control", "Style", "Toughness"].map((item) => <option key={item}>{item}</option>)}</select>
        <select value={availabilityFilter} onChange={(event) => { setAvailabilityFilter(event.target.value); setPage(1); trackMarketingEvent("roster_filter_used", { filter: "availability", value: event.target.value }); }}>{["Available", "Sold", "All"].map((item) => <option key={item}>{item}</option>)}</select>
        <span className={`result-count ${saleOpen === true ? "live" : ""}`}>
          {saleOpen === true
            ? `● MINT LIVE · ${availableIds?.size ?? "—"} LEFT`
            : saleOpen === false
              ? `MINT CLOSED · ${availableIds?.size ?? "—"} LEFT`
              : "CHECKING BASE…"}
        </span>
      </div>

      {account && myGoons.length > 0 && <div className="my-goons-strip"><b>MY GOONS · {myGoons.length} OWNED</b><span>{myGoons.map((token) => `#${String(token.token_id).padStart(4, "0")}`).join(" · ")}</span></div>}
      <div className="token-grid">
        {visible.map((token) => {
          const active = selected.includes(token.token_id);
          const available = availableIds?.has(token.token_id) !== false;
          const live = liveById.get(token.token_id);
          const listing = listingsById.get(token.token_id);
          const mine = normalizedAccount !== null && (directOwnedIds.has(token.token_id) || live?.owner === normalizedAccount);
          const eligible = !available && !mine && Boolean(live?.owner) && !live?.matchId && !live?.challengeId
            && (challengeEligibleByDiscipline.get(token.discipline)?.length ?? 0) > 0;
          const cardStatus = mine
            ? "Owned by you"
            : available
              ? "Available to mint"
              : `Owned by ${live?.ownerName ?? "Goon Holder"}`;
          return (
            <article className={`token-card ${active ? "selected" : ""} ${mine ? "mine" : ""}`} key={token.token_id} role="link" tabIndex={0}
              onClick={(event) => { if ((event.target as HTMLElement).closest("button,a,input,select")) return; trackMarketingEvent("goon_viewed", { token_id: token.token_id, discipline: token.discipline, rarity: token.rarity, availability: available ? "available" : "owned" }); router.push(`/${token.token_id}`); }}
              onKeyDown={(event) => { if ((event.target as HTMLElement).closest("button,a,input,select")) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/${token.token_id}`); } }}>
              <div className="card-image">
                <Image src={imageBaseUrl + "/" + String(token.token_id).padStart(4, "0") + ".png"} alt={token.name} width={1024} height={1024} />
                <span className={`rarity rarity-${token.rarity.toLowerCase()}`}>{token.rarity}</span>
                <span className="select-mark">{available ? active ? "SELECTED" : "AVAILABLE" : mine ? "YOURS" : "OWNED"}</span>
                {available && <button className={`card-add-action ${active ? "active" : ""}`} aria-label={`${active ? "Remove" : "Add"} ${token.name} ${active ? "from" : "to"} your mint lineup`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(token.token_id); }}>{active ? "REMOVE GOON" : "ADD GOON"}</button>}
              </div>
              <div className="card-copy">
                <div><b>#{String(token.token_id).padStart(4, "0")}</b><span>{token.discipline}</span></div>
                <h3>{token.species} · {token.body_build}</h3>
                <p className="card-brand">{token.parody_brand} · {token.sport_equipment}</p>
                <p className="card-price">{listing ? `FOR SALE · ${listing.currency === "ETH" ? formatUnits(BigInt(listing.price_minor), 18) : formatUnits(BigInt(listing.price_minor), 6)} ${listing.currency}` : available ? `MINT · ${displayEth(RARITY_PRICE_WEI[token.rarity] ?? 0n)} ETH` : "HELD · NOT LISTED"}</p>
                <p className={`athlete-status status-${cardStatus.toLowerCase().replaceAll(" ", "-")}`}>{cardStatus}</p>
                {!available && !mine && live?.matchId && <p className="athlete-state">IN MATCH</p>}
                {!available && !mine && !live?.matchId && live?.challengeId && <p className="athlete-state">CHALLENGE PENDING</p>}
                <p className="athlete-record">{athleteRankLabel(live?.discipline_rank, live?.matches_played ?? 0)} · {live?.wins ?? 0}W–{live?.losses ?? 0}L · ELO {Math.round(live?.rating ?? 1500)}</p>
                <p className="signature-edge">{token.trick_specialty} · SIGNATURE EDGE +{signatureEdgeForRarity(token.rarity)}%</p>
                <div className="mini-stats"><span>SPD {token.stats.Speed}</span><span>AIR {token.stats.Air}</span><span>CTL {token.stats.Control}</span><span>STY {token.stats.Style}</span><span>TGH {token.stats.Toughness}</span></div>
                {mine && <button className="transfer-button" onClick={() => { setTransferTarget(token); setTransferRecipient(""); setTransferStatus(""); }}>TRANSFER GOON</button>}
                {mine && !listing && <button className="challenge-button list-for-sale-button" onClick={() => { setListingTarget(token); setListingPrice(""); setListingCurrency("ETH"); setListingDays(7); setListingStatus(""); }}>LIST FOR SALE</button>}
                {mine && listing && <button className="challenge-button" onClick={() => cancelListing(listing)}>CANCEL LISTING</button>}
                {!mine && listing && <button className="challenge-button" onClick={() => buyListing(listing)}>BUY NOW · {listing.currency}</button>}
                {eligible && <button className="challenge-button" onClick={() => openChallenge(token)}>CHALLENGE</button>}
              </div>
            </article>
          );
        })}
      </div>

      {visible.length < ordered.length && <button className="button load" onClick={() => setPage((value) => value + 1)}>Load more athletes</button>}
      {challengeTarget && <div className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-title">
        <div className="challenge-builder">
          <button className="challenge-close" onClick={() => { setChallengeTarget(null); setChallengerTokenId(null); }} aria-label="Close challenge">×</button>
          <p className="eyebrow">SIGNED LIVE 1V1</p>
          <h2 id="challenge-title">Challenge #{String(challengeTarget.token_id).padStart(4, "0")}</h2>
          <p>Choose which of your eligible {challengeTarget.discipline} Goons will issue this challenge. Nothing is sent until you confirm the exact matchup.</p>
          <div className="challenge-target-card">
            <Image src={`${imageBaseUrl}/${String(challengeTarget.token_id).padStart(4, "0")}.png`} alt={challengeTarget.name} width={1024} height={1024} />
            <div><span>YOU ARE CHALLENGING</span><b>#{String(challengeTarget.token_id).padStart(4, "0")} · {challengeTarget.species}</b><small>{challengeTarget.rarity} · {athleteRankLabel(liveById.get(challengeTarget.token_id)?.discipline_rank, liveById.get(challengeTarget.token_id)?.matches_played ?? 0)} · {liveById.get(challengeTarget.token_id)?.wins ?? 0}W–{liveById.get(challengeTarget.token_id)?.losses ?? 0}L</small></div>
          </div>
          <fieldset className="challenge-goon-picker">
            <legend>SELECT YOUR {challengeTarget.discipline.toUpperCase()} GOON</legend>
            <div>
              {eligibleChallengeGoons.map((token) => {
                const live = liveById.get(token.token_id);
                const chosen = challengerTokenId === token.token_id;
                return <button type="button" className={chosen ? "selected" : ""} aria-pressed={chosen} onClick={() => setChallengerTokenId(token.token_id)} key={token.token_id}>
                  <Image src={`${imageBaseUrl}/${String(token.token_id).padStart(4, "0")}.png`} alt={token.name} width={1024} height={1024} />
                  <span>#{String(token.token_id).padStart(4, "0")}</span>
                  <b>{token.species} · {token.rarity}</b>
                  <small>{athleteRankLabel(live?.discipline_rank, live?.matches_played ?? 0)} · {live?.wins ?? 0}W–{live?.losses ?? 0}L · ELO {Math.round(live?.rating ?? 1500)}</small>
                  <i>{chosen ? "SELECTED" : "CHOOSE THIS GOON"}</i>
                </button>;
              })}
            </div>
          </fieldset>
          {!challengerTokenId && <p className="challenge-pick-required">SELECT ONE OF YOUR GOONS TO CONTINUE</p>}
          {challengerTokenId && <label className="challenge-grit-commitment">MATCH GRIT · 0–10
            <input type="range" min="0" max={Math.min(10,challengerSpendableGrit)} value={challengerGrit} onChange={(event)=>setChallengerGrit(Number(event.target.value))}/>
            <b>{challengerGrit} GRIT COMMITTED</b><span>{challengerSpendableGrit} spendable · unspent commitment returns after the match</span>
          </label>}
          <p className="challenge-live-lock">LIVE RANKED · BOTH PLAYERS CHECK IN · PUBLIC SCOREBOARD</p>
          <div className="competition-products" aria-label="Competition type">
            <button className={competitionProduct === "ranked" ? "active" : ""} onClick={() => setCompetitionProduct("ranked")}><span>RANKED</span><b>NO WAGER</b><small>AVAILABLE NOW</small></button>
            <button className={competitionProduct === "usdc" ? "active" : ""} onClick={() => setCompetitionProduct("usdc")}><span>USDC STAKE RANKED</span><b>1 · 5 · 10 · 25 USDC</b><small>{process.env.NEXT_PUBLIC_WAGERING_ENABLED === "true" ? "EQUAL STAKES · BASE USDC" : "ESCROW SETUP IN PROGRESS"}</small></button>
            <button className={competitionProduct === "pink_slip" ? "active pink-slip locked" : "pink-slip locked"} onClick={() => setCompetitionProduct("pink_slip")}><span>PINK SLIP</span><b>WINNER TAKES BOTH GOONS</b><small>LOCKED · SEPARATE NFT ESCROW REQUIRED</small></button>
          </div>
          {competitionProduct === "usdc" && <label>PLAYER STAKE · EACH PLAYER<select value={stakeMinor} onChange={(event) => setStakeMinor(Number(event.target.value))}><option value={1_000_000}>1 USDC</option><option value={5_000_000}>5 USDC</option><option value={10_000_000}>10 USDC</option><option value={25_000_000}>25 USDC</option></select></label>}
          {competitionProduct === "pink_slip" && <p className="pink-slip-warning"><b>PINK SLIP — WINNER TAKES BOTH GOONS</b><span>This will require two explicit custody confirmations from each player, Safe-controlled disputes, and a separately audited NFT escrow. It cannot be enabled by opening the mint.</span></p>}
          <label>START TIME · YOUR LOCAL TIME<input type="datetime-local" value={challengeStart} min={challengeBounds.min} max={challengeBounds.max} onInput={(event) => setChallengeStart(event.currentTarget.value)} onChange={(event) => setChallengeStart(event.currentTarget.value)} /></label>
          {competitionProduct === "usdc" && <p className="challenge-money-lock">HOUSE FEE: {(matchHouseFeeBps / 100).toFixed(2).replace(/\.00$/, "")}% OF COMPLETED POOL · NO FEE ON VOID OR REFUND</p>}
          <p className="challenge-money-lock">PLAYER USDC: {process.env.NEXT_PUBLIC_WAGERING_ENABLED === "true" ? "LIVE" : "SETUP"} · PINK SLIP: LOCKED · FREE SPECTATOR PICKS: LIVE</p>
          <div className="challenge-comparison">
            <span>{athleteRankLabel(liveById.get(challengerTokenId ?? 0)?.discipline_rank, liveById.get(challengerTokenId ?? 0)?.matches_played ?? 0)}</span>
            <b>{challengeTarget.discipline.toUpperCase()}</b>
            <span>{athleteRankLabel(liveById.get(challengeTarget.token_id)?.discipline_rank, liveById.get(challengeTarget.token_id)?.matches_played ?? 0)}</span>
          </div>
          <button className="button primary challenge-send" disabled={!challengerTokenId || competitionProduct === "pink_slip" || (competitionProduct === "usdc" && process.env.NEXT_PUBLIC_WAGERING_ENABLED !== "true")} onClick={submitChallenge}>{!challengerTokenId ? "SELECT YOUR GOON ABOVE" : competitionProduct === "ranked" ? `SIGN + SEND #${String(challengerTokenId).padStart(4, "0")} VS #${String(challengeTarget.token_id).padStart(4, "0")}` : competitionProduct === "usdc" ? `SIGN + SEND USDC · #${String(challengerTokenId).padStart(4, "0")} VS #${String(challengeTarget.token_id).padStart(4, "0")}` : "PINK SLIP LOCKED"}</button>
        </div>
      </div>}
      {listingTarget && <div className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="listing-title">
        <div>
          <button className="challenge-close" onClick={() => setListingTarget(null)} aria-label="Close listing">×</button>
          <p className="eyebrow">SEAPORT 1.6 · BASE · NON-CUSTODIAL</p>
          <h2 id="listing-title">List #{String(listingTarget.token_id).padStart(4, "0")}</h2>
          <p>Your Goon stays in your wallet until a buyer fulfills the signed order. Gravity Goons charges no marketplace fee; the immutable 5% creator royalty is included.</p>
          <label>FIXED PRICE
            <input inputMode="decimal" value={listingPrice} onChange={(event) => setListingPrice(event.target.value.replace(/[^0-9.]/g, ""))} placeholder={listingCurrency === "ETH" ? "0.05" : "100"} />
          </label>
          <label>CURRENCY
            <select value={listingCurrency} onChange={(event) => setListingCurrency(event.target.value as "ETH" | "USDC")}><option value="ETH">ETH</option><option value="USDC">USDC</option></select>
          </label>
          <label>DURATION
            <select value={listingDays} onChange={(event) => setListingDays(Number(event.target.value))}><option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option><option value={30}>30 days</option></select>
          </label>
          {listingStatus && <p className="transfer-status" aria-live="polite">{listingStatus}</p>}
          <button className="button primary" onClick={createListing} disabled={!listingPrice || !seaportEnabled}>{seaportEnabled ? "APPROVE + SIGN LISTING" : "SEAPORT SETUP IN PROGRESS"}</button>
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
