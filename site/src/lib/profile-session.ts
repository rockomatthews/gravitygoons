import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, verifyMessage, verifyTypedData } from "viem";
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

const PROFILE_SIGN_IN_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
  ],
  SignIn: [
    { name: "wallet", type: "address" },
    { name: "nonce", type: "string" },
    { name: "domain", type: "string" },
    { name: "uri", type: "string" },
    { name: "issuedAt", type: "uint256" },
    { name: "expirationTime", type: "uint256" },
  ],
} as const;

export type ProfileSignInTypedData = ReturnType<typeof profileTypedData>;

export function signatureByteLength(signature: unknown): number | null {
  if (typeof signature !== "string" || !/^0x(?:[0-9a-fA-F]{2})+$/.test(signature)) return null;
  return (signature.length - 2) / 2;
}

export async function verifyWithSmartAccountFallback(input: {
  signature: unknown;
  verifyEoa: () => Promise<boolean>;
  verifySmartAccount: () => Promise<boolean>;
}): Promise<boolean> {
  const byteLength = signatureByteLength(input.signature);
  if (byteLength === null) return false;
  // Viem's utility verifier is EOA-only and expects a standard 65-byte
  // signature. Base smart accounts may return ERC-6492-wrapped signatures of
  // a different length, which must go directly to the Public Client action.
  if (byteLength === 65) {
    const eoaValid = await input.verifyEoa().catch(() => false);
    if (eoaValid) return true;
  }
  return input.verifySmartAccount().catch(() => false);
}

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

export function createSignInChallenge(address: string): { message: string; nonce: string; typedData: ProfileSignInTypedData; token: string; expiresAt: number } {
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
  return { message: challengeMessage(payload), nonce: payload.nonce!, typedData: profileTypedData(payload), token: encode(payload), expiresAt };
}

function profileTypedData(payload: SignedPayload) {
  return {
    domain: { name: "Gravity Goons", version: "1", chainId: BigInt(payload.chainId ?? 8453) },
    types: PROFILE_SIGN_IN_TYPES,
    primaryType: "SignIn" as const,
    message: {
      wallet: getAddress(payload.address),
      nonce: payload.nonce ?? "",
      domain: payload.domain ?? "gravitygoons.com",
      uri: payload.uri ?? "https://gravitygoons.com",
      issuedAt: BigInt(payload.issuedAt),
      expirationTime: BigInt(payload.expiresAt),
    },
  };
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

export async function verifyChallenge(token: string | undefined, address: string, signature: `0x${string}`, method: "message" | "typed_data" = "message"): Promise<string | null> {
  const payload = decode(token);
  if (!payload?.nonce) return null;
  const normalized = normalizeWallet(address);
  if (payload.address !== normalized) return null;
  let valid: boolean;
  if (method === "typed_data") {
    const typedData = profileTypedData(payload);
    valid = await verifyWithSmartAccountFallback({
      signature,
      verifyEoa: () => verifyTypedData({ address: getAddress(address), ...typedData, signature }),
      verifySmartAccount: () => publicClient.verifyTypedData({ address: getAddress(address), ...typedData, signature }),
    });
  } else {
    const message = challengeMessage(payload);
    valid = await verifyWithSmartAccountFallback({
      signature,
      verifyEoa: () => verifyMessage({ address: getAddress(address), message, signature }),
      verifySmartAccount: () => publicClient.verifyMessage({ address: getAddress(address), message, signature }),
    });
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
