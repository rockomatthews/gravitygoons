import "server-only";

import { Seaport } from "@opensea/seaport-js";
import { JsonRpcProvider } from "ethers";
import { getAddress, isAddress } from "viem";
import { baseRpcUrl, collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const SEAPORT_16_ADDRESS = "0x0000000000000068F116a894984e2DB1123eB395";
const NATIVE = ZERO_ADDRESS;
const ORDER_TYPES = {
  OrderComponents: [
    { name: "offerer", type: "address" }, { name: "zone", type: "address" }, { name: "offer", type: "OfferItem[]" },
    { name: "consideration", type: "ConsiderationItem[]" }, { name: "orderType", type: "uint8" }, { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" }, { name: "zoneHash", type: "bytes32" }, { name: "salt", type: "uint256" },
    { name: "conduitKey", type: "bytes32" }, { name: "counter", type: "uint256" },
  ],
  OfferItem: [
    { name: "itemType", type: "uint8" }, { name: "token", type: "address" }, { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" }, { name: "endAmount", type: "uint256" },
  ],
  ConsiderationItem: [
    { name: "itemType", type: "uint8" }, { name: "token", type: "address" }, { name: "identifierOrCriteria", type: "uint256" },
    { name: "startAmount", type: "uint256" }, { name: "endAmount", type: "uint256" }, { name: "recipient", type: "address" },
  ],
} as const;

type RawOrder = { parameters: Record<string, unknown> & { offer?: Array<Record<string, unknown>>; consideration?: Array<Record<string, unknown>> }; signature?: string };
const ethersProvider = new JsonRpcProvider(baseRpcUrl, 8453, { staticNetwork: true });
const seaport = new Seaport(ethersProvider as never, { overrides: { seaportVersion: "1.6", contractAddress: SEAPORT_16_ADDRESS } });

function bigint(value: unknown, field: string) {
  try { return BigInt(String(value)); } catch { throw new Error(`Invalid Seaport ${field}.`); }
}
function address(value: unknown, field: string) {
  if (typeof value !== "string" || !isAddress(value)) throw new Error(`Invalid Seaport ${field}.`);
  return getAddress(value);
}

function typedOrder(parameters: RawOrder["parameters"]) {
  return {
    offerer: address(parameters.offerer, "offerer"), zone: address(parameters.zone, "zone"),
    offer: (parameters.offer ?? []).map((item) => ({ itemType: Number(item.itemType), token: address(item.token, "offer token"), identifierOrCriteria: bigint(item.identifierOrCriteria, "offer identifier"), startAmount: bigint(item.startAmount, "offer amount"), endAmount: bigint(item.endAmount, "offer amount") })),
    consideration: (parameters.consideration ?? []).map((item) => ({ itemType: Number(item.itemType), token: address(item.token, "payment token"), identifierOrCriteria: bigint(item.identifierOrCriteria, "payment identifier"), startAmount: bigint(item.startAmount, "payment amount"), endAmount: bigint(item.endAmount, "payment amount"), recipient: address(item.recipient, "payment recipient") })),
    orderType: Number(parameters.orderType), startTime: bigint(parameters.startTime, "start time"), endTime: bigint(parameters.endTime, "end time"),
    zoneHash: String(parameters.zoneHash) as `0x${string}`, salt: bigint(parameters.salt, "salt"), conduitKey: String(parameters.conduitKey) as `0x${string}`, counter: bigint(parameters.counter, "counter"),
  };
}

export async function createSeaportListing(wallet: string, input: { tokenId: number; currency: "ETH" | "USDC"; priceMinor: string; order: RawOrder }) {
  if (process.env.SEAPORT_LISTINGS_ENABLED !== "true") throw new Error("Seaport listing creation is not enabled.");
  const supabase = getSupabaseAdmin();
  if (!supabase || collectionAddress === ZERO_ADDRESS) throw new Error("Listing storage or collection is not configured.");
  const normalized = getAddress(wallet);
  const tokenId = Number(input.tokenId);
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000) throw new Error("Unknown Goon.");
  const currentOwner = getAddress(await publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "ownerOf", args: [BigInt(tokenId)] }));
  if (currentOwner !== normalized) throw new Error("The connected wallet no longer owns this Goon.");
  const order = input.order;
  if (!order?.parameters || typeof order.signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(order.signature)) throw new Error("Missing signed Seaport order.");
  const parameters = typedOrder(order.parameters);
  if (parameters.offerer !== normalized || parameters.zone !== ZERO_ADDRESS || parameters.orderType !== 0) throw new Error("Only open fixed-price owner listings are accepted.");
  if (parameters.offer.length !== 1) throw new Error("A listing must offer exactly one Goon.");
  const offered = parameters.offer[0];
  if (offered.itemType !== 2 || offered.token !== getAddress(collectionAddress) || offered.identifierOrCriteria !== BigInt(tokenId) || offered.startAmount !== 1n || offered.endAmount !== 1n) throw new Error("The signed order does not offer this exact Goon.");
  const startsAt = Number(parameters.startTime) * 1000;
  const expiresAt = Number(parameters.endTime) * 1000;
  if (startsAt > Date.now() + 5 * 60_000 || expiresAt <= Date.now() || expiresAt - startsAt > 31 * 24 * 60 * 60_000) throw new Error("Listing duration must be active and no longer than 30 days.");
  const currency = input.currency;
  const paymentToken = currency === "ETH" ? getAddress(NATIVE) : address(process.env.BASE_USDC_ADDRESS ?? process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS, "Base USDC address");
  const expectedType = currency === "ETH" ? 0 : 1;
  if (!parameters.consideration.length || parameters.consideration.some((item) => item.itemType !== expectedType || item.token !== paymentToken || item.startAmount !== item.endAmount || item.identifierOrCriteria !== 0n)) throw new Error("All consideration must use the selected fixed-price currency.");
  const total = parameters.consideration.reduce((sum, item) => sum + item.startAmount, 0n);
  if (total !== bigint(input.priceMinor, "price")) throw new Error("The displayed price does not match the signed order total.");
  const [royaltyRecipient, royaltyAmount] = await publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "royaltyInfo", args: [BigInt(tokenId), total] });
  const receiver = getAddress(royaltyRecipient);
  const byRecipient = new Map<string, bigint>();
  for (const item of parameters.consideration) byRecipient.set(item.recipient, (byRecipient.get(item.recipient) ?? 0n) + item.startAmount);
  if ((byRecipient.get(receiver) ?? 0n) < royaltyAmount) throw new Error("The order does not include the collection royalty.");
  const allowedRecipients = new Set([normalized, receiver]);
  if (parameters.consideration.some((item) => !allowedRecipients.has(item.recipient))) throw new Error("Gravity Goons listings cannot add hidden marketplace recipients.");
  if ((byRecipient.get(normalized) ?? 0n) < total - royaltyAmount) throw new Error("Seller proceeds do not match the listed price.");
  const signatureValid = await publicClient.verifyTypedData({
    address: normalized, domain: { name: "Seaport", version: "1.6", chainId: 8453, verifyingContract: SEAPORT_16_ADDRESS },
    types: ORDER_TYPES, primaryType: "OrderComponents", message: parameters, signature: order.signature as `0x${string}`,
  });
  if (!signatureValid) throw new Error("Invalid Seaport order signature.");
  const orderHash = seaport.getOrderHash(order.parameters as never).toLowerCase();
  const status = await seaport.getOrderStatus(orderHash);
  if (status.isCancelled || status.totalFilled > 0n) throw new Error("This Seaport order is already unavailable.");
  const { data, error } = await supabase.from("seaport_listings").insert({
    protocol_address: SEAPORT_16_ADDRESS.toLowerCase(), order_hash: orderHash, token_id: tokenId,
    offerer_wallet: wallet.toLowerCase(), payment_token: paymentToken.toLowerCase(), currency,
    price_minor: total.toString(), royalty_recipient: receiver.toLowerCase(), royalty_minor: royaltyAmount.toString(),
    order_payload: order, starts_at: new Date(startsAt).toISOString(), expires_at: new Date(expiresAt).toISOString(),
  }).select("id,order_hash,token_id,currency,price_minor,status,expires_at").single();
  if (error) throw new Error(error.code === "23505" ? "This Goon already has an active listing. Cancel it before creating another." : error.message);
  return data;
}

export async function listSeaportListings(tokenId?: number, includeOrder = false) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const now = new Date().toISOString();
  let query = supabase.from("seaport_listings").select(includeOrder ? "*" : "id,order_hash,token_id,offerer_wallet,currency,price_minor,status,expires_at").eq("status", "active").lte("starts_at", now).gt("expires_at", now).order("created_at", { ascending: false });
  if (tokenId) query = query.eq("token_id", tokenId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSeaportListing(id: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Listing storage is not configured.");
  const { data, error } = await supabase.from("seaport_listings").select("*").eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Listing not found.");
  return data;
}

export async function syncSeaportListing(id: string, transactionHash?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Listing storage is not configured.");
  const listing = await getSeaportListing(id);
  const status = await seaport.getOrderStatus(listing.order_hash);
  let next = listing.status;
  if (status.isCancelled) next = "cancelled";
  else if (status.totalFilled > 0n) next = "fulfilled";
  else if (Date.parse(listing.expires_at) <= Date.now()) next = "expired";
  else {
    const owner = getAddress(await publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "ownerOf", args: [BigInt(listing.token_id)] }));
    if (owner.toLowerCase() !== listing.offerer_wallet) next = "invalid";
  }
  const updates: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };
  if (transactionHash && /^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
    if (next === "fulfilled") updates.fulfillment_tx_hash = transactionHash;
    if (next === "cancelled") updates.cancellation_tx_hash = transactionHash;
  }
  const { data, error } = await supabase.from("seaport_listings").update(updates).eq("id", id).select("id,token_id,status").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function syncActiveSeaportListings(limit = 20) {
  const listings = await listSeaportListings(undefined, true) as unknown as Array<{ id: string }>;
  const results = [];
  for (const listing of listings.slice(0, limit)) {
    try { results.push(await syncSeaportListing(listing.id)); }
    catch (error) { results.push({ id: listing.id, error: error instanceof Error ? error.message : "sync failed" }); }
  }
  return results;
}
