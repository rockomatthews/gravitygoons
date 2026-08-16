"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { authenticateProfileSession } from "@/lib/profile-auth-client";
import type { AcademiaCourse, AcademiaLesson, AcademiaProgress } from "@/lib/academia/types";

type OwnedGoon = { tokenId: number; name: string; discipline: string; imageUrl: string };
type Overview = { courses: AcademiaCourse[]; progress: AcademiaProgress[]; ownedGoons: OwnedGoon[]; authenticated: boolean; databaseReady: boolean };
const EMPTY: Overview = { courses: [], progress: [], ownedGoons: [], authenticated: false, databaseReady: false };

export function AcademiaCampus() {
  const { account, connect, signMessage, signProfileChallenge } = useWallet();
  const [overview, setOverview] = useState<Overview>(EMPTY);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<AcademiaLesson | null>(null);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Open any course for free. Connect a wallet to save progress and earn token-bound GRIT.");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/academia", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setOverview(data);
    setSelectedToken((current) => data.ownedGoons.some((goon: OwnedGoon) => goon.tokenId === current) ? current : data.ownedGoons[0]?.tokenId ?? null);
  }, []);
  useEffect(() => { let live = true; const initial = window.setTimeout(() => { void refresh().catch((error) => { if (live) setStatus(error instanceof Error ? error.message : "Unable to load Academia."); }); }, 0); return () => { live = false; window.clearTimeout(initial); }; }, [refresh, account]);

  const progressMap = useMemo(() => new Map(overview.progress.map((item) => [item.lesson_id, item])), [overview.progress]);
  const completed = overview.progress.filter((item) => item.completed_at).length;
  const claimed = overview.progress.filter((item) => item.claimed_at).length;
  const pendingGrit = overview.progress.filter((item) => item.completed_at && !item.claimed_at).reduce((sum, item) => sum + Number(item.reward_grit), 0);
  const totalLessons = overview.courses.reduce((sum, course) => sum + course.lessons.length, 0);

  async function ensureAuth() {
    const wallet = account ?? await connect();
    if (!wallet) throw new Error("Connect a wallet to save this lesson.");
    const me = await fetch("/api/profile/me").then((response) => response.json());
    if (!me.authenticated) await authenticateProfileSession({ account: wallet, connect, signMessage, signProfileChallenge, onStatus: setStatus });
  }

  function openLesson(item: AcademiaLesson) {
    setLesson(item); setPage(0); setAnswers(Array(item.questions.length).fill(-1)); setEnrolled(Boolean(progressMap.get(item.id))); setStatus("Read every briefing card, then pass the knowledge check with a perfect score.");
  }

  async function enroll() {
    if (!lesson) return;
    setBusy(true);
    try { await ensureAuth(); const response = await fetch(`/api/academia/lessons/${lesson.id}/start`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setEnrolled(true); setStatus(data.alreadyCompleted ? "Lesson already completed. You can review it any time." : "Progress tracking started. Read the lesson before taking the quiz."); await refresh(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to start lesson."); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!lesson) return;
    setBusy(true);
    try {
      await ensureAuth();
      if (!enrolled) { const started = await fetch(`/api/academia/lessons/${lesson.id}/start`, { method: "POST" }); if (!started.ok) throw new Error((await started.json()).error); setEnrolled(true); }
      const response = await fetch(`/api/academia/lessons/${lesson.id}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers, tokenId: selectedToken }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (!data.completed) setStatus(`${data.correct}/${data.total} correct. Review the briefing and try again—GRIT requires a perfect score.`);
      else if (data.reward?.status === "claimed") { setStatus(`PASSED. +${data.reward.grit} GRIT awarded to Goon #${String(data.reward.tokenId).padStart(4, "0")}.`); window.dispatchEvent(new Event("gravity-goons:economy")); }
      else setStatus(`PASSED. ${data.reward?.grit ?? lesson.rewardGrit} GRIT is pending until this wallet owns a Goon.`);
      await refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to submit quiz."); }
    finally { setBusy(false); }
  }

  async function claimPending() {
    if (!selectedToken) return;
    setBusy(true);
    try { await ensureAuth(); const response = await fetch("/api/academia/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId: selectedToken }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setStatus(`${data.totalGrit} pending GRIT claimed to Goon #${String(selectedToken).padStart(4, "0")}.`); window.dispatchEvent(new Event("gravity-goons:economy")); await refresh(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to claim GRIT."); }
    finally { setBusy(false); }
  }

  const activeCourse = overview.courses.find((course) => course.id === courseId) ?? null;
  return <>
    <section className="academia-hero"><div className="academia-sky"><i/><i/><i/></div><div className="academia-title"><p className="eyebrow">GOONIVERSE LEARNING DISTRICT</p><h1>ACA<br/><span>DEMIA</span></h1><p>Crypto confidence without the hype. Learn wallets, Base, NFT ownership, and the exact Gravity Goons purchase flow—then prove it for GRIT.</p></div><div className="academia-campus" aria-label="Academia course campus">{overview.courses.map((course) => { const count = course.lessons.filter((item) => progressMap.get(item.id)?.completed_at).length; return <button key={course.id} className={course.id === courseId ? "active" : ""} style={{ "--academy-color": course.color } as React.CSSProperties} onClick={() => setCourseId(course.id)}><span>0{course.number}</span><div><b>{course.title}</b><small>{count} / {course.lessons.length} COMPLETE</small></div></button>; })}</div></section>
    <section className="academia-dashboard shell"><div><span>ACADEMIA PROGRESS</span><b>{completed} / {totalLessons}</b><i><em style={{ width: `${totalLessons ? completed / totalLessons * 100 : 0}%` }}/></i></div><div><span>GRIT CLAIMED</span><b>{claimed}</b><small>ONE PER COMPLETED LESSON</small></div><div><span>PENDING GRIT</span><b>{pendingGrit}</b>{pendingGrit > 0 && overview.ownedGoons.length ? <button onClick={claimPending} disabled={busy || !selectedToken}>CLAIM TO SELECTED GOON</button> : <small>{pendingGrit ? "BUY A GOON TO CLAIM" : "NO PENDING REWARDS"}</small>}</div><label>REWARD GOON<select value={selectedToken ?? ""} onChange={(event) => setSelectedToken(Number(event.target.value) || null)}><option value="">No owned Goon yet</option>{overview.ownedGoons.map((goon) => <option key={goon.tokenId} value={goon.tokenId}>#{String(goon.tokenId).padStart(4, "0")} · {goon.discipline}</option>)}</select></label></section>
    <section className="academia-courses shell"><header><div><p className="eyebrow">BITE-SIZED COURSES // PERFECT QUIZ REQUIRED</p><h2>{activeCourse?.title ?? "CHOOSE A BUILDING"}</h2></div><p>{activeCourse?.subtitle ?? "Each campus building contains three lessons. Course access is free; wallet sign-in is only required to save progress and earn GRIT."}</p></header>{activeCourse ? <div className="academia-lessons">{activeCourse.lessons.map((item) => { const progress = progressMap.get(item.id); return <button key={item.id} onClick={() => openLesson(item)}><span>LESSON 0{item.number}</span><b>{item.title}</b><p>{item.summary}</p><small>{item.durationMinutes} MIN · +{item.rewardGrit} GRIT</small><i>{progress?.claimed_at ? "GRIT CLAIMED" : progress?.completed_at ? "PASSED · GRIT PENDING" : "ENTER CLASSROOM →"}</i></button>; })}</div> : <div className="academia-empty"><b>SELECT ONE OF THE 3D CAMPUS BUILDINGS ABOVE</b><span>Start with Crypto Ground School if this is your first wallet.</span></div>}</section>
    <section className="academia-safety shell"><span>THE ONE RULE THAT OVERRIDES EVERYTHING</span><b>NEVER SHARE A RECOVERY PHRASE OR PRIVATE KEY.</b><p>Gravity Goons Academia will never request one. A legitimate lesson, support conversation, login, mint, or marketplace purchase does not require you to disclose it.</p><a href="https://support.metamask.io/stay-safe/safety-in-web3/basic-safety-and-security-tips-for-metamask/" target="_blank" rel="noreferrer">READ WALLET SAFETY GUIDANCE ↗</a></section>
    {lesson ? <div className="academia-classroom" role="dialog" aria-modal="true" aria-labelledby="academia-lesson-title"><article><button className="academia-close" onClick={() => setLesson(null)} aria-label="Close lesson">×</button><header><span>{lesson.courseId.replaceAll("-", " ")} · LESSON 0{lesson.number}</span><h2 id="academia-lesson-title">{lesson.title}</h2><b>+{lesson.rewardGrit} GRIT FOR A PERFECT QUIZ</b></header>{page < lesson.pages.length ? <div className="academia-page"><span>{lesson.pages[page].eyebrow}</span><h3>{lesson.pages[page].title}</h3><p>{lesson.pages[page].body}</p>{lesson.pages[page].warning ? <strong>{lesson.pages[page].warning}</strong> : null}{lesson.pages[page].action ? <Link href={lesson.pages[page].action.href} target={lesson.pages[page].action.href.startsWith("http") ? "_blank" : undefined}>{lesson.pages[page].action.label} →</Link> : null}<footer><small>BRIEFING {page + 1} / {lesson.pages.length}</small><button onClick={() => setPage((current) => Math.min(lesson.pages.length, current + 1))}>{page + 1 === lesson.pages.length ? "TAKE THE QUIZ" : "NEXT BRIEFING"}</button></footer></div> : <div className="academia-quiz">{lesson.questions.map((question, questionIndex) => <fieldset key={question.prompt}><legend>{questionIndex + 1}. {question.prompt}</legend>{question.options.map((option, optionIndex) => <label key={option}><input type="radio" name={`question-${questionIndex}`} checked={answers[questionIndex] === optionIndex} onChange={() => setAnswers((current) => current.map((answer, index) => index === questionIndex ? optionIndex : answer))}/><span>{option}</span></label>)}</fieldset>)}{!enrolled ? <button className="academia-enroll" onClick={enroll} disabled={busy}>{account ? "ENROLL + TRACK THIS LESSON" : "CONNECT WALLET TO EARN GRIT"}</button> : <button className="academia-submit" onClick={submit} disabled={busy || answers.some((answer) => answer < 0)}>{busy ? "VERIFYING…" : "SUBMIT KNOWLEDGE CHECK"}</button>}</div>}</article></div> : null}
    <p className="academia-status" aria-live="polite">{status}</p>
  </>;
}
