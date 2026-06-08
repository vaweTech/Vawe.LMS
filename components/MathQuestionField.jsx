"use client";

import { useRef } from "react";
import { formatMathNotation } from "@/lib/formatMathNotation";

export const MATH_TEXT_CLASS =
  "font-normal text-[15px] leading-relaxed whitespace-pre-wrap break-words " +
  "[font-family:system-ui,'Segoe_UI',Roboto,Arial,'Noto_Sans','Noto_Sans_Math',sans-serif]";

/**
 * Question text field — accepts copy-paste of Unicode math (α, β, √, x², etc.) with no symbol picker UI.
 */
export default function MathQuestionField({
  value = "",
  onChange,
  placeholder = "Type x^2 for x², x^3 for x³, sqrt(16), \\alpha — converts when you leave the field",
  label,
  minRows = 3,
  className = "",
}) {
  const textareaRef = useRef(null);

  return (
    <div className={`space-y-1 ${className}`}>
      {label ? (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      ) : null}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={(e) => {
          const formatted = formatMathNotation(e.target.value);
          if (formatted !== e.target.value) onChange?.(formatted);
        }}
        placeholder={placeholder}
        rows={minRows}
        spellCheck
        className={`w-full ${MATH_TEXT_CLASS} border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#00448a]/20 focus:border-[#00448a]/40 focus:outline-none resize-y min-h-[72px]`}
      />
    </div>
  );
}
