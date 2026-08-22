import { decodeEventLog, parseAbiItem } from "viem";
import { collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { goonImageUrl } from "@/lib/goon-images";
import { formatUsdc, getProfileForWallet, tokenDisciplineIndex, tokenMove, verifyTokenOwnership } from "@/lib/profile-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { publicSeevioFailureMessage, seevioConfigured, seevioModelFor, submitSeevioJob } from "@/lib/seevio-server";
import { movePromptFor, moveRerollPromptFor } from "@/lib/move-prompts";
import { signedMoveMotionReference } from "@/lib/move-reference-server";

const CHAIN_ID = 8453;
const BASE_USDC = (process.env.BASE_USDC_ADDRESS ?? "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913").toLowerCase();
const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

type PairRow = { id: string; token_id: number; trick_id: number; status: string; commissioned_by_wallet: string };
type OrderRow = { id: string; pair_id: string; payer_wallet_address: string; amount_minor_units: number | string; status: string; quote_expires_at: string; payment_tx_hash: string | null };
type AssetRow = { id: string; pair_id: string; outcome: "land" | "fall"; version: number; status: string; source_image_url: string; prompt: string; provider_job_id: string | null; moderation_status: string; owner_decision: string };
type JobRow = { id: string; asset_id: string; idempotency_key: string; provider_job_id: string | null; status: string; attempt: number };

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
  return movePromptFor({ token, discipline: result.discipline, trickName: result.trick.name, outcome });
}

async function generationReferenceFor(tokenId: number, trickId: number) {
  const result = tokenMove(tokenId, trickId);
  if (!result.trick) return null;
  return signedMoveMotionReference(result.discipline, result.trick.name);
}

function providerRequestPayload(prompt: string, imageUrl: string, referenceObjectPath?: string) {
  return {
    model: seevioModelFor(Boolean(referenceObjectPath)),
    generation_type: referenceObjectPath ? "reference-to-video" : "image-to-video",
    prompt,
    image_urls: [imageUrl],
    ...(referenceObjectPath ? { reference_video_path: referenceObjectPath } : {}),
    aspect_ratio: "1:1",
    resolution: "720p",
    duration: 5,
  };
}

function quoteAmount(): number {
  const value = Number(process.env.MOVE_PAIR_PRICE_USDC_MINOR ?? 12_000_000);
  if (!Number.isInteger(value) || value <= 0) throw new Error("MOVE_PAIR_PRICE_USDC_MINOR must be a positive integer.");
  return value;
}

function includedRerollsPerOutcome(): number {
  const value = Number(process.env.MOVE_INCLUDED_REROLLS_PER_OUTCOME ?? 1);
  if (!Number.isInteger(value) || value < 0 || value > 9) throw new Error("MOVE_INCLUDED_REROLLS_PER_OUTCOME must be an integer from 0 through 9.");
  return value;
}

function assertProductionMovePurchaseReady(): void {
  if (process.env.MOVE_PAYMENT_MODE !== "live") throw new Error("Movie purchases are temporarily closed while the Seevio production connection is being verified. No payment was requested.");
  if (!seevioConfigured()) throw new Error("Movie purchases are temporarily closed until the Seevio API key and secure callback are configured. No payment was requested.");
  const treasury = process.env.MOVE_TREASURY_ADDRESS?.toLowerCase();
  const publicTreasury = process.env.NEXT_PUBLIC_MOVE_TREASURY_ADDRESS?.toLowerCase();
  if (!treasury || !publicTreasury || treasury !== publicTreasury) throw new Error("Movie purchases are temporarily closed because the Base USDC treasury configuration is incomplete. No payment was requested.");
}

export async function createMoveQuote(walletAddress: string, tokenId: number, trickId: number) {
  if (!(await verifyTokenOwnership(walletAddress, tokenId))) throw new Error("The connected wallet does not currently own this Goon.");
  const { trick } = tokenMove(tokenId, trickId);
  if (!trick) throw new Error("Move not found in this Goon's discipline.");
  const unlockDb=getSupabaseAdmin();
  if(!unlockDb)throw new Error("Move progression is temporarily unavailable.");
  const {data:progress}=await unlockDb.from("athlete_sponsor_progress").select("unlocked_trick_bitmap").eq("token_id",tokenId).maybeSingle();
  const bits=String(progress?.unlocked_trick_bitmap??"").replace(/[^01]/g,"").padStart(64,"0").slice(-64);
  if(trick.id>=4&&bits[63-trick.id]!=="1")throw new Error("This move must be permanently unlocked before its movie can be commissioned.");
  const amount = quoteAmount();
  const supabase = unlockDb;
  if (!supabase || collectionAddress === ZERO_ADDRESS) return { demo: true, orderId: "demo-order", pairId: "demo-pair", amountMinorUnits: amount, displayPrice: formatUsdc(amount), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
  assertProductionMovePurchaseReady();

  const wallet = walletAddress.toLowerCase();
  const profile = await getProfileForWallet(wallet);
  if (!profile) throw new Error("Create your Gravity Goons username profile before commissioning a movie.");
  const contract = collectionAddress.toLowerCase();
  const { data: existingData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status,commissioned_by_wallet").eq("chain_id", CHAIN_ID).eq("contract_address", contract).eq("token_id", tokenId).eq("catalog_version", 1).eq("trick_id", trickId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const existing = existingData as PairRow | null;
  if (existing && existing.status !== "rejected") {
    const { data: orderData } = await supabase.from("move_media_orders").select("id,pair_id,payer_wallet_address,amount_minor_units,status,quote_expires_at,payment_tx_hash").eq("pair_id", existing.id).maybeSingle();
    const order = orderData as OrderRow | null;
    const quoteExpired = order?.status === "expired" || (order?.status === "quoted" && new Date(order.quote_expires_at).getTime() < Date.now());
    if (order && !quoteExpired) return { demo: false, orderId: order.id, pairId: existing.id, amountMinorUnits: Number(order.amount_minor_units), displayPrice: formatUsdc(Number(order.amount_minor_units)), expiresAt: order.quote_expires_at, status: order.status };
    if (order && quoteExpired) {
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
  if (["generating", "owner_review", "approved", "rerolling", "rejected", "unpublished"].includes(pair.status)) {
    return { submitted: 0, configured: seevioConfigured() };
  }
  const sourceImageUrl = absoluteImageUrl(pair.token_id);
  const motionReference = await generationReferenceFor(pair.token_id, pair.trick_id);
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
  let active = 0;
  const failures: string[] = [];
  for (const asset of assets) {
    const requestPayload = providerRequestPayload(asset.prompt, asset.source_image_url, motionReference?.objectPath);
    const { data: latestJobData, error: latestJobError } = await supabase
      .from("move_generation_jobs")
      .select("id,asset_id,idempotency_key,provider_job_id,status,attempt")
      .eq("asset_id", asset.id)
      .order("attempt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestJobError) throw new Error(latestJobError.message);
    let job = latestJobData as JobRow | null;

    if (job && ["submitted", "processing", "succeeded"].includes(job.status)) {
      active += 1;
      continue;
    }

    const attempt = job && ["failed", "cancelled"].includes(job.status) ? job.attempt + 1 : job?.attempt ?? 1;
    if (attempt > 10) {
      failures.push(`${asset.outcome.toUpperCase()} exhausted its generation retry limit.`);
      continue;
    }
    if (!job || ["failed", "cancelled"].includes(job.status)) {
      const idempotencyKey = `${pair.id}:${asset.outcome}:v${asset.version}:attempt${attempt}`;
      const { data: insertedJob, error: insertJobError } = await supabase
        .from("move_generation_jobs")
        .insert({ asset_id: asset.id, idempotency_key: idempotencyKey, provider: "seevio", status: "queued", attempt, request_payload: requestPayload })
        .select("id,asset_id,idempotency_key,provider_job_id,status,attempt")
        .single();
      if (insertJobError && insertJobError.code !== "23505") throw new Error(insertJobError.message);
      if (insertedJob) {
        job = insertedJob as JobRow;
      } else {
        const { data: concurrentJob, error: concurrentJobError } = await supabase
          .from("move_generation_jobs")
          .select("id,asset_id,idempotency_key,provider_job_id,status,attempt")
          .eq("idempotency_key", idempotencyKey)
          .single();
        if (concurrentJobError) throw new Error(concurrentJobError.message);
        job = concurrentJob as JobRow;
      }
    }
    if (!job || job.status !== "queued" || !seevioConfigured()) continue;

    const idempotencyKey = job.idempotency_key;
    const { data: claimedJob } = await supabase.from("move_generation_jobs").update({ status: "processing", error_message: null }).eq("id", job.id).eq("status", "queued").select("id").maybeSingle();
    if (!claimedJob) continue;
    await supabase.from("move_media_assets").update({ status: "queued" }).eq("id", asset.id);
    let providerJobId: string | null;
    try {
      providerJobId = await submitSeevioJob({ prompt: asset.prompt, imageUrl: asset.source_image_url, idempotencyKey, referenceVideoUrl: motionReference?.signedUrl });
    } catch (error) {
      const providerMessage = error instanceof Error ? error.message : "Seevio submission failed.";
      await Promise.all([
        supabase.from("move_generation_jobs").update({ status: "failed", error_message: providerMessage }).eq("id", job.id),
        supabase.from("move_media_assets").update({ status: "failed" }).eq("id", asset.id),
      ]);
      console.error("move_generation_submit_failed", { pairId: pair.id, assetId: asset.id, outcome: asset.outcome, attempt: job.attempt, provider: "seevio", reason: providerMessage });
      failures.push(`${asset.outcome.toUpperCase()}: ${providerMessage}`);
      continue;
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
    active += 1;
  }
  if (failures.length > 0) {
    await supabase.from("move_media_pairs").update({ status: "failed" }).eq("id", pair.id);
    throw new Error(failures.join(" "));
  }
  await supabase.from("move_media_pairs").update({ status: active ? "generating" : "queued" }).eq("id", pair.id);
  return { submitted, configured: seevioConfigured() };
}

export async function confirmMovePayment(walletAddress: string, orderId: string, txHash: `0x${string}`) {
  const supabase = getSupabaseAdmin();
  if (!supabase || collectionAddress === ZERO_ADDRESS) return { demo: true, orderId, status: "confirmed", generation: "demo" };
  const { data: orderData } = await supabase.from("move_media_orders").select("id,pair_id,payer_wallet_address,amount_minor_units,status,quote_expires_at,payment_tx_hash").eq("id", orderId).maybeSingle();
  const order = orderData as OrderRow | null;
  if (!order || order.payer_wallet_address !== walletAddress.toLowerCase()) throw new Error("Move order not found for this wallet.");
  if (order.status === "confirmed") {
    const { data: confirmedPairData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status,commissioned_by_wallet").eq("id", order.pair_id).single();
    try {
      const generation = await enqueuePair(confirmedPairData as PairRow);
      return { demo: false, orderId, pairId: order.pair_id, status: "confirmed", generation };
    } catch (error) {
      return { demo: false, orderId, pairId: order.pair_id, status: "confirmed", generation: { retryRequired: true, message: publicSeevioFailureMessage(error) } };
    }
  }
  await verifyUsdcTransfer(order, txHash);
  const { data: pairData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status,commissioned_by_wallet").eq("id", order.pair_id).single();
  const pair = pairData as PairRow;
  if (!(await verifyTokenOwnership(walletAddress, pair.token_id))) throw new Error("Current NFT ownership could not be verified. Payment was not accepted.");
  await Promise.all([
    supabase.from("move_media_orders").update({ status: "confirmed", payment_tx_hash: txHash, paid_at: new Date().toISOString() }).eq("id", order.id),
    supabase.from("move_media_pairs").update({ status: "paid" }).eq("id", pair.id),
  ]);
  console.info("move_payment_confirmed", { orderId: order.id, pairId: pair.id, tokenId: pair.token_id, txHash });
  try {
    const submitted = await enqueuePair(pair);
    return { demo: false, orderId, pairId: pair.id, status: "confirmed", generation: submitted };
  } catch (error) {
    return { demo: false, orderId, pairId: pair.id, status: "confirmed", generation: { retryRequired: true, message: publicSeevioFailureMessage(error) } };
  }
}

export async function retryMoveGeneration(walletAddress: string, pairId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase || collectionAddress === ZERO_ADDRESS) return { demo: true, pairId, status: "confirmed", generation: "demo" };
  const { data: pairData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status,commissioned_by_wallet").eq("id", pairId).maybeSingle();
  const pair = pairData as PairRow | null;
  if (!pair || !(await verifyTokenOwnership(walletAddress, pair.token_id))) throw new Error("Paid movie workflow not found for the current NFT owner.");
  const { data: orderData } = await supabase.from("move_media_orders").select("id,pair_id,payer_wallet_address,amount_minor_units,status,quote_expires_at,payment_tx_hash").eq("pair_id", pair.id).maybeSingle();
  const order = orderData as OrderRow | null;
  if (!order || order.status !== "confirmed" || !order.payment_tx_hash) throw new Error("No confirmed payment exists for this movie workflow. No generation retry was started.");
  try {
    const generation = await enqueuePair(pair);
    console.info("move_generation_retried", { orderId: order.id, pairId: pair.id, tokenId: pair.token_id, submitted: generation.submitted });
    return { demo: false, orderId: order.id, pairId: pair.id, status: "confirmed", generation };
  } catch (error) {
    return { demo: false, orderId: order.id, pairId: pair.id, status: "confirmed", generation: { retryRequired: true, message: publicSeevioFailureMessage(error) } };
  }
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
  const canReview = asset.status === "owner_review";
  if (!canReview) throw new Error("This outcome is not currently awaiting owner review.");
  const reviewedAt = new Date().toISOString();

  if (decision === "reroll") {
    if (asset.version > includedRerollsPerOutcome()) throw new Error("This movie pair has used its included reroll for this outcome. Reject this draft or purchase an additional reroll when paid rerolls launch.");
    const nextVersion = asset.version + 1;
    const correctedBasePrompt = promptFor(pair.token_id, pair.trick_id, asset.outcome);
    const rerollPrompt = moveRerollPromptFor(correctedBasePrompt, note);
    const { data: nextData, error } = await supabase.from("move_media_assets").insert({ pair_id: pair.id, outcome: asset.outcome, version: nextVersion, status: "queued", source_image_url: asset.source_image_url, prompt: rerollPrompt }).select("id,pair_id,outcome,version,status,source_image_url,prompt,provider_job_id,moderation_status,owner_decision").single();
    if (error && error.code !== "23505") throw new Error(error.message);
    let nextAsset = nextData as AssetRow | null;
    if (!nextAsset) {
      const { data: existingAsset, error: existingAssetError } = await supabase.from("move_media_assets").select("id,pair_id,outcome,version,status,source_image_url,prompt,provider_job_id,moderation_status,owner_decision").eq("pair_id", pair.id).eq("outcome", asset.outcome).eq("version", nextVersion).single();
      if (existingAssetError) throw new Error(existingAssetError.message);
      nextAsset = existingAsset as AssetRow;
    }
    const idempotencyKey = `${pair.id}:${asset.outcome}:v${nextVersion}`;
    const motionReference = await generationReferenceFor(pair.token_id, pair.trick_id);
    const requestPayload = providerRequestPayload(rerollPrompt, asset.source_image_url, motionReference?.objectPath);
    const { data: jobData, error: jobError } = await supabase.from("move_generation_jobs").insert({ asset_id: nextAsset.id, idempotency_key: idempotencyKey, provider: "seevio", status: "queued", attempt: nextVersion, request_payload: requestPayload }).select("id,asset_id,idempotency_key,provider_job_id,status").single();
    if (jobError && jobError.code !== "23505") throw new Error(jobError.message);
    let job = jobData as JobRow | null;
    if (!job) {
      const { data: existingJob, error: existingJobError } = await supabase.from("move_generation_jobs").select("id,asset_id,idempotency_key,provider_job_id,status").eq("idempotency_key", idempotencyKey).single();
      if (existingJobError) throw new Error(existingJobError.message);
      job = existingJob as JobRow;
    }
    if (job.provider_job_id || ["submitted", "processing", "succeeded"].includes(job.status)) {
      await supabase.from("move_media_pairs").update({ status: job.status === "succeeded" ? "owner_review" : "rerolling" }).eq("id", pair.id);
      return { demo: false, assetId: nextAsset.id, decision, providerJobId: job.provider_job_id, existing: true };
    }
    const { data: claimedJob } = await supabase.from("move_generation_jobs").update({ status: "processing", error_message: null }).eq("id", job.id).in("status", ["queued", "failed"]).select("id").maybeSingle();
    if (!claimedJob) return { demo: false, assetId: nextAsset.id, decision, providerJobId: null, existing: true };
    let providerJobId: string | null;
    try {
      providerJobId = await submitSeevioJob({ prompt: rerollPrompt, imageUrl: asset.source_image_url, idempotencyKey, referenceVideoUrl: motionReference?.signedUrl });
    } catch (error) {
      const providerMessage = error instanceof Error ? error.message : "Seevio submission failed.";
      await Promise.all([
        supabase.from("move_generation_jobs").update({ status: "failed", error_message: providerMessage }).eq("id", job.id),
        supabase.from("move_media_assets").update({ status: "failed" }).eq("id", nextAsset.id),
        supabase.from("move_media_pairs").update({ status: "failed" }).eq("id", pair.id),
      ]);
      console.error("move_reroll_submit_failed", { pairId: pair.id, assetId: nextAsset.id, outcome: asset.outcome, reason: providerMessage });
      throw error;
    }
    if (providerJobId) {
      await Promise.all([
        supabase.from("move_generation_jobs").update({ provider_job_id: providerJobId, status: "submitted", submitted_at: reviewedAt }).eq("id", job.id),
        supabase.from("move_media_assets").update({ provider_job_id: providerJobId, status: "generating" }).eq("id", nextAsset.id),
      ]);
    }
    await supabase.from("move_media_reviews").insert({ asset_id: asset.id, reviewer_wallet_address: walletAddress.toLowerCase(), decision, note, ownership_verified_at: reviewedAt });
    await supabase.from("move_media_pairs").update({ status: "rerolling" }).eq("id", pair.id);
    return { demo: false, assetId: nextAsset.id, decision, providerJobId };
  }

  await supabase.from("move_media_reviews").insert({ asset_id: asset.id, reviewer_wallet_address: walletAddress.toLowerCase(), decision, note, ownership_verified_at: reviewedAt });

  // An approved LAND draft remains private until its matching FALL draft is
  // also approved. This prevents public profiles from advertising an
  // incomplete gameplay pair.
  await supabase.from("move_media_assets").update({
    owner_decision: decision,
    status: decision,
    moderation_status: decision === "approved" ? "passed" : "failed",
    reviewed_at: reviewedAt,
    published_at: null,
  }).eq("id", asset.id);
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
