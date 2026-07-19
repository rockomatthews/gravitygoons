import Image from "next/image";

const athletes = [
  { id: "0030", species: "Gorilla", discipline: "Surfing", brand: "MIKE", rarity: "Common", trick: "Floater" },
  { id: "0031", species: "Human", discipline: "Snowboarding", brand: "AVOIDAS", rarity: "Uncommon", trick: "Cork 720" },
  { id: "0032", species: "Gorilla", discipline: "BMX", brand: "POOMA", rarity: "Common", trick: "Flair" },
  { id: "0033", species: "Ram", discipline: "BMX", brand: "CARHEART", rarity: "Uncommon", trick: "Flair" },
  { id: "0034", species: "Boar", discipline: "Skateboarding", brand: "MIKE", rarity: "Uncommon", trick: "360 Flip" },
  { id: "0035", species: "Raccoon", discipline: "Skateboarding", brand: "PROCRASTIGONIA", rarity: "Common", trick: "360 Flip" },
  { id: "0036", species: "Shark", discipline: "BMX", brand: "OFF-BEIGE", rarity: "Rare", trick: "Barspin" },
  { id: "0038", species: "Boar", discipline: "Snowboarding", brand: "PROCRASTIGONIA", rarity: "Common", trick: "Frontside 360" },
  { id: "0039", species: "Shark", discipline: "BMX", brand: "BURNTON", rarity: "Common", trick: "Backflip" },
  { id: "0040", species: "Boar", discipline: "BMX", brand: "MIKE", rarity: "Uncommon", trick: "Tailwhip" },
  { id: "0041", species: "Human", discipline: "Skiing", brand: "VANISH", rarity: "Common", trick: "Double Cork 1080" },
  { id: "0042", species: "Snow Leopard", discipline: "Skiing", brand: "BURNTON", rarity: "Common", trick: "Switch 900" },
];

export function ApprovalRoster() {
  return (
    <div>
      <aside className="production-notice">
        <div><span>LIVE PRODUCTION PREVIEW</span><b>REAL FINAL RENDERS</b></div>
        <p>Every athlete below is an accepted, metadata-matched collection render. Production continues toward all 1,000, and minting stays disabled until the complete collection passes validation.</p>
      </aside>
      <div className="approval-grid">
        {athletes.map((athlete) => (
          <article className="approval-card" key={athlete.id}>
            <Image
              src={`/collection/production-preview/${athlete.id}.png`}
              alt={`Gravity Goons #${athlete.id}, ${athlete.brand} ${athlete.species} ${athlete.discipline} athlete`}
              width={1254}
              height={1254}
            />
            <div>
              <span>#{athlete.id} · {athlete.discipline} · {athlete.rarity}</span>
              <h3>{athlete.species}</h3>
              <b>{athlete.brand} · {athlete.trick}</b>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
