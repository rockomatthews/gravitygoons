"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";

type Summary = { tokenId:number; goon:{name:string;imageUrl:string;discipline?:string;rarity?:string}; economy:{grit_balance:number;grit_reserved:number}; record?:{wins:number;losses:number;rating:number;discipline_rank:number|null;matches_played:number}; sponsorCount?:number;trophyCount?:number;unlockedCount?:number;lockedCount?:number };

export function OwnedGoonsDashboard() {
  const { account } = useWallet();
  const [goons, setGoons] = useState<Summary[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [career, setCareer] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!account) return;
    const load = () => fetch(`/api/goons/career-summary?wallet=${encodeURIComponent(account)}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : []).then((data) => setGoons(Array.isArray(data) ? data : data.careers ?? [])).catch(() => setGoons([]));
    void load();
    window.addEventListener("gravity-goons:profile-authenticated", load);
    window.addEventListener("gravity-goons:economy", load);
    window.addEventListener("focus", load);
    return () => { window.removeEventListener("gravity-goons:profile-authenticated", load); window.removeEventListener("gravity-goons:economy", load); window.removeEventListener("focus", load); };
  }, [account]);

  async function open(tokenId:number) {
    setExpanded(tokenId); setCareer(null);
    const response = await fetch(`/api/goons/${tokenId}/career`, { cache:"no-store" });
    if (response.ok) setCareer(await response.json());
  }

  return <section className="owned-goons-dashboard">
    <header><div><p className="eyebrow">YOUR WALLET ROSTER</p><h2>Every Goon you own.</h2></div><p>Full-color NFT athletes tied to this wallet. Open one for a quick career view or jump to its permanent public profile.</p></header>
    {!account ? <p className="owned-goons-empty">CONNECT + SIGN ABOVE TO LOAD YOUR ROSTER</p> : !goons.length ? <p className="owned-goons-empty">NO OWNED GOONS FOUND YET. VERIFY, THEN PRESS REFRESH MY GOONS.</p> : <div className="owned-goons-grid">{goons.map((goon) => <button onClick={() => open(goon.tokenId)} key={goon.tokenId}><Image src={goon.goon.imageUrl} alt={goon.goon.name} width={256} height={256} /><span>#{String(goon.tokenId).padStart(4,"0")}</span><b>{goon.goon.name}</b><small>{goon.record?.wins ?? 0}W–{goon.record?.losses ?? 0}L · {goon.economy.grit_balance - goon.economy.grit_reserved} GRIT</small></button>)}</div>}
    {expanded && <div className="owned-goon-modal" role="dialog" aria-modal="true"><article><button className="challenge-close" onClick={() => setExpanded(null)} aria-label="Close">×</button>{career ? <><Image src={goons.find((g)=>g.tokenId===expanded)?.goon.imageUrl ?? ""} alt="" width={512} height={512}/><p className="eyebrow">GOON #{String(expanded).padStart(4,"0")}</p><h2>{goons.find((g)=>g.tokenId===expanded)?.goon.name}</h2><div className="owned-goon-facts"><span>{(career.unlockedTricks as unknown[] | undefined)?.length ?? 0} UNLOCKED</span><span>{(career.lockedTricks as unknown[] | undefined)?.length ?? 0} LOCKED</span><span>{(career.trophies as unknown[] | undefined)?.length ?? 0} TROPHIES</span><span>{(career.inventory as unknown[] | undefined)?.length ?? 0} ITEMS</span></div><Link className="button primary" href={`/${expanded}`}>OPEN FULL NFT PROFILE</Link></> : <p>LOADING CAREER…</p>}</article></div>}
  </section>;
}
