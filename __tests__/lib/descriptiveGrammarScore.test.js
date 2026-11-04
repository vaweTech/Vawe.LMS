import { checkWritingErrors, scoreDescriptiveExam, scoreFromErrorCount } from "@/lib/descriptiveGrammarScore";

describe("legacy writing-quality scorer", () => {
  test("empty answers score 0", () => {
    const r = scoreDescriptiveExam([{ type: "descriptive", maxScore: 10 }], { 0: "" });
    expect(r.score).toBe(0);
    expect(r.errorCount).toBeGreaterThan(0);
  });

  test("clear writing scores higher than error-heavy writing", () => {
    const q = [{ type: "descriptive", maxScore: 10 }];
    const good = scoreDescriptiveExam(q, {
      0: "Normalization is the process of organizing a database. It reduces redundancy.",
    });
    const bad = scoreDescriptiveExam(q, {
      0: "he are recieve teh definately seperate data data",
    });
    expect(good.score).toBeGreaterThan(bad.score);
  });

  test("scoreFromErrorCount is deterministic", () => {
    expect(scoreFromErrorCount(10, 20, 2)).toBe(scoreFromErrorCount(10, 20, 2));
  });

  test("checkWritingErrors flags repeated words", () => {
    const r = checkWritingErrors("The the database is useful.");
    expect(r.errors.some((e) => /repeated/i.test(e.message))).toBe(true);
  });
});
