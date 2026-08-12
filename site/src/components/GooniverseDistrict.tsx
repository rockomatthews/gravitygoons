import Link from "next/link";
import { getGooniverseOverview } from "@/lib/gooniverse-server";

const LOCATIONS = [
  { key: "bar", name: "ZERO-G BAR", href: "/", status: "CHAT + ACTIVITY", copy: "The social heart of the district." },
  { key: "arena", name: "ARENA", href: "/arena", status: "RANKED + USDC", copy: "Call tricks and settle live rivalries." },
  { key: "gooncade", name: "GOONCADE", href: "/gooncade", status: "PLAYABLE", copy: "Learn the league and preview every system." },
  { key: "scrapyard", name: "SCRAPYARD", href: "#coming-online", status: "FOUNDATION READY", copy: "Send one Goon to salvage materials." },
  { key: "workshop", name: "WORKSHOP", href: "#coming-online", status: "30 RECIPES LOADED", copy: "Craft, equip, preview, and repair." },
  { key: "training", name: "TRAINING FACILITY", href: "#trick-line", status: "TRICK LINE LIVE", copy: "Push the multiplier. Bank before the fall." },
  { key: "sponsor", name: "SPONSOR ROW", href: "/profile", status: "CAREER SYSTEM", copy: "Assignments, sponsors, and daily objectives." },
  { key: "trophy", name: "TROPHY HALL", href: "#coming-online", status: "PERMANENT RECORDS", copy: "Every season and career milestone persists." },
];

export async function GooniverseDistrict() {
  const overview = await getGooniverseOverview().catch(() => ({ season: null, generators: [], recipes: 30, databaseReady: false }));
  return <>
    <section className="gooniverse-map" aria-label="Gooniverse district map">
      <div className="district-grid"/><div className="district-core"><span>SEASON 01</span><b>ZERO-G<br/>BLACKOUT</b><small>{overview.databaseReady ? "DISTRICT NETWORK ONLINE" : "DISTRICT NETWORK STAGING"}</small></div>
      {LOCATIONS.map((location, index) => <Link key={location.key} href={location.href} className={`district-location district-${location.key}`} style={{ "--district-index": index } as React.CSSProperties}>
        <span>{`${String(index + 1).padStart(2,"0")} // ${location.status}`}</span><b>{location.name}</b><small>{location.copy}</small>
      </Link>)}
    </section>
    <section className="blackout-progress shell">
      <header><div><p className="eyebrow">COMMUNITY GRID // SIX GENERATORS</p><h2>BRING THE<br/>LIGHTS BACK.</h2></div><p>Salvage Components and Pigment, craft ZERO-G batteries, and restore each discipline generator. Season rewards remain with the Goon forever.</p></header>
      <div>{(["Skateboarding","Snowboarding","Surfing","BMX","Motocross","Skiing"] as const).map((discipline) => {
        const generator = overview.generators.find((item: Record<string, unknown>) => item.discipline === discipline) as Record<string, number>|undefined;
        const contributed = Number(generator?.contributed_amount ?? 0); const target = Number(generator?.target_amount ?? 5000);
        return <article key={discipline}><span>{discipline}</span><b>{contributed.toLocaleString()} / {target.toLocaleString()}</b><i><em style={{ width: `${Math.min(100, contributed / target * 100)}%` }}/></i></article>;
      })}</div>
    </section>
  </>;
}
