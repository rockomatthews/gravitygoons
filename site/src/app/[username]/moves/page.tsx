import { notFound } from "next/navigation";
import { MoveStudioClient } from "@/components/MoveStudioClient";
import { getAthleteProfile } from "@/lib/athlete-profile";
import type { ProfileGoon, ProfileMove } from "@/lib/profile-types";
import { canonicalAthletePath, numericAthleteSlug } from "@/lib/profile-routing";

export const dynamic = "force-dynamic";

export default async function CanonicalGoonMoveStudioPage({ params }: { params: Promise<{ username: string }> }) {
  const { username: slug } = await params;
  const tokenId = numericAthleteSlug(slug);
  if (!tokenId) notFound();
  const athlete = await getAthleteProfile(tokenId);
  if (!athlete) notFound();

  const moveFor = (trick: { id: number; name: string; difficulty: number }, unlocked: boolean): ProfileMove => {
    const movie = athlete.moveMovies[String(trick.id)] ?? athlete.moveMovies[trick.id];
    return {
      trickId: trick.id,
      name: trick.name,
      difficulty: trick.difficulty,
      unlocked,
      pairId: null,
      pairStatus: movie?.videoUrl ? "approved" : "no_movie",
      landStatus: movie?.videoUrl ? "approved" : "missing",
      fallStatus: "missing",
      landVideoUrl: movie?.videoUrl ?? null,
      landPosterUrl: movie?.posterUrl ?? null,
    };
  };
  const fallbackGoon: ProfileGoon = {
    tokenId,
    name: athlete.token.name,
    species: athlete.token.species,
    discipline: athlete.token.discipline,
    rarity: athlete.token.rarity,
    playStyle: athlete.token.play_style,
    trickSpecialty: athlete.token.trick_specialty,
    imageUrl: athlete.imageUrl,
    moves: [
      ...(athlete.career.unlockedTricks ?? []).map((trick) => moveFor(trick, true)),
      ...(athlete.career.lockedTricks ?? []).map((trick) => moveFor(trick, false)),
    ],
  };

  return (
    <main className="move-studio-owner-page shell">
      <MoveStudioClient
        username={athlete.ownerProfile?.username ?? "profile"}
        tokenId={tokenId}
        fallbackGoon={fallbackGoon}
        backHref={canonicalAthletePath(tokenId)}
        backLabel={`BACK TO ${athlete.token.name.toUpperCase()} PROFILE`}
      />
    </main>
  );
}
