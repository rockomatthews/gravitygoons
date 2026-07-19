import Image from "next/image";

const athletes = [
  { species: "Snow Leopard", discipline: "Skateboarding", brand: "MIKE" },
  { species: "Hyena", discipline: "BMX", brand: "AVOIDAS" },
  { species: "Ram", discipline: "Skiing", brand: "POOMA" },
  { species: "Boar", discipline: "Motocross", brand: "VANISH" },
  { species: "Shark", discipline: "Surfing", brand: "NORTH FAKE" },
  { species: "Gorilla", discipline: "Snowboarding", brand: "OFF-BEIGE" },
  { species: "Fox", discipline: "Skateboarding", brand: "CARHEART" },
  { species: "Raccoon", discipline: "BMX", brand: "PROCRASTIGONIA" },
  { species: "Snow Leopard", discipline: "Skiing", brand: "BURNTON" },
  { species: "Human", discipline: "Surfing", brand: "VOLCANO" },
  { species: "Human", discipline: "Motocross", brand: "FAUX RACING" },
  { species: "Human", discipline: "Snowboarding", brand: "QUEAZY" },
];

export function ApprovalRoster() {
  return (
    <div>
      <aside className="production-notice">
        <div><span>PRODUCTION STATUS</span><b>FINAL ART IN PROGRESS</b></div>
        <p>These are 12 distinct approved concept athletes—not 1,000 finished NFTs. Minting stays disabled until every final image matches its token metadata and passes uniqueness validation.</p>
      </aside>
      <div className="approval-grid">
        {athletes.map((athlete, index) => (
          <article className="approval-card" key={athlete.brand + athlete.discipline}>
            <Image
              src={"/collection/roster/" + String(index + 1).padStart(2, "0") + ".png"}
              alt={athlete.brand + " " + athlete.species + " " + athlete.discipline + " concept athlete"}
              width={626}
              height={836}
            />
            <div>
              <span>CONCEPT {String(index + 1).padStart(2, "0")} · {athlete.discipline}</span>
              <h3>{athlete.species}</h3>
              <b>{athlete.brand}</b>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
