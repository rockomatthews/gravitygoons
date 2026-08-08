import collection from "@/data/collection.json";
import { collectionAddress } from "@/lib/contracts";
import { getProfileForWallet } from "@/lib/profile-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CONTRACT = collectionAddress.toLowerCase();
type ProfileRow = { id: string; username: string; display_name: string; avatar_url: string | null };
export type ChatGoon = { tokenId: number; discipline: string; species: string; rarity: string };
export type ChatPerson = { id: string; username: string; displayName: string; avatarUrl: string | null; isNftHolder: boolean; goons: ChatGoon[] };

function admin() { const client = getSupabaseAdmin(); if (!client) throw new Error("Chat is not configured."); return client; }
function tokenSummary(tokenId: number): ChatGoon | null { const token = collection.tokens[tokenId - 1]; return token ? { tokenId, discipline: token.discipline, species: token.species, rarity: token.rarity } : null; }

export async function requireChatProfile(wallet: string): Promise<ProfileRow> {
  const profile = await getProfileForWallet(wallet);
  if (!profile) throw new Error("PROFILE_REQUIRED");
  return profile;
}

async function peopleForProfiles(rows: ProfileRow[]): Promise<Map<string, ChatPerson>> {
  const supabase = admin();
  if (!rows.length) return new Map();
  const { data: links, error } = await supabase.from("profile_wallets").select("profile_id,wallet_address").in("profile_id", rows.map((row) => row.id));
  if (error) throw new Error(error.message);
  const profileByWallet = new Map((links ?? []).map((row) => [String(row.wallet_address).toLowerCase(), String(row.profile_id)]));
  const tokenIds = new Map<string, number[]>();
  if (profileByWallet.size) {
    const { data: ownership, error: ownershipError } = await supabase.from("nft_ownership").select("token_id,owner_wallet_address").eq("chain_id", 8453).eq("contract_address", CONTRACT).in("owner_wallet_address", [...profileByWallet.keys()]);
    if (ownershipError) throw new Error(ownershipError.message);
    for (const owned of ownership ?? []) { const profileId = profileByWallet.get(String(owned.owner_wallet_address).toLowerCase()); if (profileId) tokenIds.set(profileId, [...(tokenIds.get(profileId) ?? []), Number(owned.token_id)]); }
  }
  return new Map(rows.map((row) => {
    const goons = [...new Set(tokenIds.get(row.id) ?? [])].sort((a, b) => a - b).map(tokenSummary).filter((item): item is ChatGoon => Boolean(item));
    return [row.id, { id: row.id, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url, isNftHolder: goons.length > 0, goons }];
  }));
}

export async function readChatRoom(wallet?: string | null) {
  const supabase = admin();
  const selfProfile = wallet ? await getProfileForWallet(wallet) : null;
  const { data: messages, error } = await supabase.from("chat_room_messages").select("id,sender_profile_id,target_profile_id,kind,body,metadata,moderation_status,created_at").neq("moderation_status", "hidden").order("created_at", { ascending: false }).limit(120);
  if (error) throw new Error(error.message);
  const { data: recentProfiles, error: profileError } = await supabase.from("profiles").select("id,username,display_name,avatar_url").order("created_at", { ascending: false }).limit(100);
  if (profileError) throw new Error(profileError.message);
  const ids = new Set<string>();
  for (const message of messages ?? []) { ids.add(String(message.sender_profile_id)); if (message.target_profile_id) ids.add(String(message.target_profile_id)); }
  if (selfProfile) ids.add(selfProfile.id);
  const allRows = (recentProfiles ?? []) as ProfileRow[];
  const missingIds = [...ids].filter((id) => !allRows.some((row) => row.id === id));
  const { data: missing } = missingIds.length ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", missingIds) : { data: [] };
  const people = await peopleForProfiles([...allRows, ...((missing ?? []) as ProfileRow[])]);
  return {
    self: selfProfile ? people.get(selfProfile.id) ?? null : null,
    people: [...people.values()].filter((person) => person.id !== selfProfile?.id).sort((a, b) => Number(b.isNftHolder) - Number(a.isNftHolder) || a.displayName.localeCompare(b.displayName)),
    messages: [...(messages ?? [])].reverse().map((message) => ({
      id: message.id, kind: message.kind, body: message.body, metadata: message.metadata, moderationStatus: message.moderation_status, createdAt: message.created_at,
      sender: people.get(String(message.sender_profile_id)), target: message.target_profile_id ? people.get(String(message.target_profile_id)) ?? null : null,
      isMine: selfProfile?.id === message.sender_profile_id,
    })).filter((message) => Boolean(message.sender)),
  };
}

export async function postChatRoomMessage(wallet: string, input: { kind?: string; body?: string; targetUsername?: string; challengerTokenId?: number; challengedTokenId?: number }) {
  const supabase = admin();
  const self = await requireChatProfile(wallet);
  const since = new Date(Date.now() - 10_000).toISOString();
  const { count } = await supabase.from("chat_room_messages").select("id", { count: "exact", head: true }).eq("sender_profile_id", self.id).gt("created_at", since);
  if ((count ?? 0) >= 8) throw new Error("Slow down for a few seconds before posting again.");
  const kind = input.kind === "match_request" ? "match_request" : "text";
  let body = (input.body ?? "").trim();
  let targetProfileId: string | null = null;
  let metadata: Record<string, unknown> = {};
  if (kind === "text") {
    if (!body || body.length > 500) throw new Error("Messages must be 1–500 characters.");
  } else {
    const { data: target } = await supabase.from("profiles").select("id,username,display_name,avatar_url").eq("username", (input.targetUsername ?? "").toLowerCase()).maybeSingle();
    if (!target || target.id === self.id) throw new Error("Choose another NFT player.");
    const people = await peopleForProfiles([self, target as ProfileRow]);
    const me = people.get(self.id)!; const them = people.get(target.id)!;
    const mine = me.goons.find((item) => item.tokenId === Number(input.challengerTokenId));
    const theirs = them.goons.find((item) => item.tokenId === Number(input.challengedTokenId));
    if (!mine || !theirs || mine.discipline !== theirs.discipline) throw new Error("Choose two currently owned Goons in the same discipline.");
    targetProfileId = target.id;
    body = `@${target.username} — ${mine.discipline} callout: #${String(mine.tokenId).padStart(4, "0")} vs #${String(theirs.tokenId).padStart(4, "0")}.`;
    metadata = { challenger_token_id: mine.tokenId, challenged_token_id: theirs.tokenId, discipline: mine.discipline };
  }
  const { data, error } = await supabase.from("chat_room_messages").insert({ sender_profile_id: self.id, target_profile_id: targetProfileId, kind, body, metadata }).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function reportChatRoomMessage(wallet: string, messageId: string) {
  const supabase = admin(); const self = await requireChatProfile(wallet);
  const { data: message } = await supabase.from("chat_room_messages").select("id,sender_profile_id").eq("id", messageId).maybeSingle();
  if (!message || message.sender_profile_id === self.id) throw new Error("Message not found.");
  const { error } = await supabase.from("chat_room_reports").upsert({ reporter_profile_id: self.id, message_id: message.id, reason: "Reported from Goon Chat" }, { onConflict: "reporter_profile_id,message_id" });
  if (error) throw new Error(error.message);
  await supabase.from("chat_room_messages").update({ moderation_status: "reported" }).eq("id", message.id).eq("moderation_status", "visible");
  return { reported: true };
}
