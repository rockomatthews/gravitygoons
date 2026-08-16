import assert from "node:assert/strict";
import test from "node:test";
import { gradeAcademiaQuiz } from "./quiz.ts";

test("Academia requires a perfect quiz before awarding progress", () => {
  assert.deepEqual(gradeAcademiaQuiz([0, 1], [0, 0]), { correct: 1, total: 2, score: 50, completed: false });
  assert.deepEqual(gradeAcademiaQuiz([0, 1], [0, 1]), { correct: 2, total: 2, score: 100, completed: true });
});

test("missing or malformed answers never complete a lesson", () => {
  assert.equal(gradeAcademiaQuiz([1, 0], null).completed, false);
  assert.equal(gradeAcademiaQuiz([], []).completed, false);
});
