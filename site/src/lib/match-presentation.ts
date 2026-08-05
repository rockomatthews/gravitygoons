export type MatchAttempt = {
  tokenId: number;
  landed: boolean;
  chance: number;
  role: "setter" | "responder";
  trick: { id: number; name: string; difficulty: number };
};

export type MatchTurnResult = {
  trick: { id: number; name: string; difficulty: number };
  setterTokenId: number;
  responderTokenId: number;
  attempts: [MatchAttempt, MatchAttempt | null];
  nextSetterTokenId: number;
  letterRecipientTokenId: number | null;
  reason: "setter-missed" | "responder-landed" | "responder-missed";
};

export type MoveOutcomeVisual = {
  tokenId: number;
  trickId: number;
  outcome: "land" | "fall";
  videoUrl: string;
  posterUrl: string | null;
};

export type MatchActionPresentation = { attempts: MoveOutcomeVisual[] };

export function turnFromPayload(payload: Record<string, unknown>): MatchTurnResult | null {
  const turn = payload.turn;
  if (!turn || typeof turn !== "object") return null;
  const candidate = turn as Partial<MatchTurnResult>;
  if (!candidate.trick || !Array.isArray(candidate.attempts) || typeof candidate.setterTokenId !== "number") return null;
  return candidate as MatchTurnResult;
}

export function turnExplanation(turn: MatchTurnResult): string {
  if (turn.reason === "setter-missed") return `#${padToken(turn.setterTokenId)} fell. No response was required. #${padToken(turn.nextSetterTokenId)} gets the next turn.`;
  if (turn.reason === "responder-landed") return `Both Goons landed it. No letter. #${padToken(turn.nextSetterTokenId)} gets the next turn.`;
  return `#${padToken(turn.responderTokenId)} fell and takes a letter. #${padToken(turn.nextSetterTokenId)} keeps the turn.`;
}

export function padToken(tokenId: number): string {
  return String(tokenId).padStart(4, "0");
}
