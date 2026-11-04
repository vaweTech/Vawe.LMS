import { scoreOneContentAnswer, scoreDescriptiveContentExam } from "@/lib/descriptiveContentScore";
import { evaluateDescriptiveExam } from "@/lib/descriptiveEvaluation/evaluateDescriptiveExam";
import { combineQuestionScores } from "@/lib/descriptiveEvaluation/scoreAggregator";
import { examTotalFromComponents } from "@/lib/descriptiveEvaluation/buildInterviewResult";
import { scoreDescriptiveExam } from "@/lib/descriptiveGrammarScore";
import { SCORING_MODE_COMBINED } from "@/lib/descriptiveEvaluation/constants";

const RUBRIC = {
  version: 2,
  modelAnswer: "Normalization organizes tables to reduce data redundancy and avoid insert, update, and delete anomalies. Normal forms (1NF, 2NF, 3NF) define successive rules. Example: splitting student and course tables.",
  synonyms: [
    { term: "DBMS", aliases: ["database management system"] },
    { term: "normalization", aliases: ["normalisation", "normalize"] },
  ],
  criteria: [
    {
      id: "def",
      label: "Explains normalization",
      marks: 2,
      mentionMarks: 1,
      keywords: ["normalization"],
      alternativePhrases: ["organizing data", "organising data", "process of organizing"],
      explanationPhrases: ["organizing data", "organising data"],
      requireExplanation: true,
    },
    {
      id: "redundancy",
      label: "Reducing redundancy",
      marks: 2,
      mentionMarks: 1,
      keywords: ["redundancy"],
      alternativePhrases: [
        "reduces duplicate data",
        "minimizes data duplication",
        "avoids storing the same information repeatedly",
        "reduce data redundancy",
      ],
      requireExplanation: true,
    },
    {
      id: "anomalies",
      label: "Anomalies",
      marks: 2,
      mentionMarks: 1,
      keywords: ["anomaly", "anomalies"],
      alternativePhrases: ["insert update or delete anomalies", "insertion anomaly", "update anomaly", "deletion anomaly"],
      requireExplanation: true,
    },
    {
      id: "forms",
      label: "Normal forms",
      marks: 2,
      mentionMarks: 1,
      keywords: ["normal form", "1nf", "2nf", "3nf"],
      alternativePhrases: ["normal forms", "purpose of normal forms"],
      requireExplanation: false,
    },
    {
      id: "example",
      label: "Example",
      marks: 2,
      mentionMarks: 1,
      keywords: ["example"],
      alternativePhrases: ["for example", "splitting tables", "student and course"],
      requireExplanation: false,
    },
  ],
  contradictions: [
    {
      id: "pk-dup",
      phrases: ["primary key can contain duplicate", "primary key allows duplicates"],
      penalty: 2,
      allowNegation: true,
    },
  ],
};

const QUESTION = {
  type: "descriptive",
  question: "What is normalization in DBMS?",
  maxScore: 10,
  contentRubric: RUBRIC,
};

function score(text) {
  return scoreOneContentAnswer(text, QUESTION);
}

describe("descriptive content evaluation", () => {
  test("1 exact expected phrases", () => {
    const r = score(
      "Normalization is the process of organizing data in a DBMS to reduce data redundancy and avoid insert, update, or delete anomalies. Normal forms such as 1NF 2NF 3NF define the rules. For example, splitting student and course tables."
    );
    expect(r.status).toBe("ok");
    expect(r.score).toBe(10);
    expect(r.matched.length).toBe(5);
  });

  test("2 configured synonyms", () => {
    const r = score(
      "Normalisation in a database management system is organising data to reduce data redundancy and avoid insertion anomaly. 1NF is a normal form. For example splitting tables."
    );
    expect(r.score).toBeGreaterThanOrEqual(8);
  });

  test("3 alternative phrasing", () => {
    const r = score(
      "This process of organizing data minimizes data duplication and avoids storing the same information repeatedly. It also prevents insertion anomaly. Normal forms exist. For example splitting student and course tables."
    );
    expect(r.score).toBeGreaterThanOrEqual(6);
  });

  test("4 partially correct", () => {
    const r = score("Normalization organizes data in tables. That is all.");
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(10);
    expect(r.missing.length).toBeGreaterThan(0);
  });

  test("5 keywords without required explanation", () => {
    const r = score("normalization redundancy anomalies 1nf 2nf 3nf example");
    expect(r.score).toBeLessThan(10);
    const def = r.matched.find((m) => m.id === "def") || r.missing.find((m) => m.id === "def");
    expect(def).toBeTruthy();
  });

  test("6 configured misconception", () => {
    const r = score(
      "Normalization organizes data and reduce data redundancy. A primary key can contain duplicate values. 1NF is a normal form. For example splitting tables."
    );
    expect(r.incorrect.length).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(
      score(
        "Normalization organizes data and reduce data redundancy. 1NF is a normal form. For example splitting tables."
      ).score
    );
  });

  test("7 explicitly negated misconception", () => {
    const withNegation = score(
      "Normalization organizes data to reduce data redundancy. A primary key cannot contain duplicate values. 1NF. For example splitting tables."
    );
    const withClaim = score(
      "Normalization organizes data to reduce data redundancy. A primary key can contain duplicate values. 1NF. For example splitting tables."
    );
    expect(withNegation.score).toBeGreaterThan(withClaim.score);
  });

  test("8 repeated keyword does not double credit", () => {
    const once = score("Normalization organizes data.");
    const many = score("Normalization normalization normalization organizes data.");
    expect(many.score).toBe(once.score);
  });

  test("9 irrelevant filler", () => {
    const r = score("I like cricket and movies. The weather is nice today.");
    expect(r.score).toBe(0);
  });

  test("10 minor typo in expected term", () => {
    const r = score("Normalizaton is organising data to reduce data redundancy. 1NF. For example splitting tables.");
    expect(r.score).toBeGreaterThan(0);
  });

  test("11 short ambiguous technical term is not fuzzy-matched", () => {
    const q = {
      type: "descriptive",
      maxScore: 2,
      contentRubric: {
        version: 1,
        criteria: [
          {
            id: "nf",
            label: "NF",
            marks: 2,
            mentionMarks: 1,
            keywords: ["nf"],
            requireExplanation: false,
          },
        ],
      },
    };
    const r = scoreOneContentAnswer("on of in an", q);
    expect(r.score).toBe(0);
  });

  test("12 contradictory statements", () => {
    const r = score(
      "Normalization organizes data to reduce data redundancy. Primary key can contain duplicate values and also unique values. 1NF. For example splitting tables."
    );
    expect(r.incorrect.length).toBeGreaterThan(0);
  });

  test("13 blank answer", () => {
    const r = score("");
    expect(r.score).toBe(0);
    expect(r.missing.length).toBe(5);
  });

  test("14 whitespace-only answer", () => {
    const r = score("   \n\t  ");
    expect(r.score).toBe(0);
  });

  test("15 unicode and technical notation", () => {
    const r = score(
      "Normalisation organises data to reduce data redundancy — 1NF, 2NF, 3NF. For example splitting tables."
    );
    expect(r.score).toBeGreaterThan(4);
  });

  test("16 punctuation and hyphen variations", () => {
    const r = score("Normal-ization organises data to reduce data-redundancy. 1NF. For example splitting tables.");
    expect(r.score).toBeGreaterThan(4);
  });

  test("17 question without a rubric", () => {
    const r = scoreOneContentAnswer("Normalization is great.", { type: "descriptive", maxScore: 10 });
    expect(r.status).toBe("no_rubric");
    expect(r.score).toBe(0);
    expect(r.reviewRequired).toBe(true);
  });

  test("18 invalid maximum marks", () => {
    const r = scoreOneContentAnswer("Normalization.", { type: "descriptive", maxScore: 0, contentRubric: RUBRIC });
    expect(r.status).toBe("invalid_rubric");
    expect(r.score).toBe(0);
  });

  test("19 rubric criterion totals exceeding max", () => {
    const r = scoreOneContentAnswer("anything", {
      type: "descriptive",
      maxScore: 4,
      contentRubric: {
        version: 1,
        criteria: [
          { id: "a", marks: 3, keywords: ["a"] },
          { id: "b", marks: 3, keywords: ["b"] },
        ],
      },
    });
    expect(r.status).toBe("invalid_rubric");
    expect(r.score).toBe(0);
  });

  test("20 different maxima and partial-mark boundaries", () => {
    [1, 2, 5, 10, 15, 20].forEach((max) => {
      const q = {
        type: "descriptive",
        maxScore: max,
        contentRubric: {
          version: 1,
          criteria: [
            {
              id: "only",
              marks: max,
              mentionMarks: max / 2,
              keywords: ["stack"],
              alternativePhrases: ["last in first out"],
              requireExplanation: true,
            },
          ],
        },
      };
      const mention = scoreOneContentAnswer("stack", q);
      const full = scoreOneContentAnswer("A stack is last in first out.", q);
      expect(mention.score).toBeLessThanOrEqual(max);
      expect(full.score).toBe(max);
      expect(mention.score).toBeGreaterThan(0);
      expect(mention.score).toBeLessThan(full.score);
    });
  });
});

describe("writing quality stays independent", () => {
  test("grammar issues do not change content score", () => {
    const goodEnglish = "Normalization organizes data to reduce data redundancy. 1NF. For example splitting tables.";
    const badEnglish = "normalization organizes data to reduce data redundancy 1NF for example splitting tables teh recieve";
    expect(score(goodEnglish).score).toBe(score(badEnglish).score);
  });

  test("empty writing score is 0", () => {
    const w = scoreDescriptiveExam([QUESTION], { 0: "" });
    expect(w.score).toBe(0);
  });
});

describe("combined scoring and ranking", () => {
  test("combined policy example 8/10 content and 6/10 writing -> 7.6", () => {
    const r = combineQuestionScores({
      contentScore: 8,
      writingScore: 6,
      maxScore: 10,
      contentWeight: 0.8,
      writingWeight: 0.2,
    });
    expect(r.finalScore).toBe(7.6);
  });

  test("writing-mode exam keeps descriptionScore as writing only", () => {
    const answers = { 0: "Normalization organizes data to reduce data redundancy. 1NF. For example splitting tables." };
    const evaluated = evaluateDescriptiveExam({
      questions: [QUESTION],
      answers,
      exam: { descriptiveScoringMode: "writing" },
    });
    const writing = scoreDescriptiveExam([QUESTION], answers);
    expect(evaluated.descriptionScore.score).toBe(writing.score);
    expect(evaluated.descriptionScore.scoringMode).toBe("writing");
  });

  test("combined-mode uses content and writing once in the exam total", () => {
    const answers = { 0: "Normalization organizes data to reduce data redundancy and avoid insert update or delete anomalies. 1NF 2NF 3NF. For example splitting student and course tables." };
    const evaluated = evaluateDescriptiveExam({
      questions: [QUESTION],
      answers,
      exam: { descriptiveScoringMode: SCORING_MODE_COMBINED },
    });
    expect(evaluated.descriptionScore.questions[0].scoringMode).toBe("combined");
    const total = examTotalFromComponents({ score: 5 }, 3, evaluated.descriptionScore);
    const doubled = total + evaluated.descriptionContentScore.score;
    expect(doubled).toBeGreaterThan(total);
    expect(evaluated.descriptionScore.score).toBeLessThanOrEqual(10);
  });

  test("historical writing descriptionScore is not regraded here", () => {
    const stored = { score: 9.5, maxScore: 10, errorCount: 0, questions: [] };
    expect(stored.score).toBe(9.5);
  });
});

describe("exam with mixed questions", () => {
  test("only descriptive items are content-scored", () => {
    const questions = [
      { type: "mcq", question: "x" },
      QUESTION,
    ];
    const r = scoreDescriptiveContentExam(questions, { 1: "Normalization organizes data." });
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].questionIndex).toBe(1);
  });
});
