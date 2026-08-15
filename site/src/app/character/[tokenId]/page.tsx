import { notFound, permanentRedirect } from "next/navigation";
import { numericAthleteSlug } from "@/lib/profile-routing";

export default async function CharacterPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId: raw } = await params;
  const tokenId = numericAthleteSlug(raw);
  if (!tokenId) notFound();
  permanentRedirect(`/${tokenId}`);
}
