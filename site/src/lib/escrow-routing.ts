import { getAddress, isAddress } from "viem";

export type EscrowReference = {
  escrow_address?: unknown;
  escrow_version?: unknown;
  correction_window_seconds?: unknown;
};

export function escrowRoute(reference: EscrowReference | null | undefined) {
  const rawAddress = reference?.escrow_address;
  if (typeof rawAddress !== "string" || !isAddress(rawAddress)) {
    return { address: null, version: null, correctionWindowSeconds: null } as const;
  }
  const rawWindow = Number(reference?.correction_window_seconds ?? 0);
  return {
    address: getAddress(rawAddress),
    version: typeof reference?.escrow_version === "string" ? reference.escrow_version : null,
    correctionWindowSeconds: Number.isSafeInteger(rawWindow) && rawWindow > 0 ? rawWindow : null,
  } as const;
}

export function correctionWindowLabel(seconds: number | null) {
  if (seconds === 600) return "10-minute result correction";
  if (seconds === 86400) return "24-hour dispute";
  return seconds ? `${seconds}-second correction` : "configured correction";
}
