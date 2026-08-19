import { createHmac, timingSafeEqual } from "node:crypto";
import { allMoveMotionReferences } from "./move-reference-catalog.ts";

const ACCESS_TTL_SECONDS = 60 * 60;

function accessSecret(): string | null {
  return process.env.SEEVIO_WEBHOOK_SECRET ?? null;
}

function signatureFor(expiresAt: number, objectPath: string, secret: string): string {
  return createHmac("sha256", secret).update(`${expiresAt}:${objectPath}`).digest("base64url");
}

export function moveReferenceSlug(objectPath: string): string {
  return objectPath.split("/").at(-1) ?? "";
}

export function moveReferenceObjectPathForSlug(slug: string): string | null {
  return allMoveMotionReferences().find((reference) => moveReferenceSlug(reference.objectPath) === slug)?.objectPath ?? null;
}

export function createMoveReferenceAccessUrl(objectPath: string, nowMs = Date.now()): string | null {
  const secret = accessSecret();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const slug = moveReferenceSlug(objectPath);
  if (!secret || !siteUrl?.startsWith("https://") || moveReferenceObjectPathForSlug(slug) !== objectPath) return null;
  const expiresAt = Math.floor(nowMs / 1000) + ACCESS_TTL_SECONDS;
  const signature = signatureFor(expiresAt, objectPath, secret);
  return `${siteUrl}/api/moves/reference/${expiresAt}.${signature}/${encodeURIComponent(slug)}`;
}

export function verifyMoveReferenceAccess(token: string, slug: string, nowMs = Date.now()): string | null {
  const secret = accessSecret();
  const objectPath = moveReferenceObjectPathForSlug(slug);
  const separator = token.indexOf(".");
  if (!secret || !objectPath || separator < 1) return null;
  const expiresAt = Number(token.slice(0, separator));
  const supplied = token.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(nowMs / 1000) || !supplied) return null;
  const expected = signatureFor(expiresAt, objectPath, secret);
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return null;
  return objectPath;
}

export type ByteRange = { start: number; end: number };

export function parseSingleByteRange(value: string | null, size: number): ByteRange | null | "invalid" {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || size <= 0) return "invalid";
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return "invalid";
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return "invalid";
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return "invalid";
  return { start, end: Math.min(end, size - 1) };
}
