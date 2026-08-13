import Image from "next/image";
import Link from "next/link";
import { getGooniverseOverview } from "@/lib/gooniverse-server";

const HOTSPOTS=[
  {key:"bar",label:"ZERO-G Bar",href:"/",x:17,y:48,w:16,h:18},
  {key:"sponsor",label:"Sponsor Row",href:"/profile",x:27,y:49,w:15,h:15},
  {key:"gooncade",label:"Gooncade",href:"/gooncade",x:31,y:68,w:13,h:17},
  {key:"workshop",label:"Workshop",href:"#workshop",x:42,y:27,w:15,h:21},
  {key:"arena",label:"Arena",href:"/arena",x:57,y:25,w:20,h:26},
  {key:"trophy",label:"Trophy Hall",href:"/arena?status=results",x:78,y:42,w:17,h:24},
  {key:"training",label:"Training Facility",href:"#trick-line",x:48,y:61,w:22,h:29},
  {key:"scrapyard",label:"Scrapyard",href:"#scrapyard",x:75,y:65,w:21,h:24},
] as const;

export async function GooniverseDistrict(){
  const overview=await getGooniverseOverview().catch(()=>({season:null,generators:[],recipes:30,databaseReady:false}));
  return <><section className="gooniverse-image-map" aria-label="Interactive Gooniverse district map"><Image src="/gooniverse/zero-g-blackout-island.png" alt="The Gravity Goons ZERO-G Blackout island district" width={1609} height={977} priority sizes="100vw"/>{HOTSPOTS.map(h=><Link key={h.key} href={h.href} className="gooniverse-hotspot" style={{left:`${h.x}%`,top:`${h.y}%`,width:`${h.w}%`,height:`${h.h}%`}} aria-label={`Open ${h.label}`}><span>{h.label}</span></Link>)}</section><section className="blackout-progress shell"><header><div><p className="eyebrow">COMMUNITY GRID // SIX GENERATORS</p><h2>BRING THE<br/>LIGHTS BACK.</h2></div><p>Salvage Components and Pigment, craft ZERO-G batteries, and restore each discipline generator.</p></header><div>{(["Skateboarding","Snowboarding","Surfing","BMX","Motocross","Skiing"] as const).map(discipline=>{const generator=overview.generators.find((item:Record<string,unknown>)=>item.discipline===discipline) as Record<string,number>|undefined;const contributed=Number(generator?.contributed_amount??0),target=Number(generator?.target_amount??5000);return <article key={discipline}><span>{discipline}</span><b>{contributed.toLocaleString()} / {target.toLocaleString()}</b><i><em style={{width:`${Math.min(100,contributed/target*100)}%`}}/></i></article>})}</div></section></>;
}
