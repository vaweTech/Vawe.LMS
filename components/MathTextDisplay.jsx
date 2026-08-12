"use client";

import { MATH_TEXT_CLASS } from "@/components/MathQuestionField";
import { formatMathNotation } from "@/lib/formatMathNotation";

/** Renders question text; converts x^2 → x², sqrt, \\alpha, etc. */
export default function MathTextDisplay({ children, className = "", inline = false }) {
  if (children == null || children === "") return null;
  const Tag = inline ? "span" : "div";
  const text = formatMathNotation(String(children));
  return (
    <Tag className={`${MATH_TEXT_CLASS} text-gray-800 ${className}`.trim()}>{text}</Tag>
  );
}
