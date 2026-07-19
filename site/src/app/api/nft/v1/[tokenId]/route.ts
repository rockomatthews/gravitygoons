import { createHash } from "node:crypto";
import collection from "@/data/collection.json";
import { signatureEdgeForRarity } from "@/lib/gameplay";
import tricks from "@/data/tricks.json";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { publicClient, registryAbi, registryAddress, ZERO_ADDRESS } from "@/lib/contracts";

export const dynamic = "force-dynamic";

type Progress = { xp: bigint; trickBitmap: bigint; achievementBitmap: bigint; level: number; nonce: number; catalogVersion: number };

async function readProgress(tokenId: number): Promise<Progress> {
  if (registryAddress !== ZERO_ADDRESS) {
    try {
      const value = await publicClient.readContract({ address: registryAddress, abi: registryAbi, functionName: "progressOf", args: [BigInt(tokenId)] });
      return { xp: value.xp, trickBitmap: value.trickBitmap, achievementBitmap: value.achievementBitmap, level: Number(value.level || 1), nonce: Number(value.nonce), catalogVersion: Number(value.catalogVersion || 1) };
    } catch { /* Fall through to the cache. */ }
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase.from("progress_cache").select("xp,level,trick_bitmap,achievement_bitmap,catalog_version,chain_nonce").eq("token_id", tokenId).maybeSingle();
    if (data) return { xp: BigInt(data.xp), trickBitmap: BigInt(data.trick_bitmap), achievementBitmap: BigInt(data.achievement_bitmap), level: data.level, nonce: data.chain_nonce, catalogVersion: data.catalog_version };
  }
  return { xp: 0n, trickBitmap: 0n, achievementBitmap: 0n, level: 1, nonce: 0, catalogVersion: 1 };
}

export async function GET(_request: Request, context: { params: Promise<{ tokenId: string }> }) {
  const { tokenId: raw } = await context.params;
  const tokenId = Number(raw);
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000) return Response.json({ error: "Unknown token" }, { status: 404 });
  const token = collection.tokens[tokenId - 1];
  const progress = await readProgress(tokenId);
  const trickNames = tricks[token.discipline as keyof typeof tricks];
  const learned = trickNames.filter((_name, index) => (progress.trickBitmap & (1n << BigInt(index))) !== 0n);
  const imageBase = process.env.NEXT_PUBLIC_IMAGE_BASE_URI ?? collection.collection.image_base_uri;
  const attributes: Array<Record<string, string | number>> = [
    { trait_type: "Cast", value: token.cast }, { trait_type: "Species", value: token.species },
    { trait_type: "Archetype", value: token.archetype }, { trait_type: "Body Build", value: token.body_build },
    { trait_type: "Complexion", value: token.complexion }, { trait_type: "Eyes", value: token.eyes },
    { trait_type: "Hair / Fur", value: token.hair },
    { trait_type: "Discipline", value: token.discipline }, { trait_type: "Stance", value: token.stance },
    { trait_type: "Expression", value: token.expression }, { trait_type: "Headwear", value: token.headwear },
    { trait_type: "Eyewear", value: token.eyewear }, { trait_type: "Parody Brand", value: token.parody_brand },
    { trait_type: "Apparel", value: token.apparel }, { trait_type: "Bottom", value: token.bottom },
    { trait_type: "Footwear", value: token.footwear }, { trait_type: "Sport Equipment", value: token.sport_equipment },
    { trait_type: "Pose", value: token.pose }, { trait_type: "Play Style", value: token.play_style },
    { trait_type: "Trick Specialty", value: token.trick_specialty },
    { trait_type: "Accessory", value: token.accessory }, { trait_type: "Background", value: token.background },
    { trait_type: "Rarity", value: token.rarity },
    { display_type: "number", trait_type: "Signature Edge", value: signatureEdgeForRarity(token.rarity), max_value: 4 },
    ...Object.entries(token.stats).map(([trait_type, value]) => ({ display_type: "number", trait_type, value, max_value: 10 })),
    { display_type: "number", trait_type: "Level", value: progress.level || 1 },
    { display_type: "number", trait_type: "XP", value: Number(progress.xp) },
    { display_type: "number", trait_type: "Tricks Learned", value: learned.length, max_value: 64 },
    { trait_type: "Progress Schema", value: `v${collection.collection.schema_version}` },
    ...learned.map((value) => ({ trait_type: "Learned Trick", value })),
  ];
  const metadata = {
    name: token.name,
    description: collection.collection.description,
    image: `${imageBase}${String(tokenId).padStart(4, "0")}.png`,
    external_url: `https://gravitygoons.com/character/${String(tokenId).padStart(4, "0")}`,
    attributes,
    properties: {
      discipline: token.discipline,
      progress_registry: collection.collection.progress_registry_address,
      schema_version: collection.collection.schema_version,
      catalog_version: progress.catalogVersion,
      chain_nonce: progress.nonce,
      genesis_metadata: `${collection.collection.genesis_metadata_base_uri}${String(tokenId).padStart(4, "0")}.json`,
    },
  };
  const body = JSON.stringify(metadata);
  const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
  return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "public, max-age=15, s-maxage=30, stale-while-revalidate=300", etag } });
}
