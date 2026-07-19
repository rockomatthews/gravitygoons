import Image from "next/image";

const athletes = [
  { id: "0001", species: "Hyena", discipline: "Surfing", brand: "NORTH FAKE", rarity: "Common", trick: "Alley-Oop" },
  { id: "0002", species: "Human", discipline: "Motocross", brand: "POOMA", rarity: "Common", trick: "Superman" },
  { id: "0003", species: "Raccoon", discipline: "BMX", brand: "MIKE", rarity: "Uncommon", trick: "Backflip" },
  { id: "0006", species: "Human", discipline: "Skateboarding", brand: "VOLCANO", rarity: "Uncommon", trick: "Boardslide" },
  { id: "0007", species: "Hyena", discipline: "Skiing", brand: "VOLCANO", rarity: "Common", trick: "Switch 900" },
  { id: "0013", species: "Shark", discipline: "BMX", brand: "PROCRASTIGONIA", rarity: "Legendary", trick: "Backflip" },
  { id: "0014", species: "Snow Leopard", discipline: "Snowboarding", brand: "QUEAZY", rarity: "Rare", trick: "Indy Grab" },
  { id: "0019", species: "Boar", discipline: "Skateboarding", brand: "CARHEART", rarity: "Rare", trick: "Boardslide" },
  { id: "0078", species: "Hyena", discipline: "Surfing", brand: "QUEAZY", rarity: "Epic", trick: "Air Reverse" },
  { id: "0123", species: "Human", discipline: "Snowboarding", brand: "CARHEART", rarity: "Legendary", trick: "Method" },
  { id: "0141", species: "Human", discipline: "Skiing", brand: "AVOIDAS", rarity: "Epic", trick: "Switch 900" },
  { id: "0227", species: "Gorilla", discipline: "Skateboarding", brand: "AVOIDAS", rarity: "Rare", trick: "Hardflip" },
];

export function ApprovalRoster() {
  return (
    <div>
      <aside className="production-notice">
        <div><span>PRODUCTION STATUS</span><b>FINAL ART IN PROGRESS</b></div>
        <p>These are 12 metadata-matched production proofs—not 1,000 finished NFTs. Minting stays disabled until every final image matches its token data and passes uniqueness validation.</p>
      </aside>
      <div className="approval-grid">
        {athletes.map((athlete) => (
          <article className="approval-card" key={athlete.id}>
            <Image
              src={`/collection/approval-v1/${athlete.id}.png`}
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
