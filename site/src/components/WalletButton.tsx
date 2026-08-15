"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";

type Career={tokenId:number;goon:{name:string;imageUrl:string};economy:{grit_balance:number;grit_reserved:number};activeMatchCommitment:number|null;activeTrickLineTarget:number|null};

export function WalletButton() {
  const { account, connecting, openModal, disconnect } = useWallet();
  const [careers,setCareers]=useState<Career[]>([]),[active,setActive]=useState<number|null>(null),[open,setOpen]=useState(false);
  const refresh=useCallback(async()=>{await Promise.resolve();if(!account){setCareers([]);setActive(null);return;}try{const {careers:rows=[]}=await fetch(`/api/goons/career-summary?wallet=${account}`,{cache:"no-store"}).then(r=>r.json()) as {careers:Career[]};setCareers(rows);const key=`gravity-goons:active-goon:${account.toLowerCase()}`;const saved=Number(localStorage.getItem(key));const next=rows.some(row=>row.tokenId===saved)?saved:rows[0]?.tokenId??null;setActive(next);if(next)localStorage.setItem(key,String(next));}catch{/* retain last verified selector */}},[account]);
  useEffect(()=>{const initial=window.setTimeout(refresh,0);const focus=()=>void refresh();window.addEventListener("focus",focus);window.addEventListener("gravity-goons:economy",focus);return()=>{window.clearTimeout(initial);window.removeEventListener("focus",focus);window.removeEventListener("gravity-goons:economy",focus);};},[refresh]);
  const chosen=careers.find(row=>row.tokenId===active),spendable=chosen?chosen.economy.grit_balance-chosen.economy.grit_reserved:0;
  const label = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : connecting ? "CONNECTING…" : "CONNECT BASE WALLET";
  function choose(tokenId:number){setActive(tokenId);if(account)localStorage.setItem(`gravity-goons:active-goon:${account.toLowerCase()}`,String(tokenId));setOpen(false);}
  return <div className="wallet-controls"><div className="grit-control"><button onClick={()=>setOpen(value=>!value)} disabled={!account} aria-expanded={open}>{!account?"GRIT —":chosen?`#${String(chosen.tokenId).padStart(4,"0")} · ${spendable} GRIT`:"NO GOON"}</button>{open&&<div className="grit-menu">{careers.map(row=><button key={row.tokenId} onClick={()=>choose(row.tokenId)} className={row.tokenId===active?"active":""}><Image src={row.goon.imageUrl} alt={row.goon.name} width={64} height={64}/><span><b>#{String(row.tokenId).padStart(4,"0")} · {row.economy.grit_balance-row.economy.grit_reserved} GRIT</b><small>{row.economy.grit_reserved} reserved{row.activeMatchCommitment!=null?` · ${row.activeMatchCommitment} in match`:""}{row.activeTrickLineTarget!=null?` · mastering trick ${row.activeTrickLineTarget}`:""}</small></span></button>)}{!careers.length&&<p>No owned Goons in this wallet.</p>}</div>}</div><button className="wallet-button" onClick={account ? disconnect : openModal} disabled={connecting} title={account ? "Disconnect wallet" : "Connect wallet"}><span className="wallet-label-full">{label}</span><span className="wallet-label-short">{account ? `${account.slice(0, 4)}…${account.slice(-3)}` : connecting ? "WAIT…" : "CONNECT"}</span></button></div>;
}
