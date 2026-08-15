import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AthleteProfilePage } from "@/components/AthleteProfilePage";
import { ProfileMoveShowcase } from "@/components/ProfileMoveShowcase";
import { getAthleteProfile } from "@/lib/athlete-profile";
import { getPublicProfile } from "@/lib/profile-data";
import { canonicalAthletePath, numericAthleteSlug } from "@/lib/profile-routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const tokenId = numericAthleteSlug(username);
  if (tokenId) {
    const athlete = await getAthleteProfile(tokenId);
    return athlete ? { title: `${athlete.token.name} — Gravity Goons`, description: `${athlete.token.discipline} NFT athlete career, ranks, tricks, sponsors, trophies, equipment, and match history.`, alternates: { canonical: canonicalAthletePath(tokenId) }, openGraph: { images: [athlete.imageUrl] } } : {};
  }
  const profile = await getPublicProfile(username);
  return profile ? { title: `${profile.displayName} — Gravity Goons`, description: profile.bio || `${profile.displayName}'s Gravity Goons collection and move cinema.` } : {};
}

export default async function UsernameProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const tokenId = numericAthleteSlug(username);
  if (tokenId) {
    if (username !== String(tokenId)) permanentRedirect(canonicalAthletePath(tokenId));
    const athlete = await getAthleteProfile(tokenId);
    if (!athlete) notFound();
    return <AthleteProfilePage profile={athlete} />;
  }
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const approved = profile.goons.flatMap((goon) => goon.moves).filter((move) => move.landVideoUrl).length;
  const totalUnlocked = profile.goons.flatMap((goon) => goon.moves).filter((move) => move.unlocked).length;

  return (
    <main className="public-profile-page">
      <header className="nav shell">
        <Link className="brand" href="/"><Image className="brand-logo" src="/collection/gravity-goons-logo.png" alt="Gravity Goons" width={160} height={160} priority /></Link>
        <nav><Link href="/profile">My Profile</Link><Link href="/moves">Move Cinema</Link><Link href="/game">PvP Arena</Link></nav>
      </header>

      <section className="profile-hero shell">
        <div><p className="eyebrow">GRAVITYGOONS.COM/{profile.username}</p><h1>{profile.displayName}</h1><p>{profile.bio || "No bio yet."}</p></div>
        <div className="profile-metrics"><div><b>{profile.goons.length}</b><span>GOONS OWNED</span></div><div><b>{approved}</b><span>SHOWCASE MOVIES</span></div><div><b>{totalUnlocked}</b><span>UNLOCKED MOVES</span></div></div>
      </section>

      {profile.isDemo && <aside className="profile-demo-banner shell"><b>LIVE PRODUCT PREVIEW</b><span>This founder profile uses preview data until Supabase and the Base collection contract are configured.</span></aside>}

      <section className="profile-collection shell">
        <div className="section-heading"><div><p className="eyebrow">VERIFIED WALLET COLLECTION</p><h2>The lineup.</h2></div><p>Ownership is refreshed from Base. Approved landing movies travel with each NFT; fall clips remain private until a failed attempt occurs in a match.</p></div>
        <div className="profile-goon-list">
          {profile.goons.map((goon) => {
            const complete = goon.moves.filter((move) => move.pairStatus === "approved").length;
            return (
              <article className="profile-goon" key={goon.tokenId}>
                <Link className="profile-goon-image" href={`/${goon.tokenId}`}><Image src={goon.imageUrl} alt={goon.name} width={1024} height={1024} /><span>{goon.rarity}</span></Link>
                <div className="profile-goon-copy">
                  <p className="eyebrow">{goon.discipline}{" // #"}{String(goon.tokenId).padStart(4, "0")}</p>
                  <h2>{goon.species}</h2>
                  <p>{goon.playStyle} build · Signature move: {goon.trickSpecialty}</p>
                  <div className="profile-reel-progress"><span>MOVIE REEL</span><b>{complete}/{goon.moves.filter((move) => move.unlocked).length} COMPLETE</b><i><em style={{ width: `${goon.moves.filter((move) => move.unlocked).length ? complete / goon.moves.filter((move) => move.unlocked).length * 100 : 0}%` }} /></i></div>
                  <div className="profile-goon-actions"><Link className="button primary" href={`/${goon.tokenId}`}>OPEN NFT PROFILE</Link><Link className="button" href={`/${profile.username}/goons/${goon.tokenId}/moves`}>MOVE STUDIO</Link></div>
                </div>
                <div className="profile-move-list">
                  {goon.moves.filter((move) => move.unlocked).map((move) => (
                    <div className="profile-move-row" key={move.trickId}>
                      <span>D{move.difficulty}</span><b>{move.name}</b><i className={`move-state state-${move.pairStatus}`}>{move.pairStatus.replaceAll("_", " ")}</i>
                      {move.landVideoUrl && <ProfileMoveShowcase name={move.name} videoUrl={move.landVideoUrl} posterUrl={move.landPosterUrl} />}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
          {!profile.goons.length && <div className="profile-empty"><b>NO GOONS FOUND</b><p>Connect the owner wallet and refresh the Base ownership index from the profile editor.</p><Link className="button primary" href="/profile">OPEN PROFILE EDITOR</Link></div>}
        </div>
      </section>
    </main>
  );
}
