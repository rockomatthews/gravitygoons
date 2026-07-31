import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, verifyMessage } from "viem";
import { publicClient } from "./contracts.ts";

export const NONCE_COOKIE = "gg_profile_nonce";
export const SESSION_COOKIE = "gg_profile_session";

type SignedPayload = {
  address: string;
  nonce?: string;
  domain?: string;
  uri?: string;
  chainId?: number;
  issuedAt: number;
  expiresAt: number;
};

function sessionSecret(): string {
  const configured = process.env.PROFILE_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("PROFILE_SESSION_SECRET is required in production.");
  return "gravity-goons-local-profile-session-only";
}

function sign(encoded: string): string {
  return createHmac("sha256", sessionSecret()).update(encoded).digest("base64url");
}

function encode(payload: SignedPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function decode(token: string | undefined): SignedPayload | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SignedPayload;
    if (!payload.address || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function normalizeWallet(address: string): `0x${string}` {
  return getAddress(address).toLowerCase() as `0x${string}`;
}

export function createSignInChallenge(address: string): { message: string; token: string; expiresAt: number } {
  const normalized = normalizeWallet(address);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 10 * 60 * 1000;
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  const payload: SignedPayload = {
    address: normalized,
    nonce: randomBytes(16).toString("hex"),
    domain: siteUrl.host,
    uri: siteUrl.origin,
    chainId: 8453,
    issuedAt,
    expiresAt,
  };
  return { message: challengeMessage(payload), token: encode(payload), expiresAt };
}

function challengeMessage(payload: SignedPayload): string {
  return [
    `${payload.domain ?? "gravitygoons.com"} wants you to sign in with your Ethereum account:`,
    getAddress(payload.address),
    "",
    "Sign in to Gravity Goons. This signature proves wallet ownership and cannot spend funds.",
    "",
    `URI: ${payload.uri ?? "https://gravitygoons.com"}`,
    "Version: 1",
    `Chain ID: ${payload.chainId ?? 8453}`,
    `Nonce: ${payload.nonce ?? ""}`,
    `Issued At: ${new Date(payload.issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(payload.expiresAt).toISOString()}`,
  ].join("\n");
}

export async function verifyChallenge(token: string | undefined, address: string, signature: `0x${string}`): Promise<string | null> {
  const payload = decode(token);
  if (!payload?.nonce) return null;
  const normalized = normalizeWallet(address);
  if (payload.address !== normalized) return null;
  const message = challengeMessage(payload);
  let valid = await verifyMessage({ address: getAddress(address), message, signature });
  if (!valid) {
    valid = await publicClient.verifyMessage({ address: getAddress(address), message, signature }).catch(() => false);
  }
  return valid ? normalized : null;
}

export function createSessionToken(address: string): string {
  const issuedAt = Date.now();
  return encode({ address: normalizeWallet(address), issuedAt, expiresAt: issuedAt + 7 * 24 * 60 * 60 * 1000 });
}

export function readSessionAddress(token: string | undefined): string | null {
  return decode(token)?.address ?? null;
}
