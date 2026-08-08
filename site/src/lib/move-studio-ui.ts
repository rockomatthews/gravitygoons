import type { MovePairStatus } from "@/lib/profile-types";

export function isMovePurchasable(status: MovePairStatus): boolean {
  return status === "no_movie" || status === "quoted";
}

export function isMoveGenerationRetryable(status: MovePairStatus): boolean {
  return status === "paid" || status === "queued" || status === "failed";
}

export function moveWorkflowLabel(status: MovePairStatus): string {
  switch (status) {
    case "no_movie": return "NOT MADE";
    case "quoted": return "PAYMENT NOT SENT";
    case "paid": return "PAID · READY TO RETRY";
    case "queued": return "QUEUED · NO NEW PAYMENT";
    case "failed": return "RETRY NEEDED · PAID";
    default: return status.replaceAll("_", " ").toUpperCase();
  }
}

export function friendlyWalletPaymentError(error: unknown): string {
  const record = error && typeof error === "object" ? error as { code?: unknown; cause?: unknown; shortMessage?: unknown; message?: unknown } : null;
  const code = record?.code ?? (record?.cause && typeof record.cause === "object" ? (record.cause as { code?: unknown }).code : undefined);
  const text = [record?.shortMessage, record?.message, error].map(String).join(" ").toLowerCase();
  if (code === 4001 || code === "ACTION_REJECTED" || text.includes("user rejected") || text.includes("user denied")) {
    return "Payment cancelled in your wallet. No USDC was sent, and you can try again whenever you are ready.";
  }
  if (text.includes("insufficient funds") || text.includes("exceeds balance")) {
    return "This wallet does not have enough Base USDC for the $12 payment. No movie workflow was started.";
  }
  if (text.includes("wrong chain") || text.includes("chain mismatch") || text.includes("switch chain")) {
    return "Switch the paying wallet to Base Mainnet, then try again. No USDC was sent.";
  }
  return "The wallet did not complete the payment. No movie workflow was started. Reopen your wallet and try again.";
}

