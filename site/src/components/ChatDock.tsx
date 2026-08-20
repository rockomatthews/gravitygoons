"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureProfileSession } from "@/lib/profile-auth-client";
import { useWallet } from "@/components/WalletProvider";
import { trackMarketingEvent } from "@/lib/analytics";
import { startVisiblePolling } from "@/lib/visible-polling";

type Goon = { tokenId: number; discipline: string; species: string; rarity: string };
type Person = { id: string; username: string; displayName: string; isNftHolder: boolean; goons: Goon[] };
type RoomMessage = { id: string; kind: "text" | "match_request" | "system"; body: string; metadata: Record<string, unknown>; createdAt: string; sender: Person; target: Person | null; isMine: boolean };
type Room = { self: Person | null; people: Person[]; messages: RoomMessage[] };

function badge(person: Person) { return person.isNftHolder ? <span className="chat-player-badge">NFT PLAYER · {person.goons.length} GOON{person.goons.length === 1 ? "" : "S"}</span> : <span className="chat-community-badge">COMMUNITY</span>; }

export function ChatDock() {
  const { account, connect, signMessage, signProfileChallenge } = useWallet();
  const [open, setOpen] = useState(false); const [room, setRoom] = useState<Room | null>(null); const [draft, setDraft] = useState(""); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [authState, setAuthState] = useState<"visitor" | "ready" | "profile">("visitor"); const [showCallout, setShowCallout] = useState(false); const [targetUsername, setTargetUsername] = useState(""); const [myToken, setMyToken] = useState<number | null>(null); const [theirToken, setTheirToken] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null); const seenRef = useRef(0);

  const loadRoom = useCallback(async () => { const response = await fetch("/api/chat/room", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Chat room unavailable."); setRoom(data); setAuthState(data.self ? "ready" : "visitor"); return data as Room; }, []);
  useEffect(() => { if (!open) return; const timer = window.setTimeout(() => void loadRoom().catch((error) => setStatus(error.message)), 0); return () => window.clearTimeout(timer); }, [loadRoom, open]);
  useEffect(() => { if (!open) return; return startVisiblePolling(loadRoom, 15_000); }, [loadRoom, open]);
  useEffect(() => { if (!open) return; const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; if (!url || !key) return; const client = createClient(url, key, { auth: { persistSession: false } }); client.channel("chat:room").on("broadcast", { event: "chat_room_message" }, () => void loadRoom()).subscribe(); return () => { void client.removeAllChannels(); }; }, [loadRoom, open]);
  useEffect(() => { if (!room || !open) return; const timer = window.setTimeout(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: seenRef.current ? "smooth" : "auto" }); seenRef.current = room.messages.length; }, 0); return () => window.clearTimeout(timer); }, [open, room]);

  async function signIn() { setBusy(true); setStatus(""); try { const wallet = account ?? await connect(); if (!wallet) throw new Error("Choose a wallet first."); await ensureProfileSession({ address: wallet, signMessage, signProfileChallenge, onStatus: setStatus }); const data = await loadRoom(); if (!data.self) setAuthState("profile"); } catch (error) { setStatus(error instanceof Error ? error.message : "Sign-in failed."); } finally { setBusy(false); } }
  async function post(payload: Record<string, unknown>) { setBusy(true); setStatus(""); try { const response = await fetch("/api/chat/room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); if (response.status === 401) { setAuthState("visitor"); throw new Error(data.error); } if (response.status === 403) { setAuthState("profile"); throw new Error(data.error); } if (!response.ok) throw new Error(data.error); setDraft(""); setShowCallout(false); await loadRoom(); } catch (error) { setStatus(error instanceof Error ? error.message : "Post failed."); } finally { setBusy(false); } }
  async function report(messageId: string) { if (!window.confirm("Report this room message for review?")) return; const response = await fetch("/api/chat/room/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId }) }); const data = await response.json(); setStatus(response.ok ? "Message reported. Thank you." : data.error ?? "Report failed."); }

  const holders = useMemo(() => room?.people.filter((person) => person.isNftHolder) ?? [], [room]);
  const target = holders.find((person) => person.username === targetUsername);
  const matchingMine = room?.self?.goons.filter((mine) => target?.goons.some((theirs) => theirs.discipline === mine.discipline)) ?? [];
  const discipline = room?.self?.goons.find((goon) => goon.tokenId === myToken)?.discipline;
  const matchingTheirs = target?.goons.filter((goon) => goon.discipline === discipline) ?? [];
  function chooseTarget(username: string) { setTargetUsername(username); const person = holders.find((item) => item.username === username); const mine = room?.self?.goons.find((goon) => person?.goons.some((theirs) => theirs.discipline === goon.discipline)); const theirs = person?.goons.find((goon) => goon.discipline === mine?.discipline); setMyToken(mine?.tokenId ?? null); setTheirToken(theirs?.tokenId ?? null); }

  return <aside className={`chat-dock ${open ? "open" : "closed"}`} aria-label="Goon Chat Room">
    {!open ? <button className="chat-launcher" onClick={() => { setOpen(true); trackMarketingEvent("chat_joined", { access: account ? "wallet_connected" : "visitor" }); }}><span>◉</span><b>GOON CHAT</b><i>LIVE</i></button> : <div className="chat-panel chat-room-panel">
      <header className="chat-header"><div><span>PUBLIC ROOM · EVERYONE CAN READ</span><b>GOON CHAT</b></div><button onClick={() => setOpen(false)} aria-label="Hide chat">⌄</button></header>
      <div className="chat-room-strip"><span className="chat-live-dot">● LIVE</span><b>{room?.people.filter((person) => person.isNftHolder).length ?? 0} NFT PLAYERS</b><small>Wallet addresses hidden</small></div>
      <div className="chat-messages chat-room-messages" ref={scrollRef}>{!room?.messages.length && <p className="chat-empty">The room is open. Talk tricks, find a rival, or call out another NFT holder.</p>}{room?.messages.map((message) => <article className={`${message.isMine ? "mine" : "theirs"} ${message.kind === "match_request" ? "match" : ""}`} key={message.id}><div className="chat-message-name"><b>{message.sender.displayName}</b>{badge(message.sender)}<time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div><p>{message.body}</p>{message.kind === "match_request" && <button onClick={() => { const challengeToken = message.isMine ? message.metadata.challenged_token_id : message.metadata.challenger_token_id; window.location.href = `/?challengeToken=${challengeToken}#collection`; }}>BUILD SIGNED CHALLENGE →</button>}{!message.isMine && authState === "ready" && <button className="chat-report" onClick={() => report(message.id)}>REPORT</button>}</article>)}</div>
      {authState === "visitor" && <div className="chat-room-gate"><span>READING AS A VISITOR</span><button onClick={signIn} disabled={busy}>{busy ? "WAITING…" : "SIGN IN TO POST"}</button></div>}
      {authState === "profile" && <div className="chat-room-gate"><span>PROFILE REQUIRED TO POST</span><Link href="/profile">CREATE PROFILE →</Link></div>}
      {authState === "ready" && room?.self && (showCallout ? <div className="chat-match-builder"><b>PUBLIC MATCH CALLOUT</b><label>CALL OUT<select value={targetUsername} onChange={(event) => chooseTarget(event.target.value)}><option value="">Choose an NFT player…</option>{holders.map((person) => <option value={person.username} key={person.id}>@{person.username} · {person.goons.length} Goons</option>)}</select></label><label>YOUR GOON<select value={myToken ?? ""} onChange={(event) => { const id = Number(event.target.value); setMyToken(id); const nextDiscipline = room.self?.goons.find((goon) => goon.tokenId === id)?.discipline; setTheirToken(target?.goons.find((goon) => goon.discipline === nextDiscipline)?.tokenId ?? null); }}>{matchingMine.map((goon) => <option value={goon.tokenId} key={goon.tokenId}>#{String(goon.tokenId).padStart(4, "0")} · {goon.discipline}</option>)}</select></label><label>THEIR GOON<select value={theirToken ?? ""} onChange={(event) => setTheirToken(Number(event.target.value))}>{matchingTheirs.map((goon) => <option value={goon.tokenId} key={goon.tokenId}>#{String(goon.tokenId).padStart(4, "0")} · {goon.species}</option>)}</select></label><div><button onClick={() => setShowCallout(false)}>CANCEL</button><button disabled={!targetUsername || !myToken || !theirToken || busy} onClick={() => post({ kind: "match_request", targetUsername, challengerTokenId: myToken, challengedTokenId: theirToken })}>POST CALLOUT</button></div></div> : <div className="chat-compose"><textarea value={draft} maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="Say something to the room…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (draft.trim()) void post({ kind: "text", body: draft }); } }} /><div>{room.self.isNftHolder && <button className="chat-match-button" onClick={() => setShowCallout(true)}>⚡ CALL OUT PLAYER</button>}<button disabled={!draft.trim() || busy} onClick={() => post({ kind: "text", body: draft })}>POST</button></div></div>)}
      {status && <p className="chat-status" role="status">{status}</p>}
    </div>}
  </aside>;
}
