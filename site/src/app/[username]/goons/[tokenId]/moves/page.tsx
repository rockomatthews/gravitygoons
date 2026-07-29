import { notFound } from "next/navigation";
import { MoveStudioClient } from "@/components/MoveStudioClient";
import { getPublicProfile } from "@/lib/profile-data";

export default async function GoonMoveStudioPage({ params }: { params: Promise<{ username: string; tokenId: string }> }) {
  const { username, tokenId: raw } = await params;
  const tokenId = Number(raw);
  const profile = await getPublicProfile(username);
  const goon = profile?.goons.find((candidate) => candidate.tokenId === tokenId);
  if (!profile || !goon) notFound();
  return <main className="move-studio-owner-page shell"><MoveStudioClient username={profile.username} tokenId={tokenId} fallbackGoon={goon} /></main>;
}

