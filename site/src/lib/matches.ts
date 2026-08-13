import { randomBytes } from "node:crypto";
import collection from "@/data/collection.json";
import { verifyTokenOwnership } from "@/lib/profile-data";
import {
  DISCIPLINE_WORDS, TRICK_CATALOG, addTrickUse, canSetTrick, matchIsOver,
  resolveSkateTurn, setterTrickCooldown, spendCallGrit, updateSetterTrickCooldown, type Athlete, type CallMode, type Discipline,
  type Trick, type TrickHistory,
} from "@/lib/pvp";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { settleMatchProgression } from "@/lib/grit-settlement";
import { seedCommitment } from "@/lib/match-integrity";
import { addMovePresentations } from "@/lib/match-move-media";
import { goonImageUrl } from "@/lib/goon-images";

type MatchState = {
  firstLosses: number;
  secondLosses: number;
  setterTokenId: number;
  previousTrick: string | null;
  lastLandedSetByToken?: Record<string, string>;
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

function goonSummary(tokenId: number) {
  const token = collection.tokens[tokenId - 1];
  return {
    tokenId,
    name: token.name,
    species: token.species,
    parodyBrand: token.parody_brand,
    image: goonImageUrl(tokenId),
  };
}

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function unlockedCatalogue(supabase: AdminClient, tokenId: number, discipline: Discipline): Promise<Trick[]> {
  const { data, error } = await supabase
    .from("athlete_sponsor_progress")
    .select("unlocked_trick_bitmap")
    .eq("token_id", tokenId)
    .maybeSingle();
  if (error) throw new Error("Unable to load this Goon's unlocked tricks.");
  const bitmap=String(data?.unlocked_trick_bitmap??"").replace(/[^01]/g,"").padStart(64,"0").slice(-64);
  return TRICK_CATALOG[discipline].filter((trick)=>bitmap[63-trick.id]==="1");
}

export async function getMatch(wallet: string, matchId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Match storage is not configured.");
  const { data, error } = await supabase.from("pvp_matches").select("id,status,discipline,match_word,first_token_id,second_token_id,first_wallet_address,second_wallet_address,winner_token_id,loser_token_id,next_turn_number,state,first_grit_start,second_grit_start,first_grit_spent,second_grit_spent,action_deadline,started_at,completed_at").eq("id", matchId).single();
  if (error || !data) throw new Error("Match not found.");
  if (![data.first_wallet_address, data.second_wallet_address].includes(wallet.toLowerCase())) throw new Error("This match belongs to different wallets.");
  const state = data.state as MatchState;
  const setter = athlete(state.setterTokenId);
  const [actionsResult, availableTricks] = await Promise.all([
    supabase.from("pvp_match_actions").select("turn_number,action_type,result_payload,created_at").eq("match_id", matchId).order("turn_number"),
    unlockedCatalogue(supabase, setter.tokenId, setter.discipline),
  ]);
  const normalizedWallet = wallet.toLowerCase();
  const viewerTokenId = data.first_wallet_address === normalizedWallet ? data.first_token_id : data.second_token_id;
  const actions = await addMovePresentations(supabase, actionsResult.data ?? []);
  const cooldown = setterTrickCooldown(state.lastLandedSetByToken, setter.tokenId);
  const legalTricks = availableTricks.filter((trick) => canSetTrick(trick, cooldown));
  return {
    ...data,
    first_goon: goonSummary(data.first_token_id),
    second_goon: goonSummary(data.second_token_id),
    viewer_token_id: viewerTokenId,
    viewer_is_setter: viewerTokenId === state.setterTokenId,
    available_tricks: legalTricks.map(({ id, name, difficulty }) => ({ id, name, difficulty })),
    state: { ...state, pendingCall: state.pendingCall ? { trickId: state.pendingCall.trickId, setterTokenId: state.pendingCall.setterTokenId } : undefined },
    actions,
  };
}

export async function processMatchAction(wallet: string, matchId: string, input: { turnNumber: number; idempotencyKey: string; action: "call_trick" | "answer_trick"; trickId?: number; callMode?: CallMode; useGrit?: boolean }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Match storage is not configured.");
  if (!/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)) throw new Error("A UUID idempotency key is required.");
  const { data: match, error } = await supabase.from("pvp_matches").select("*").eq("id", matchId).single();
  if (error || !match) throw new Error("Match not found.");
  if (match.status !== "matched") throw new Error("Match is not accepting actions.");
  if (match.action_deadline && Date.parse(match.action_deadline) <= Date.now()) throw new Error("The 60-second turn clock expired. This turn can no longer be submitted.");
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
  const [catalogue, responderCatalogue] = await Promise.all([
    unlockedCatalogue(supabase, setter.tokenId, setter.discipline),
    unlockedCatalogue(supabase, responder.tokenId, responder.discipline),
  ]);
  const seed = randomBytes(32).toString("hex");
  let result: Record<string, unknown>;
  const nextState: MatchState = structuredClone(state);

  if (input.action === "call_trick") {
    if (state.pendingCall) throw new Error("The responder must answer the current call.");
    const trick = catalogue.find((candidate) => candidate.id === input.trickId);
    if (!trick) throw new Error("Unknown or locked trick.");
    if (input.callMode !== undefined && input.callMode !== "standard" && input.callMode !== "send") throw new Error("Unknown call mode.");
    const callMode = input.callMode ?? "standard";
    nextState.grit[setter.tokenId] = spendCallGrit(state.grit[setter.tokenId] ?? 0, callMode);
    const choice = { setter, responder, trick, setterCatalogue: catalogue, responderCatalogue, responderPractice: state.practice[responder.tokenId] ?? {}, previousSetTrickName: setterTrickCooldown(state.lastLandedSetByToken, setter.tokenId), callMode, letterlessTurns: state.letterlessTurns ?? 0 };
    const turn = resolveSkateTurn(choice, seed);
    const attempt = turn.attempts[0];
    result = { action: "call_trick", attempt, automaticResponse: turn.attempts[1], turn, seedCommit: seedCommitment(seed), seedReveal: seed };
    nextState.previousTrick = null;
    nextState.lastLandedSetByToken = updateSetterTrickCooldown(state.lastLandedSetByToken, setter.tokenId, trick.name, attempt.landed);
    nextState.pendingCall = undefined;
    nextState.setterTokenId = turn.nextSetterTokenId;
    if (turn.attempts[1]) nextState.practice[responder.tokenId] = addTrickUse(state.practice[responder.tokenId] ?? {}, trick.name);
    if (turn.letterRecipientTokenId === first.tokenId) nextState.firstLosses += 1;
    if (turn.letterRecipientTokenId === second.tokenId) nextState.secondLosses += 1;
    nextState.letterlessTurns = turn.letterRecipientTokenId ? 0 : (state.letterlessTurns ?? 0) + 1;
  } else {
    if (!state.pendingCall) throw new Error("There is no called trick to answer.");
    const trick = TRICK_CATALOG[setter.discipline].find((candidate) => candidate.id === state.pendingCall?.trickId);
    if (!trick) throw new Error("The called trick is no longer available.");
    const usesGrit = Boolean(input.useGrit && (state.grit[responder.tokenId] ?? 0) > 0);
    const turn = resolveSkateTurn({
      setter, responder, trick, setterCatalogue: catalogue, responderCatalogue,
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
  if (winnerTokenId) await settleMatchProgression(matchId).catch(()=>undefined);
  return committed as Record<string, unknown>;
}
