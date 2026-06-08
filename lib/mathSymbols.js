/** Unicode math / science symbols for question entry (no LaTeX engine required). */
export const MATH_SYMBOL_GROUPS = [
  {
    label: "Greek",
    symbols: [
      "α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ", "ν", "ξ", "π", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω",
      "Α", "Β", "Γ", "Δ", "Ε", "Θ", "Λ", "Μ", "Π", "Σ", "Φ", "Ω",
    ],
  },
  {
    label: "Operators",
    symbols: ["+", "−", "±", "∓", "×", "÷", "·", "=", "≠", "≈", "≡", "≤", "≥", "≪", "≫", "∝", "∞", "∴", "∵", "%"],
  },
  {
    label: "Powers & roots",
    symbols: ["²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹", "⁰", "⁻", "⁺", "ⁿ", "√", "∛", "∜", "x²", "x³", "aⁿ", "10ⁿ"],
  },
  {
    label: "Calculus",
    symbols: ["∫", "∬", "∭", "∮", "∑", "∏", "∂", "∇", "Δ", "δ", "lim", "→", "←", "↔", "⇒", "⇔", "∈", "∉"],
  },
  {
    label: "Geometry",
    symbols: ["∠", "⊥", "∥", "°", "′", "″", "△", "□", "○", "πr²", "½", "¼", "¾", "⅓", "⅔"],
  },
  {
    label: "Brackets",
    symbols: ["(", ")", "[", "]", "{", "}", "⟨", "⟩", "|", "‖", "⌈", "⌉", "⌊", "⌋"],
  },
];

export function insertAtCursor(textarea, insertion) {
  if (!textarea) return null;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value ?? "";
  const next = value.slice(0, start) + insertion + value.slice(end);
  const caret = start + insertion.length;
  return { next, caret };
}
