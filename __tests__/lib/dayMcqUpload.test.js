import { parseDayMcqRows } from "@/lib/dayMcqUpload";

describe("parseDayMcqRows", () => {
  it("maps option text and letter answers", () => {
    const result = parseDayMcqRows([
      {
        question: "Capital?",
        option1: "Paris",
        option2: "London",
        option3: "Berlin",
        answer: "Paris",
      },
      {
        Question: "Select languages",
        "Option A": "Python",
        "Option B": "HTML",
        "Option C": "JavaScript",
        Answer: "A,C",
      },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.questions[0].correctAnswers).toEqual([0]);
    expect(result.questions[1].correctAnswers).toEqual([0, 2]);
    expect(result.questions[1].isMultiple).toBe(true);
  });

  it("keeps a question with a warning when its answer is invalid", () => {
    const result = parseDayMcqRows([
      {
        question: "Capital?",
        option1: "Paris",
        option2: "London",
        answer: "Unknown",
      },
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].correctAnswers).toEqual([]);
    expect(result.questions[0]._uploadWarning).toContain("No matching");
    expect(result.errors).toHaveLength(1);
  });
});

describe("downloadDayMcqs", () => {
  it("builds CSV rows from drafted MCQs", () => {
    const { downloadDayMcqs: download } = require("@/lib/dayMcqUpload");
    const createObjectURL = jest.fn(() => "blob:mock");
    const revokeObjectURL = jest.fn();
    const click = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    jest.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click,
    });

    const ok = download(
      [
        {
          type: "mcq",
          question: "Capital?",
          options: ["Paris", "London", "Berlin", "Madrid"],
          correctAnswers: [0],
        },
      ],
      "day-1-test.csv"
    );

    expect(ok).toBe(true);
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });
});
