/** Grammar and writing-error score for descriptive interview answers. */

const MISSPELLINGS = {
  recieve: "receive",
  recieved: "received",
  seperate: "separate",
  seperated: "separated",
  definately: "definitely",
  definate: "definite",
  occured: "occurred",
  occuring: "occurring",
  occurence: "occurrence",
  teh: "the",
  adress: "address",
  becuase: "because",
  beacuse: "because",
  wierd: "weird",
  untill: "until",
  gaurd: "guard",
  enviroment: "environment",
  accomodate: "accommodate",
  occassion: "occasion",
  recomend: "recommend",
  recomendation: "recommendation",
  sucess: "success",
  sucessful: "successful",
  begining: "beginning",
  writting: "writing",
  grammer: "grammar",
  sentance: "sentence",
  sentances: "sentences",
  langauge: "language",
  langauges: "languages",
  experince: "experience",
  experiance: "experience",
  imporant: "important",
  importent: "important",
  diferent: "different",
  diffrent: "different",
  studing: "studying",
  studnet: "student",
  studnets: "students",
  knowlege: "knowledge",
  knoledge: "knowledge",
  acheive: "achieve",
  acheived: "achieved",
  beleive: "believe",
  beleived: "believed",
  freind: "friend",
  freinds: "friends",
  tommorow: "tomorrow",
  tommorrow: "tomorrow",
  wich: "which",
  whith: "with",
  thier: "their",
  ther: "there",
  alot: "a lot",
  aswell: "as well",
  infact: "in fact",
  infront: "in front",
  cant: "can't",
  dont: "don't",
  doesnt: "doesn't",
  didnt: "didn't",
  wont: "won't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  im: "I'm",
  ive: "I've",
  id: "I'd",
  youre: "you're",
  theyre: "they're",
  thats: "that's",
  whats: "what's",
  its: null,
};

const GRAMMAR_RULES = [
  {
    re: /\b(he|she|it)\s+(are|were|go|do|have|write|need|want|like|work|make|take)\b/gi,
    message: "Subject-verb agreement (he/she/it needs a singular verb)",
  },
  {
    re: /\b(they|we|you)\s+(is|was|goes|does|has|writes|needs|wants)\b/gi,
    message: "Subject-verb agreement (they/we/you need a plural verb)",
  },
  {
    re: /\bI\s+(is|are|was|goes|does|has)\b/g,
    message: "Subject-verb agreement with I",
  },
  {
    re: /\b(he|she|it)\s+don't\b/gi,
    message: 'Use "doesn\'t" with he/she/it',
  },
  {
    re: /\b(they|we|you|I)\s+doesn't\b/gi,
    message: 'Use "don\'t" with they/we/you/I',
  },
  {
    re: /\bmore\s+(better|worse|easier|harder|bigger|smaller)\b/gi,
    message: "Do not use \"more\" with a comparative adjective",
  },
  {
    re: /\b(could|should|would|might|must)\s+of\b/gi,
    message: 'Use "have" after could/should/would, not "of"',
  },
];

function pushError(errors, type, message) {
  if (errors.length >= 12) return;
  if (errors.some((e) => e.message === message)) return;
  errors.push({ type, message });
}

export function checkWritingErrors(text) {
  const trimmed = String(text || "").trim();
  const errors = [];
  if (!trimmed) {
    return {
      wordCount: 0,
      errors: [{ type: "error", message: "No answer submitted" }],
    };
  }

  const words = trimmed.match(/[A-Za-z']+/g) || [];
  const wordCount = words.length;

  words.forEach((word) => {
    if (word === "i") {
      pushError(errors, "grammar", 'Capitalize the pronoun "I"');
      return;
    }
    const key = word.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(MISSPELLINGS, key)) {
      const fix = MISSPELLINGS[key];
      if (key === "its") return;
      pushError(
        errors,
        "spelling",
        fix ? `"${word}" should be "${fix}"` : `Check spelling of "${word}"`
      );
    }
  });

  const repeated = trimmed.match(/\b([A-Za-z]+)\s+\1\b/gi) || [];
  repeated.forEach((match) => {
    pushError(errors, "grammar", `Repeated word "${match.trim()}"`);
  });

  const aVowel = trimmed.match(/\ba\s+[aeiou]\w*/gi) || [];
  aVowel.forEach((match) => {
    if (/\ba\s+u(ni|se|su)/i.test(match)) return;
    pushError(errors, "grammar", `Use "an" instead of "${match}"`);
  });
  const anConsonant = trimmed.match(/\ban\s+[bcdfghjklmnpqrstvwxyz]\w*/gi) || [];
  anConsonant.forEach((match) => {
    if (/\ban\s+h(our|onest|onour)/i.test(match)) return;
    pushError(errors, "grammar", `Use "a" instead of "${match}"`);
  });

  GRAMMAR_RULES.forEach((rule) => {
    rule.re.lastIndex = 0;
    if (rule.re.test(trimmed)) pushError(errors, "grammar", rule.message);
  });

  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  sentences.forEach((sentence) => {
    const bit = sentence.trim();
    if (bit && /^[a-z]/.test(bit)) {
      pushError(errors, "grammar", "Start each sentence with a capital letter");
    }
  });

  if (/([!?,])\1+|\.{4,}/.test(trimmed)) {
    pushError(errors, "error", "Repeated punctuation");
  }
  if (/[.!?,;:][A-Za-z]/.test(trimmed)) {
    pushError(errors, "error", "Missing space after punctuation");
  }
  if (/\s{2,}/.test(trimmed)) {
    pushError(errors, "error", "Extra spaces between words");
  }
  if (wordCount >= 8 && !/[.!?]$/.test(trimmed)) {
    pushError(errors, "error", "End the answer with a full stop");
  }

  return { wordCount, errors };
}

export function scoreFromErrorCount(maxScore, wordCount, errorCount) {
  const max = Number.isFinite(Number(maxScore)) && Number(maxScore) > 0 ? Number(maxScore) : 10;
  if (!wordCount) return 0;
  const allowance = Math.max(1, wordCount * 0.2);
  const ratio = Math.max(0, Math.min(1, 1 - errorCount / allowance));
  return Math.round(ratio * max * 10) / 10;
}

export function scoreOneAnswer(text, maxScore) {
  const { wordCount, errors } = checkWritingErrors(text);
  const errorCount = wordCount === 0 ? 1 : errors.length;
  const score = scoreFromErrorCount(maxScore, wordCount, errors.length);
  return {
    score,
    maxScore: Number.isFinite(Number(maxScore)) && Number(maxScore) > 0 ? Number(maxScore) : 10,
    errorCount: wordCount === 0 ? errorCount : errors.length,
    wordCount,
    errors,
  };
}

export function scoreDescriptiveExam(questions, answers) {
  const details = [];
  let score = 0;
  let maxScore = 0;
  let errorCount = 0;
  const list = Array.isArray(questions) ? questions : [];
  list.forEach((q, i) => {
    if (!q || q.type !== "descriptive") return;
    const max = Number.isFinite(Number(q.maxScore)) && Number(q.maxScore) > 0 ? Number(q.maxScore) : 10;
    const text = answers && answers[i] != null ? String(answers[i]) : "";
    const row = scoreOneAnswer(text, max);
    score += row.score;
    maxScore += row.maxScore;
    errorCount += row.errorCount;
    details.push({
      questionIndex: i,
      questionNumber: details.length + 1,
      score: row.score,
      maxScore: row.maxScore,
      errorCount: row.errorCount,
      wordCount: row.wordCount,
      errors: row.errors,
    });
  });
  return {
    score: Math.round(score * 10) / 10,
    maxScore,
    errorCount,
    questions: details,
  };
}
