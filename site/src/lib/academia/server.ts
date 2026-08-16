import "server-only";

import collection from "@/data/collection.json";
import { goonImageUrl } from "@/lib/goon-images";
import { syncWalletOwnership, verifyTokenOwnership } from "@/lib/profile-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { privateAcademiaLesson, publicAcademiaCourses } from "./content";
import { gradeAcademiaQuiz } from "./quiz";

export async function getAcademiaOverview(wallet: string | null) {
  const supabase = getSupabaseAdmin();
  const courses = publicAcademiaCourses();
  if (!wallet || !supabase) return { courses, progress: [], ownedGoons: [], authenticated: Boolean(wallet), databaseReady: Boolean(supabase) };
  const [tokenIds, progress] = await Promise.all([
    syncWalletOwnership(wallet),
    supabase.from("academia_lesson_progress").select("lesson_id,completed_at,claimed_at,reward_grit,score,attempts,selected_token_id").eq("wallet_address", wallet.toLowerCase()),
  ]);
  return { courses, progress: progress.data ?? [], authenticated: true, databaseReady: true, ownedGoons: tokenIds.map((tokenId) => ({ tokenId, name: collection.tokens[tokenId - 1].name, discipline: collection.tokens[tokenId - 1].discipline, imageUrl: goonImageUrl(tokenId) })) };
}

export async function startAcademiaLesson(wallet: string, lessonId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("ACADEMIA_DATABASE_UNAVAILABLE");
  const lesson = privateAcademiaLesson(lessonId);
  const normalized = wallet.toLowerCase();
  const { data: existing } = await supabase.from("academia_lesson_progress").select("started_at,completed_at").eq("wallet_address", normalized).eq("lesson_id", lessonId).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("academia_lesson_progress").insert({ wallet_address: normalized, course_id: lesson.courseId, lesson_id: lesson.id, reward_grit: lesson.rewardGrit });
    if (error) throw new Error(error.message);
  }
  return { lessonId, startedAt: existing?.started_at ?? new Date().toISOString(), alreadyCompleted: Boolean(existing?.completed_at) };
}

export async function completeAcademiaLesson(wallet: string, lessonId: string, input: { answers?: number[]; tokenId?: number | null }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("ACADEMIA_DATABASE_UNAVAILABLE");
  const lesson = privateAcademiaLesson(lessonId);
  const normalized = wallet.toLowerCase();
  const { data: progress } = await supabase.from("academia_lesson_progress").select("*").eq("wallet_address", normalized).eq("lesson_id", lessonId).maybeSingle();
  if (!progress) throw new Error("START_LESSON_FIRST");
  const { correct, total, score, completed } = gradeAcademiaQuiz(lesson.correctAnswers, input.answers);
  const { error: updateError } = await supabase.from("academia_lesson_progress").update({ score: Math.max(score, Number(progress.score ?? 0)), attempts: Number(progress.attempts ?? 0) + 1, completed_at: completed ? progress.completed_at ?? new Date().toISOString() : progress.completed_at, updated_at: new Date().toISOString() }).eq("wallet_address", normalized).eq("lesson_id", lessonId);
  if (updateError) throw new Error(updateError.message);
  if (!completed) return { completed: false, score, correct, total, reward: null };
  const tokenId = Number(input.tokenId);
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000) return { completed: true, score, correct, total, reward: { status: "pending", grit: lesson.rewardGrit } };
  return { completed: true, score, correct, total, reward: await claimOne(wallet, lessonId, tokenId) };
}

async function claimOne(wallet: string, lessonId: string, tokenId: number) {
  if (!await verifyTokenOwnership(wallet, tokenId)) throw new Error("LIVE_OWNERSHIP_REQUIRED");
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("ACADEMIA_DATABASE_UNAVAILABLE");
  const { data, error } = await supabase.rpc("claim_academia_grit", { p_wallet: wallet.toLowerCase(), p_lesson_id: lessonId, p_token_id: tokenId });
  if (error) throw new Error(error.message);
  return { status: "claimed", grit: privateAcademiaLesson(lessonId).rewardGrit, tokenId, economy: data };
}

export async function claimPendingAcademiaRewards(wallet: string, tokenId: number) {
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000) throw new Error("VALID_GOON_REQUIRED");
  if (!await verifyTokenOwnership(wallet, tokenId)) throw new Error("LIVE_OWNERSHIP_REQUIRED");
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("ACADEMIA_DATABASE_UNAVAILABLE");
  const { data: pending, error } = await supabase.from("academia_lesson_progress").select("lesson_id,reward_grit").eq("wallet_address", wallet.toLowerCase()).not("completed_at", "is", null).is("claimed_at", null).order("completed_at");
  if (error) throw new Error(error.message);
  const claimed: Array<{ lessonId: string; grit: number }> = [];
  const skipped: Array<{ lessonId: string; reason: string }> = [];
  for (const row of pending ?? []) {
    try { await claimOne(wallet, row.lesson_id, tokenId); claimed.push({ lessonId: row.lesson_id, grit: Number(row.reward_grit) }); }
    catch (claimError) { skipped.push({ lessonId: row.lesson_id, reason: claimError instanceof Error ? claimError.message : "Claim failed" }); }
  }
  return { tokenId, claimed, skipped, totalGrit: claimed.reduce((sum, item) => sum + item.grit, 0) };
}
