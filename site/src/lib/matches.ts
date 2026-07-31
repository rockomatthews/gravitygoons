import { randomBytes } from "node:crypto";
import collection from "@/data/collection.json";
import { verifyTokenOwnership } from "@/lib/profile-data";
import {
  DISCIPLINE_WORDS, TRICK_CATALOG, addTrickUse, matchIsOver, resolveSetterAttempt,
  resolveSkateTurn, type Athlete, type CallMode, type Discipline, type TrickHistory,
} from "@/lib/pvp";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { seedCommitment } from "@/lib/match-integrity";

type MatchState = {
  firstLosses: number;
  secondLosses: number;
  setterTokenId: number;
  previousTrick: string | null;
  practice: Record<string, TrickHistory>;
  grit: Record<string, number>;
  pendingCall?: { trickId: number; seed: string; setterTokenId: number };
  letterlessTurns?: number;
};

function athlete(tokenId: number): Athlete {
  const token = collection.tokens[tokenId - 1];
  return {
    tokenId, name: token.name, discipline: token.discipline as Discipline,
    rarity: token.rarity as Athlete["rarity"], trickSpecialty: token.trick_specialty,
    stats: token.stats as Athlete["stats"],
  };
}

export async function getMatch(wallet: string, matchId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Match storage is not configured.");
  const { data, error } = await supabase.from("pvp_matches").select("id,status,discipline,match_word,first_token_id,second_token_id,first_wallet_address,second_wallet_address,winner_token_id,loser_token_id,next_turn_number,state,action_deadline,started_at,completed_at").eq("id", matchId).single();
  if (error || !data) throw new Error("Match not found.");
  if (![data.first_wallet_address, data.second_wallet_address].includes(wallet.toLowerCase())) throw new Error("This match belongs to different wallets.");
  const { data: actions } = await supabase.from("pvp_match_actions").select("turn_number,action_type,result_payload,created_at").eq("match_id", matchId).order("turn_number");
  const state = data.state as MatchState;
  return { ...data, state: { ...state, pendingCall: state.pendingCall ? { trickId: state.pendingCall.trickId, setterTokenId: state.pendingCall.setterTokenId } : undefined }, actions: actions ?? [] };
}

export async function processMatchAction(wallet: string, matchId: string, input: { turnNumber: number; idempotencyKey: string; action: "call_trick" | "answer_trick"; trickId?: number; callMode?: CallMode; useGrit?: boolean }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Match storage is not configured.");
  if (!/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)) throw new Error("A UUID idempotency key is required.");
  const { data: match, error } = await supabase.from("pvp_matches").select("*").eq("id", matchId).single();
  if (error || !match) throw new Error("Match not found.");
  if (match.status !== "matched") throw new Error("Match is not accepting actions.");
  if (match.next_turn_number !== input.turnNumber) throw new Error(`Stale turn. Expected ${match.next_turn_number}.`);
  const state = match.state as MatchState;
  const first = athlete(match.first_token_id);
  const second = athlete(match.second_token_id);
  const setter = state.setterTokenId === first.tokenId ? first : second;
  const responder = setter.tokenId === first.tokenId ? second : first;
  const setterWallet = setter.tokenId === first.tokenId ? match.first_wallet_address : match.second_wallet_address;
  const responderWallet = responder.tokenId === first.tokenId ? match.first_wallet_address : match.second_wallet_address;
  const actorTokenId = input.action === "call_trick" ? setter.tokenId : responder.tokenId;
  const expectedWallet = input.action === "call_trick" ? setterWallet : responderWallet;
  if (expectedWallet !== wallet.toLowerCase()) throw new Error("It is not your turn.");
  if (!await verifyTokenOwnership(wallet, actorTokenId)) throw new Error("Live ownership changed; match is paused.");
  const catalogue = TRICK_CATALOG[setter.discipline];
  const seed = randomBytes(32).toString("hex");
  let result: Record<string, unknown>;
  const nextState: MatchState = structuredClone(state);

  if (input.action === "call_trick") {
    if (state.pendingCall) throw new Error("The responder must answer the current call.");
    const trick = catalogue[input.trickId ?? -1];
    if (!trick) throw new Error("Unknown trick.");
    const choice = { setter, responder, trick, setterCatalogue: catalogue, responderCatalogue: TRICK_CATALOG[responder.discipline], responderPractice: state.practice[responder.tokenId] ?? {}, previousSetTrickName: state.previousTrick, callMode: input.callMode ?? "standard", letterlessTurns: state.letterlessTurns ?? 0 };
    const attempt = resolveSetterAttempt(choice, seed);
    result = { action: "call_trick", attempt, seedCommit: seedCommitment(seed) };
    nextState.previousTrick = trick.name;
    if (attempt.landed) nextState.pendingCall = { trickId: trick.id, seed, setterTokenId: setter.tokenId };
    else { nextState.setterTokenId = responder.tokenId; nextState.letterlessTurns = (state.letterlessTurns ?? 0) + 1; }
  } else {
    if (!state.pendingCall) throw new Error("There is no called trick to answer.");
    const trick = catalogue[state.pendingCall.trickId];
    const usesGrit = Boolean(input.useGrit && (state.grit[responder.tokenId] ?? 0) > 0);
    const turn = resolveSkateTurn({
      setter, responder, trick, setterCatalogue: catalogue, responderCatalogue: TRICK_CATALOG[responder.discipline],
      responderPractice: state.practice[responder.tokenId] ?? {}, previousSetTrickName: null,
      callMode: input.callMode ?? "standard", responderUsesGrit: usesGrit, letterlessTurns: state.letterlessTurns ?? 0,
    }, state.pendingCall.seed);
    result = { action: "answer_trick", turn, seedReveal: state.pendingCall.seed };
    nextState.pendingCall = undefined;
    nextState.setterTokenId = turn.nextSetterTokenId;
    nextState.practice[responder.tokenId] = addTrickUse(state.practice[responder.tokenId] ?? {}, trick.name);
    if (usesGrit) nextState.grit[responder.tokenId] = (state.grit[responder.tokenId] ?? 0) - 1;
    if (turn.letterRecipientTokenId === first.tokenId) nextState.firstLosses += 1;
    if (turn.letterRecipientTokenId === second.tokenId) nextState.secondLosses += 1;
    nextState.letterlessTurns = turn.letterRecipientTokenId ? 0 : (state.letterlessTurns ?? 0) + 1;
  }

  const word = DISCIPLINE_WORDS[first.discipline];
  let winnerTokenId: number | null = null;
  let loserTokenId: number | null = null;
  if (matchIsOver(first.discipline, nextState.firstLosses) || matchIsOver(first.discipline, nextState.secondLosses)) {
    winnerTokenId = nextState.firstLosses >= word.length ? second.tokenId : first.tokenId;
    loserTokenId = winnerTokenId === first.tokenId ? second.tokenId : first.tokenId;
    result = { ...result, matchComplete: true, winnerTokenId, loserTokenId };
  }
  const { data: committed, error: commitError } = await supabase.rpc("commit_pvp_match_action", {
    p_match_id: matchId,
    p_wallet_address: wallet.toLowerCase(),
    p_turn_number: input.turnNumber,
    p_idempotency_key: input.idempotencyKey,
    p_action_type: input.action,
    p_request_payload: input,
    p_result_payload: result,
    p_next_state: nextState,
    p_winner_token_id: winnerTokenId,
    p_loser_token_id: loserTokenId,
  });
  if (commitError) throw new Error(commitError.message);
  return committed as Record<string, unknown>;
}
