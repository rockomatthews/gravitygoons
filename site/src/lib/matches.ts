import { randomBytes } from "node:crypto";
import collection from "@/data/collection.json";
import { verifyTokenOwnership } from "@/lib/profile-data";
import {
  DISCIPLINE_WORDS, TRICK_CATALOG, addTrickUse, matchIsOver, resolveSetterAttempt,
  resolveSkateTurn, type Athlete, type CallMode, type Discipline, type TrickHistory,
} from "@/lib/pvp";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

async function settleMatch(match: { id: string; discipline: number; first_token_id: number; first_wallet_address: string; second_wallet_address: string }, winnerTokenId: number, loserTokenId: number) {
  const supabase = getSupabaseAdmin()!;
  const completedAt = new Date().toISOString();
  const { data: completed } = await supabase.from("pvp_matches").update({
    status: "completed", winner_token_id: winnerTokenId, loser_token_id: loserTokenId, completed_at: completedAt, action_deadline: null,
  }).eq("id", match.id).eq("status", "matched").select("id").maybeSingle();
  if (!completed) return;
  const rows = await Promise.all([winnerTokenId, loserTokenId].map(async (tokenId) => {
    const { data } = await supabase.from("athlete_battle_records").select("*").eq("token_id", tokenId).maybeSingle();
    return data ?? { token_id: tokenId, discipline: match.discipline, matches_played: 0, wins: 0, losses: 0, draws: 0, current_streak: 0, best_streak: 0, rating: 1500, rating_deviation: 350 };
  }));
  const [winner, loser] = rows;
  const expected = 1 / (1 + 10 ** ((Number(loser.rating) - Number(winner.rating)) / 400));
  const delta = Math.round(24 * (1 - expected));
  const winnerWallet = winnerTokenId === match.first_token_id ? match.first_wallet_address : match.second_wallet_address;
  const loserWallet = winnerWallet === match.first_wallet_address ? match.second_wallet_address : match.first_wallet_address;
  const walletRows = await Promise.all([winnerWallet, loserWallet].map(async (walletAddress) => {
    const { data } = await supabase.from("wallet_battle_records").select("*").eq("wallet_address", walletAddress).maybeSingle();
    return data ?? { wallet_address: walletAddress, matches_played: 0, wins: 0, losses: 0, draws: 0, rating: 1500, rating_deviation: 350 };
  }));
  const [winningWallet, losingWallet] = walletRows;
  const walletExpected = 1 / (1 + 10 ** ((Number(losingWallet.rating) - Number(winningWallet.rating)) / 400));
  const walletDelta = Math.round(20 * (1 - walletExpected));
  await Promise.all([
    supabase.from("athlete_battle_records").upsert({ ...winner, matches_played: winner.matches_played + 1, wins: winner.wins + 1, current_streak: Math.max(1, winner.current_streak + 1), best_streak: Math.max(winner.best_streak, winner.current_streak + 1), rating: Number(winner.rating) + delta, updated_at: completedAt }),
    supabase.from("athlete_battle_records").upsert({ ...loser, matches_played: loser.matches_played + 1, losses: loser.losses + 1, current_streak: Math.min(-1, loser.current_streak - 1), rating: Math.max(0, Number(loser.rating) - delta), updated_at: completedAt }),
    supabase.from("wallet_battle_records").upsert({ ...winningWallet, matches_played: winningWallet.matches_played + 1, wins: winningWallet.wins + 1, rating: Number(winningWallet.rating) + walletDelta, updated_at: completedAt }),
    supabase.from("wallet_battle_records").upsert({ ...losingWallet, matches_played: losingWallet.matches_played + 1, losses: losingWallet.losses + 1, rating: Math.max(0, Number(losingWallet.rating) - walletDelta), updated_at: completedAt }),
    supabase.from("pvp_token_locks").delete().eq("match_id", match.id),
    supabase.from("game_challenges").update({ status: "completed", updated_at: completedAt }).eq("match_id", match.id),
  ]);
}

export async function processMatchAction(wallet: string, matchId: string, input: { turnNumber: number; idempotencyKey: string; action: "call_trick" | "answer_trick"; trickId?: number; callMode?: CallMode; useGrit?: boolean }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Match storage is not configured.");
  if (!/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)) throw new Error("A UUID idempotency key is required.");
  const { data: prior } = await supabase.from("pvp_match_actions").select("result_payload").eq("match_id", matchId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (prior) return prior.result_payload;
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
    result = { action: "call_trick", attempt, seedReveal: seed };
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

  const { error: actionError } = await supabase.from("pvp_match_actions").insert({
    match_id: matchId, wallet_address: wallet.toLowerCase(), turn_number: input.turnNumber, idempotency_key: input.idempotencyKey,
    action_type: input.action, request_payload: input, result_payload: result,
  });
  if (actionError) throw new Error(actionError.code === "23505" ? "This turn was already processed." : actionError.message);
  const { data: updated } = await supabase.from("pvp_matches").update({ state: nextState, next_turn_number: input.turnNumber + 1, action_deadline: new Date(Date.now() + 24 * 60 * 60_000).toISOString() }).eq("id", matchId).eq("next_turn_number", input.turnNumber).eq("status", "matched").select("id").maybeSingle();
  if (!updated) throw new Error("Concurrent action detected; refresh the match.");

  const word = DISCIPLINE_WORDS[first.discipline];
  if (matchIsOver(first.discipline, nextState.firstLosses) || matchIsOver(first.discipline, nextState.secondLosses)) {
    const winner = nextState.firstLosses >= word.length ? second.tokenId : first.tokenId;
    const loser = winner === first.tokenId ? second.tokenId : first.tokenId;
    await settleMatch(match, winner, loser);
    result = { ...result, matchComplete: true, winnerTokenId: winner, loserTokenId: loser };
  }
  return result;
}
