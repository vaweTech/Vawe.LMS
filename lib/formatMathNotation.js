/** Map ASCII to Unicode superscript for exponents (x^2 → x²). */
const SUPERSCRIPT = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  o: "ᵒ",
  x: "ˣ",
  y: "ʸ",
};

const SUBSCRIPT = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  o: "ₒ",
  x: "ₓ",
  n: "ₙ",
};

const LATEX_GREEK = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Alpha: "Α",
  Beta: "Β",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Omega: "Ω",
};

function mapChars(str, table) {
  return String(str || "")
    .split("")
    .map((c) => table[c] ?? table[c.toLowerCase()] ?? c)
    .join("");
}

/**
 * Convert caret/subscript notation and common LaTeX fragments to Unicode math.
 * Examples: x^2 → x², x^{10} → x¹⁰, \sqrt{16} → √(16), \alpha → α
 */
export function formatMathNotation(input) {
  if (input == null || input === "") return "";
  let s = String(input);

  // LaTeX-style Greek: \alpha, \beta
  s = s.replace(/\\([A-Za-z]+)/g, (_, name) => LATEX_GREEK[name] ?? `\\${name}`);

  // \sqrt{...} and sqrt(...)
  s = s.replace(/\\sqrt\s*\{([^}]*)\}/g, "√($1)");
  s = s.replace(/\\sqrt\s*\(([^)]*)\)/g, "√($1)");
  s = s.replace(/\bsqrt\s*\{([^}]*)\}/gi, "√($1)");
  s = s.replace(/\bsqrt\s*\(([^)]*)\)/gi, "√($1)");

  // x^{exp} and x^(exp)
  s = s.replace(/\^\{([^}]+)\}/g, (_, exp) => mapChars(exp, SUPERSCRIPT));
  s = s.replace(/\^\(([^)]+)\)/g, (_, exp) => mapChars(exp, SUPERSCRIPT));

  // x^2, 10^-3, a^n (caret + run of exponent chars)
  s = s.replace(
    /\^([0-9+\-()nixa-z]+)/gi,
    (_, exp) => mapChars(exp, SUPERSCRIPT)
  );

  // x_2 subscripts
  s = s.replace(/_\{([^}]+)\}/g, (_, sub) => mapChars(sub, SUBSCRIPT));
  s = s.replace(/_([0-9+\-()nixa-z]+)/gi, (_, sub) => mapChars(sub, SUBSCRIPT));

  // **2 same as ^2 (markdown style)
  s = s.replace(/\*\*([0-9]+)\*\*/g, (_, exp) => mapChars(exp, SUPERSCRIPT));

  return s;
}
