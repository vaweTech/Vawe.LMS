"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COPY_KEYS = new Set(["c", "x", "a", "p", "s", "u"]);

function isEditorTarget(target) {
  const el = target;
  if (!el || typeof el !== "object") return false;
  const tag = String(el.tagName || "").toUpperCase();
  return tag === "TEXTAREA" || tag === "INPUT" || !!el.isContentEditable;
}

/**
 * Blocks copy/cut/select and warns when the student leaves the tab.
 */
export function useProtectPageContent({
  maxTabSwitches = 3,
  trackTabs = true,
  allowEditor = false,
} = {}) {
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const countRef = useRef(0);

  useEffect(() => {
    const prevent = (e) => {
      if (allowEditor && isEditorTarget(e.target) && e.type !== "copy" && e.type !== "cut") {
        return;
      }
      e.preventDefault();
      return false;
    };

    const onKeyDown = (e) => {
      const key = String(e.key || "").toLowerCase();
      const inEditor = allowEditor && isEditorTarget(e.target);
      if (inEditor && (key === "a" || key === "v")) return;
      if ((e.ctrlKey || e.metaKey) && COPY_KEYS.has(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === "PrintScreen") {
        e.preventDefault();
      }
    };

    const onVisibility = () => {
      if (!trackTabs || typeof document === "undefined" || !document.hidden) return;
      countRef.current += 1;
      setTabSwitchCount(countRef.current);
      setShowTabWarning(true);
    };

    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("paste", prevent);
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("selectstart", prevent);
    document.addEventListener("dragstart", prevent);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("copy", prevent);
      document.removeEventListener("cut", prevent);
      document.removeEventListener("paste", prevent);
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("selectstart", prevent);
      document.removeEventListener("dragstart", prevent);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [trackTabs, allowEditor]);

  const dismissTabWarning = useCallback(() => {
    setShowTabWarning(false);
  }, []);

  return {
    tabSwitchCount,
    showTabWarning,
    maxTabSwitches,
    dismissTabWarning,
    isOverLimit: tabSwitchCount >= maxTabSwitches,
  };
}
