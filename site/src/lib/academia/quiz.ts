export function gradeAcademiaQuiz(correctAnswers: number[], submittedAnswers: unknown): { correct: number; total: number; score: number; completed: boolean } {
  const answers = Array.isArray(submittedAnswers) ? submittedAnswers.map(Number) : [];
  const correct = correctAnswers.reduce((total, answer, index) => total + (answers[index] === answer ? 1 : 0), 0);
  const score = correctAnswers.length ? Math.round(correct / correctAnswers.length * 100) : 0;
  return { correct, total: correctAnswers.length, score, completed: correctAnswers.length > 0 && score === 100 };
}
