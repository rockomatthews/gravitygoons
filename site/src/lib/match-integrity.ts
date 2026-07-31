import { createHash } from "node:crypto";

export function seedCommitment(seed: string): `0x${string}` {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}
