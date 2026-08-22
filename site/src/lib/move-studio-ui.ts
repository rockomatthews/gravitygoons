import type { MovePairStatus, OutcomeStatus, StudioMove } from "@/lib/profile-types";

export const REROLL_NOTE_MAX_LENGTH = 500;

export function rerollNoteError(note: unknown): string | null {
  if (typeof note !== "string" || note.trim().length < 5) return "Describe what needs to change in at least 5 characters.";
  if (note.trim().length > REROLL_NOTE_MAX_LENGTH) return `Keep the reroll note under ${REROLL_NOTE_MAX_LENGTH} characters.`;
  return null;
}

export type MoveWorkflowProgress = {
  percent: number;
  label: string;
  detail: string;
  active: boolean;
  paused: boolean;
};

export function isMoveWorkflowActive(status: MovePairStatus): boolean {
  return status === "paid" || status === "queued" || status === "generating" || status === "rerolling";
}

function outcomeProgress(status: OutcomeStatus): number {
  switch (status) {
    case "queued": return 25;
    case "generating": return 55;
    case "failed": return 40;
    case "owner_review":
    case "rejected": return 90;
    case "approved":
    case "unpublished": return 100;
    default: return 0;
  }
}

export function moveWorkflowProgress(move: Pick<StudioMove, "pairStatus" | "outcomes">): MoveWorkflowProgress {
  const latest = (["land", "fall"] as const).map((outcome) =>
    move.outcomes.filter((asset) => asset.outcome === outcome).sort((a, b) => b.version - a.version)[0],
  );
  if (move.pairStatus === "approved" || move.pairStatus === "unpublished") return { percent: 100, label: "Movies complete", detail: "The LAND and FALL pair is complete.", active: false, paused: false };
  if (move.pairStatus === "owner_review" || latest.every((asset) => asset?.status === "owner_review" || asset?.status === "approved")) return { percent: 90, label: "Ready for your review", detail: "Generation is finished. Review both outcomes below.", active: false, paused: false };
  if (move.pairStatus === "failed") return { percent: Math.max(30, Math.round(latest.reduce((sum, asset) => sum + outcomeProgress(asset?.status ?? "missing"), 0) / 2)), label: "Generation paused", detail: "Your payment is recorded. Retry generation without paying again.", active: false, paused: true };
  if (move.pairStatus === "paid") return { percent: 15, label: "Payment confirmed", detail: "The server is preparing the LAND and FALL jobs.", active: true, paused: false };
  if (move.pairStatus === "queued") return { percent: 25, label: "Jobs queued", detail: "The LAND and FALL jobs are waiting for Seevio.", active: true, paused: false };
  if (move.pairStatus === "generating" || move.pairStatus === "rerolling") {
    const percent = Math.max(35, Math.min(85, Math.round(latest.reduce((sum, asset) => sum + outcomeProgress(asset?.status ?? "missing"), 0) / 2)));
    return { percent, label: move.pairStatus === "rerolling" ? "Reroll rendering" : "Movies rendering", detail: "Seevio is processing the LAND and FALL outcomes independently.", active: true, paused: false };
  }
  return { percent: 0, label: "Not started", detail: "No paid movie workflow is running.", active: false, paused: false };
}

export function isMovePurchasable(status: MovePairStatus): boolean {
  return status === "no_movie" || status === "quoted" || status === "rejected";
}

export function isMoveGenerationRetryable(status: MovePairStatus): boolean {
  return status === "paid" || status === "queued" || status === "failed";
}

export function moveStudioActionLabel(status: MovePairStatus, selected: boolean): string {
  if (isMoveGenerationRetryable(status)) return "RETRY GENERATION — NO CHARGE";
  if (status === "approved" || status === "unpublished") return "MOVIES COMPLETE";
  if (status === "owner_review") return "REVIEW MOVIES ABOVE";
  if (!isMovePurchasable(status)) return "WORKFLOW IN PROGRESS";
  if (status === "rejected") return "SELECT THIS TRICK";
  if (status === "quoted") return "REVIEW / PAY";
  return selected ? "SELECTED" : "SELECT THIS TRICK";
}

export function moveWorkflowLabel(status: MovePairStatus): string {
  switch (status) {
    case "no_movie": return "NOT MADE";
    case "quoted": return "PAYMENT NOT SENT";
    case "paid": return "PAID · READY TO RETRY";
    case "queued": return "QUEUED · NO NEW PAYMENT";
    case "failed": return "RETRY NEEDED · PAID";
    case "rejected": return "REJECTED · AVAILABLE TO BUY AGAIN";
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
