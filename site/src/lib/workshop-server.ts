import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyTokenOwnership } from "@/lib/profile-data";

function validTokenId(tokenId: number) {
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000) throw new Error("INVALID_TOKEN_ID");
  return tokenId;
}

async function requireOwner(wallet: string, tokenId: number) {
  validTokenId(tokenId);
  if (!await verifyTokenOwnership(wallet, tokenId)) throw new Error("LIVE_OWNERSHIP_REQUIRED");
}

export async function listWorkshopRecipes() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase.from("goon_item_definitions").select("id,name,description,discipline,slot,tier,competitive_modifier,max_durability,recipe,requirements,season_id").eq("active", true).order("slot").order("tier");
  if (error) throw error;
  return data;
}

export async function craftItem(wallet: string, input: { tokenId?: number; recipeId?: string; idempotencyKey?: string }) {
  const tokenId = validTokenId(Number(input.tokenId));
  await requireOwner(wallet, tokenId);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("GOONIVERSE_DATABASE_UNAVAILABLE");
  if (!input.recipeId || !input.idempotencyKey) throw new Error("RECIPE_AND_IDEMPOTENCY_REQUIRED");
  const { data, error } = await supabase.rpc("craft_goon_item", { p_token_id: tokenId, p_item_definition_id: input.recipeId, p_idempotency_key: input.idempotencyKey, p_actor_wallet: wallet });
  if (error) throw new Error(error.message);
  return data;
}

export async function repairItem(wallet: string, input: { tokenId?: number; inventoryId?: string; idempotencyKey?: string }) {
  const tokenId = validTokenId(Number(input.tokenId));
  await requireOwner(wallet, tokenId);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("GOONIVERSE_DATABASE_UNAVAILABLE");
  if (!input.inventoryId || !input.idempotencyKey) throw new Error("ITEM_AND_IDEMPOTENCY_REQUIRED");
  const { data, error } = await supabase.rpc("repair_goon_item", { p_token_id: tokenId, p_inventory_id: input.inventoryId, p_idempotency_key: input.idempotencyKey, p_actor_wallet: wallet });
  if (error) throw new Error(error.message);
  return data;
}

export async function equipItem(wallet: string, input: { tokenId?: number; inventoryId?: string; slot?: string; idempotencyKey?: string }) {
  const tokenId = validTokenId(Number(input.tokenId));
  await requireOwner(wallet, tokenId);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("GOONIVERSE_DATABASE_UNAVAILABLE");
  if (!input.idempotencyKey || !["performance", "protective", "cosmetic", "celebration"].includes(input.slot ?? "")) throw new Error("INVALID_LOADOUT_CHANGE");
  const { data, error } = await supabase.rpc("set_goon_loadout_item", { p_token_id: tokenId, p_inventory_id: input.inventoryId ?? null, p_slot: input.slot, p_idempotency_key: input.idempotencyKey, p_actor_wallet: wallet });
  if (error) throw new Error(error.message);
  return data;
}
