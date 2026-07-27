import { decodeEventLog, parseAbiItem } from "viem";
import { collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { goonImageUrl } from "@/lib/goon-images";
import { formatUsdc, getProfileForWallet, tokenDisciplineIndex, tokenMove, verifyTokenOwnership } from "@/lib/profile-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { seedanceConfigured, submitSeedanceJob } from "@/lib/seedance-server";

const CHAIN_ID = 8453;
const BASE_USDC = (process.env.BASE_USDC_ADDRESS ?? "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913").toLowerCase();
const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

type PairRow = { id: string; token_id: number; trick_id: number; status: string; commissioned_by_wallet: string };
type OrderRow = { id: string; pair_id: string; payer_wallet_address: string; amount_minor_units: number | string; status: string; quote_expires_at: string; payment_tx_hash: string | null };
type AssetRow = { id: string; pair_id: string; outcome: "land" | "fall"; version: number; status: string; source_image_url: string; prompt: string; provider_job_id: string | null; moderation_status: string; owner_decision: string };
type JobRow = { id: string; asset_id: string; idempotency_key: string; provider_job_id: string | null; status: string };

function absoluteImageUrl(tokenId: number): string {
  const url = goonImageUrl(tokenId);
  if (/^https:\/\//.test(url)) return url;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return siteUrl ? `${siteUrl}${url}` : url;
}

function promptFor(tokenId: number, trickId: number, outcome: "land" | "fall"): string {
  const result = tokenMove(tokenId, trickId);
  if (!result.trick) throw new Error("Move not found in this discipline catalog.");
  const token = result.token;
  const action = outcome === "land"
    ? `performs a ${result.trick.name} and lands it cleanly, riding away under full control`
    : `performs a ${result.trick.name}, loses control during the landing, falls safely, and does not land the trick`;
  return `Five-second square action-sports broadcast clip. Preserve the exact identity, species, face, body, clothing, fictional sponsor marks, stance, and ${token.sport_equipment} from the source image. The ${token.species} ${result.discipline} rider ${action}. Show one coherent rider and one complete set of discipline-correct equipment. Keep anatomy, pedals, bindings, boards, skis, wheels, handlebars, fins, and tail attachment physically correct. No extra limbs, duplicate equipment, real trademarks, text mutation, camera cuts, or outcome ambiguity.`;
}

function quoteAmount(): number {
  const value = Number(process.env.MOVE_PAIR_PRICE_USDC_MINOR ?? 12_000_000);
  if (!Number.isInteger(value) || value <= 0) throw new Error("MOVE_PAIR_PRICE_USDC_MINOR must be a positive integer.");
  return value;
}

export async function createMoveQuote(walletAddress: string, tokenId: number, trickId: number) {
  if (!(await verifyTokenOwnership(walletAddress, tokenId))) throw new Error("The connected wallet does not currently own this Goon.");
  const { trick } = tokenMove(tokenId, trickId);
  if (!trick) throw new Error("Move not found in this Goon's discipline.");
  if (trick.sponsorId !== null) throw new Error("This move must be permanently unlocked before its movie can be commissioned.");
  const amount = quoteAmount();
  const supabase = getSupabaseAdmin();
  if (!supabase || collectionAddress === ZERO_ADDRESS) return { demo: true, orderId: "demo-order", pairId: "demo-pair", amountMinorUnits: amount, displayPrice: formatUsdc(amount), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };

  const wallet = walletAddress.toLowerCase();
  const profile = await getProfileForWallet(wallet);
  if (!profile) throw new Error("Create your Gravity Goons username profile before commissioning a movie.");
  const contract = collectionAddress.toLowerCase();
  const { data: existingData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status,commissioned_by_wallet").eq("chain_id", CHAIN_ID).eq("contract_address", contract).eq("token_id", tokenId).eq("catalog_version", 1).eq("trick_id", trickId).maybeSingle();
  const existing = existingData as PairRow | null;
  if (existing) {
    const { data: orderData } = await supabase.from("move_media_orders").select("id,pair_id,payer_wallet_address,amount_minor_units,status,quote_expires_at,payment_tx_hash").eq("pair_id", existing.id).maybeSingle();
    const order = orderData as OrderRow | null;
    if (order && order.status !== "expired") return { demo: false, orderId: order.id, pairId: existing.id, amountMinorUnits: Number(order.amount_minor_units), displayPrice: formatUsdc(Number(order.amount_minor_units)), expiresAt: order.quote_expires_at, status: order.status };
    if (order?.status === "expired") {
      const providerCost = Math.min(amount, Number(process.env.MOVE_PAIR_ESTIMATED_COST_USDC_MINOR ?? 2_500_000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await Promise.all([
        supabase.from("move_media_pairs").update({ commissioned_by_profile_id: profile.id, commissioned_by_wallet: wallet, status: "quoted" }).eq("id", existing.id),
        supabase.from("move_media_orders").update({ profile_id: profile.id, payer_wallet_address: wallet, amount_minor_units: amount, provider_cost_minor_units: providerCost, platform_margin_minor_units: amount - providerCost, payment_tx_hash: null, payment_reference: null, status: "quoted", quote_expires_at: expiresAt, paid_at: null }).eq("id", order.id),
      ]);
      return { demo: false, orderId: order.id, pairId: existing.id, amountMinorUnits: amount, displayPrice: formatUsdc(amount), expiresAt };
    }
    throw new Error("This move already has a movie workflow. Open its studio status instead of purchasing it again.");
  }

  const { data: pairData, error: pairError } = await supabase.from("move_media_pairs").insert({
    chain_id: CHAIN_ID,
    contract_address: contract,
    token_id: tokenId,
    discipline: tokenDisciplineIndex(tokenId),
    catalog_version: 1,
    trick_id: trickId,
    template_version: 1,
    commissioned_by_profile_id: profile.id,
    commissioned_by_wallet: wallet,
    status: "quoted",
  }).select("id,token_id,trick_id,status,commissioned_by_wallet").single();
  if (pairError) throw new Error(pairError.message);
  const pair = pairData as PairRow;
  const providerCost = Math.min(amount, Number(process.env.MOVE_PAIR_ESTIMATED_COST_USDC_MINOR ?? 2_500_000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { data: orderData, error: orderError } = await supabase.from("move_media_orders").insert({
    pair_id: pair.id,
    profile_id: profile.id,
    payer_wallet_address: wallet,
    currency: "USDC",
    amount_minor_units: amount,
    provider_cost_minor_units: providerCost,
    platform_margin_minor_units: amount - providerCost,
    chain_id: CHAIN_ID,
    status: "quoted",
    quote_expires_at: expiresAt,
  }).select("id,pair_id,payer_wallet_address,amount_minor_units,status,quote_expires_at,payment_tx_hash").single();
  if (orderError) {
    await supabase.from("move_media_pairs").delete().eq("id", pair.id);
    throw new Error(orderError.message);
  }
  const order = orderData as OrderRow;
  return { demo: false, orderId: order.id, pairId: pair.id, amountMinorUnits: amount, displayPrice: formatUsdc(amount), expiresAt };
}

async function verifyUsdcTransfer(order: OrderRow, txHash: `0x${string}`): Promise<void> {
  if (process.env.MOVE_PAYMENT_MODE !== "live") {
    if (process.env.NODE_ENV === "production") throw new Error("MOVE_PAYMENT_MODE=live is required before accepting production payments.");
    return;
  }
  const treasury = process.env.MOVE_TREASURY_ADDRESS?.toLowerCase();
  if (!treasury) throw new Error("MOVE_TREASURY_ADDRESS is not configured.");
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error("The payment transaction did not succeed.");
  let paid = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== BASE_USDC) continue;
    try {
      const decoded = decodeEventLog({ abi: [TRANSFER_EVENT], data: log.data, topics: log.topics });
      if (decoded.eventName === "Transfer" && decoded.args.from.toLowerCase() === order.payer_wallet_address && decoded.args.to.toLowerCase() === treasury) paid += decoded.args.value;
    } catch {
      // Ignore unrelated USDC events in the same transaction.
    }
  }
  if (paid < BigInt(order.amount_minor_units)) throw new Error("The confirmed USDC transfer is smaller than the quoted amount.");
}

async function enqueuePair(pair: PairRow): Promise<{ submitted: number; configured: boolean }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { submitted: 0, configured: false };
  const sourceImageUrl = absoluteImageUrl(pair.token_id);
  const assets: AssetRow[] = [];
  for (const outcome of ["land", "fall"] as const) {
    const prompt = promptFor(pair.token_id, pair.trick_id, outcome);
    const { data, error } = await supabase.from("move_media_assets").insert({ pair_id: pair.id, outcome, version: 1, status: "queued", source_image_url: sourceImageUrl, prompt }).select("id,pair_id,outcome,version,status,source_image_url,prompt,provider_job_id,moderation_status,owner_decision").single();
    if (error && error.code !== "23505") throw new Error(error.message);
    if (data) {
      assets.push(data as AssetRow);
    } else {
      const { data: existing, error: existingError } = await supabase.from("move_media_assets").select("id,pair_id,outcome,version,status,source_image_url,prompt,provider_job_id,moderation_status,owner_decision").eq("pair_id", pair.id).eq("outcome", outcome).eq("version", 1).single();
      if (existingError) throw new Error(existingError.message);
      assets.push(existing as AssetRow);
    }
  }
  let submitted = 0;
  for (const asset of assets) {
    const idempotencyKey = `${pair.id}:${asset.outcome}:v${asset.version}`;
    const requestPayload = { model: "bytedance/seedance-2.0/fast/image-to-video", prompt: asset.prompt, image_url: asset.source_image_url, resolution: "720p", duration: 5 };
    const { data: jobData, error: jobError } = await supabase.from("move_generation_jobs").insert({ asset_id: asset.id, idempotency_key: idempotencyKey, status: "queued", request_payload: requestPayload }).select("id,asset_id,idempotency_key,provider_job_id,status").single();
    if (jobError && jobError.code !== "23505") throw new Error(jobError.message);
    let job = jobData as JobRow | null;
    if (!job) {
      const { data: existingJob, error: existingJobError } = await supabase.from("move_generation_jobs").select("id,asset_id,idempotency_key,provider_job_id,status").eq("idempotency_key", idempotencyKey).single();
      if (existingJobError) throw new Error(existingJobError.message);
      job = existingJob as JobRow;
    }
    if (job.provider_job_id || job.status !== "queued" || !seedanceConfigured()) continue;
    const { data: claimedJob } = await supabase.from("move_generation_jobs").update({ status: "processing" }).eq("id", job.id).eq("status", "queued").select("id").maybeSingle();
    if (!claimedJob) continue;
    let providerJobId: string | null;
    try {
      providerJobId = await submitSeedanceJob({ prompt: asset.prompt, imageUrl: asset.source_image_url, idempotencyKey });
    } catch (error) {
      await supabase.from("move_generation_jobs").update({ status: "queued", error_message: error instanceof Error ? error.message : "Seedance submission failed." }).eq("id", job.id);
      throw error;
    }
    if (!providerJobId) {
      await supabase.from("move_generation_jobs").update({ status: "queued" }).eq("id", job.id);
      continue;
    }
    await Promise.all([
      supabase.from("move_generation_jobs").update({ provider_job_id: providerJobId, status: "submitted", submitted_at: new Date().toISOString() }).eq("id", job.id),
      supabase.from("move_media_assets").update({ provider_job_id: providerJobId, status: "generating" }).eq("id", asset.id),
    ]);
    submitted += 1;
  }
  await supabase.from("move_media_pairs").update({ status: submitted ? "generating" : "queued" }).eq("id", pair.id);
  return { submitted, configured: seedanceConfigured() };
}

export async function confirmMovePayment(walletAddress: string, orderId: string, txHash: `0x${string}`) {
  const supabase = getSupabaseAdmin();
  if (!supabase || collectionAddress === ZERO_ADDRESS) return { demo: true, orderId, status: "confirmed", generation: "demo" };
  const { data: orderData } = await supabase.from("move_media_orders").select("id,pair_id,payer_wallet_address,amount_minor_units,status,quote_expires_at,payment_tx_hash").eq("id", orderId).maybeSingle();
  const order = orderData as OrderRow | null;
  if (!order || order.payer_wallet_address !== walletAddress.toLowerCase()) throw new Error("Move order not found for this wallet.");
  if (order.status === "confirmed") {
    const { data: confirmedPairData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status,commissioned_by_wallet").eq("id", order.pair_id).single();
    const generation = await enqueuePair(confirmedPairData as PairRow);
    return { demo: false, orderId, status: "confirmed", generation };
  }
  if (new Date(order.quote_expires_at).getTime() < Date.now()) {
    await supabase.from("move_media_orders").update({ status: "expired" }).eq("id", order.id);
    throw new Error("This quote expired. Request a new quote before paying.");
  }
  await verifyUsdcTransfer(order, txHash);
  const { data: pairData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status,commissioned_by_wallet").eq("id", order.pair_id).single();
  const pair = pairData as PairRow;
  if (!(await verifyTokenOwnership(walletAddress, pair.token_id))) throw new Error("Current NFT ownership could not be verified. Payment was not accepted.");
  await Promise.all([
    supabase.from("move_media_orders").update({ status: "confirmed", payment_tx_hash: txHash, paid_at: new Date().toISOString() }).eq("id", order.id),
    supabase.from("move_media_pairs").update({ status: "paid" }).eq("id", pair.id),
  ]);
  const submitted = await enqueuePair(pair);
  return { demo: false, orderId, status: "confirmed", generation: submitted };
}

export async function reviewMoveAsset(walletAddress: string, assetId: string, decision: "approved" | "rejected" | "reroll", note = "") {
  const supabase = getSupabaseAdmin();
  if (!supabase || collectionAddress === ZERO_ADDRESS) return { demo: true, assetId, decision };
  const { data: assetData } = await supabase.from("move_media_assets").select("id,pair_id,outcome,version,status,source_image_url,prompt,provider_job_id,moderation_status,owner_decision").eq("id", assetId).maybeSingle();
  const asset = assetData as AssetRow | null;
  if (!asset) throw new Error("Movie draft not found.");
  const { data: pairData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status,commissioned_by_wallet").eq("id", asset.pair_id).single();
  const pair = pairData as PairRow;
  if (!(await verifyTokenOwnership(walletAddress, pair.token_id))) throw new Error("Only the current NFT owner can review this movie.");
  if (asset.status !== "owner_review") throw new Error("This outcome is not currently awaiting owner review.");
  const reviewedAt = new Date().toISOString();
  await supabase.from("move_media_reviews").insert({ asset_id: asset.id, reviewer_wallet_address: walletAddress.toLowerCase(), decision, note, ownership_verified_at: reviewedAt });

  if (decision === "reroll") {
    const nextVersion = asset.version + 1;
    const rerollPrompt = note.trim() ? `${asset.prompt} Owner revision note: ${note.trim()}` : asset.prompt;
    const { data: nextData, error } = await supabase.from("move_media_assets").insert({ pair_id: pair.id, outcome: asset.outcome, version: nextVersion, status: "queued", source_image_url: asset.source_image_url, prompt: rerollPrompt }).select("id,pair_id,outcome,version,status,source_image_url,prompt,provider_job_id,moderation_status,owner_decision").single();
    if (error) throw new Error(error.message);
    const nextAsset = nextData as AssetRow;
    const idempotencyKey = `${pair.id}:${asset.outcome}:v${nextVersion}`;
    const { data: jobData, error: jobError } = await supabase.from("move_generation_jobs").insert({ asset_id: nextAsset.id, idempotency_key: idempotencyKey, status: "queued", attempt: nextVersion, request_payload: { prompt: rerollPrompt, image_url: asset.source_image_url, resolution: "720p", duration: 5 } }).select("id,asset_id,idempotency_key,provider_job_id,status").single();
    if (jobError) throw new Error(jobError.message);
    const job = jobData as JobRow;
    const providerJobId = await submitSeedanceJob({ prompt: rerollPrompt, imageUrl: asset.source_image_url, idempotencyKey });
    if (providerJobId) {
      await Promise.all([
        supabase.from("move_generation_jobs").update({ provider_job_id: providerJobId, status: "submitted", submitted_at: reviewedAt }).eq("id", job.id),
        supabase.from("move_media_assets").update({ provider_job_id: providerJobId, status: "generating" }).eq("id", nextAsset.id),
      ]);
    }
    await supabase.from("move_media_pairs").update({ status: "rerolling" }).eq("id", pair.id);
    return { demo: false, assetId: nextAsset.id, decision, providerJobId };
  }

  // An approved LAND draft remains private until its matching FALL draft is
  // also approved. This prevents public profiles from advertising an
  // incomplete gameplay pair.
  await supabase.from("move_media_assets").update({ owner_decision: decision, status: decision, reviewed_at: reviewedAt, published_at: null }).eq("id", asset.id);
  const { data: latestData } = await supabase.from("move_media_assets").select("id,pair_id,outcome,version,status,source_image_url,prompt,provider_job_id,moderation_status,owner_decision").eq("pair_id", pair.id).order("version", { ascending: false });
  const latestByOutcome = new Map<string, AssetRow>();
  for (const row of (latestData ?? []) as AssetRow[]) if (!latestByOutcome.has(row.outcome)) latestByOutcome.set(row.outcome, row);
  const latest = [...latestByOutcome.values()];
  const pairStatus = latest.length === 2 && latest.every((item) => item.owner_decision === "approved") ? "approved" : latest.some((item) => item.owner_decision === "rejected") ? "rejected" : "owner_review";
  await supabase.from("move_media_pairs").update({ status: pairStatus, published_at: pairStatus === "approved" ? reviewedAt : null }).eq("id", pair.id);
  if (pairStatus === "approved") {
    const land = latestByOutcome.get("land");
    if (land) await supabase.from("move_media_assets").update({ published_at: reviewedAt }).eq("id", land.id);
  }
  return { demo: false, assetId, decision, pairStatus };
}
