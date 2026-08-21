import "server-only";

import { collectionAddress } from "@/lib/contracts";
import { turnFromPayload, type MatchActionPresentation, type MoveOutcomeVisual } from "@/lib/match-presentation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CHAIN_ID = 8453;
type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type ActionRow = { result_payload: Record<string, unknown>; [key: string]: unknown };
type PairRow = { id: string; token_id: number; trick_id: number };
type AssetRow = { pair_id: string; outcome: "land" | "fall"; version: number; video_url: string | null; poster_url: string | null };

export async function addMovePresentations<T extends ActionRow>(supabase: AdminClient, actions: T[]): Promise<Array<T & { presentation: MatchActionPresentation }>> {
  const attempts = actions.flatMap((action) => turnFromPayload(action.result_payload)?.attempts.filter((attempt) => attempt !== null) ?? []);
  const tokenIds = Array.from(new Set(attempts.map((attempt) => attempt.tokenId)));
  const trickIds = Array.from(new Set(attempts.map((attempt) => attempt.trick.id)));
  if (!tokenIds.length || !trickIds.length) return actions.map((action) => ({ ...action, presentation: { attempts: [] } }));

  const { data: pairData, error: pairError } = await supabase
    .from("move_media_pairs")
    .select("id,token_id,trick_id")
    .eq("chain_id", CHAIN_ID)
    .eq("contract_address", collectionAddress.toLowerCase())
    .in("token_id", tokenIds)
    .in("trick_id", trickIds)
    .eq("status", "approved");
  if (pairError || !pairData?.length) return actions.map((action) => ({ ...action, presentation: { attempts: [] } }));
  const pairs = pairData as PairRow[];

  const { data: assetData, error: assetError } = await supabase
    .from("move_media_assets")
    .select("pair_id,outcome,version,video_url,poster_url")
    .in("pair_id", pairs.map((pair) => pair.id))
    .eq("status", "approved")
    .eq("moderation_status", "passed")
    .eq("owner_decision", "approved")
    .not("video_url", "is", null)
    .order("version", { ascending: false });
  if (assetError) return actions.map((action) => ({ ...action, presentation: { attempts: [] } }));

  const pairByKey = new Map(pairs.map((pair) => [`${pair.token_id}:${pair.trick_id}`, pair.id]));
  const latestAsset = new Map<string, AssetRow>();
  for (const asset of (assetData ?? []) as AssetRow[]) {
    const key = `${asset.pair_id}:${asset.outcome}`;
    if (!latestAsset.has(key)) latestAsset.set(key, asset);
  }

  return actions.map((action) => {
    const turn = turnFromPayload(action.result_payload);
    const visuals: MoveOutcomeVisual[] = [];
    for (const attempt of turn?.attempts ?? []) {
      if (!attempt) continue;
      const outcome = attempt.landed ? "land" : "fall";
      const pairId = pairByKey.get(`${attempt.tokenId}:${attempt.trick.id}`);
      const asset = pairId ? latestAsset.get(`${pairId}:${outcome}`) : null;
      if (asset?.video_url) visuals.push({ tokenId: attempt.tokenId, trickId: attempt.trick.id, outcome, videoUrl: asset.video_url, posterUrl: asset.poster_url });
    }
    return { ...action, presentation: { attempts: visuals } };
  });
}
