export type AcademiaQuestion = { prompt: string; options: string[] };
export type AcademiaLesson = {
  id: string;
  courseId: string;
  number: number;
  title: string;
  summary: string;
  durationMinutes: number;
  rewardGrit: number;
  pages: Array<{ eyebrow: string; title: string; body: string; warning?: string; action?: { label: string; href: string } }>;
  questions: AcademiaQuestion[];
};
export type AcademiaCourse = { id: string; number: number; title: string; subtitle: string; color: string; lessons: AcademiaLesson[] };
export type AcademiaProgress = { lesson_id: string; completed_at: string | null; claimed_at: string | null; reward_grit: number; score: number; attempts: number; selected_token_id: number | null };
