"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAppleMobileDevice } from "@/lib/deviceDetect";

function isEditableTarget(target) {
  if (!target) return false;
  const el = target.nodeType === 1 ? target : target.parentElement;
  return Boolean(el?.closest?.("input, textarea, select, [contenteditable='true']"));
}

/** Block copy / cut / right-click / text selection. Coding editors stay editable. */
export function useNoCopy({ enabled = true, allowEditable = true } = {}) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;

    const block = (e) => {
      if (allowEditable && isEditableTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const onKeyDown = (e) => {
      const key = String(e.key || "").toLowerCase();
      const combo = e.ctrlKey || e.metaKey;
      const inEditor = allowEditable && isEditableTarget(e.target);

      if (e.key === "F12" || (combo && e.shiftKey && ["i", "j", "c"].includes(key))) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (inEditor) return;
      if (combo && ["c", "x", "a", "s", "p", "u"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("copy", block, true);
    document.addEventListener("cut", block, true);
    document.addEventListener("contextmenu", block, true);
    document.addEventListener("selectstart", block, true);
    document.addEventListener("dragstart", block, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("copy", block, true);
      document.removeEventListener("cut", block, true);
      document.removeEventListener("contextmenu", block, true);
      document.removeEventListener("selectstart", block, true);
      document.removeEventListener("dragstart", block, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled, allowEditable]);
}

export function formatExamTime(ms) {
  if (ms == null) return null;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Fullscreen + tab-switch monitoring for timed exams (mock tests, etc.).
 */
export function useSecureExamSession({ durationMinutes = 0, onBlocked } = {}) {
  const [started, setStarted] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [inFullscreen, setInFullscreen] = useState(false);

  const timerRef = useRef(null);
  const tabSwitchCountRef = useRef(0);
  const suppressVisibilityViolationsUntilRef = useRef(0);
  const fullscreenReenterRef = useRef(null);
  const submittedRef = useRef(false);
  const onTimeUpRef = useRef(null);
  const startedRef = useRef(false);
  const blockedRef = useRef(false);
  const warningOpenRef = useRef(false);
  const lastStrikeAtRef = useRef(0);

  startedRef.current = started;
  blockedRef.current = isBlocked;

  const lockExamKeyboard = useCallback(async () => {
    if (typeof navigator === "undefined") return;
    try {
      if (navigator.keyboard?.lock) {
        await navigator.keyboard.lock();
      }
    } catch {
      /* Chrome only allows this in fullscreen */
    }
  }, []);

  const requestFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return false;
    if (isAppleMobileDevice()) return false;
    const el = document.documentElement;
    if (document.fullscreenElement) {
      await lockExamKeyboard();
      return true;
    }
    if (!el?.requestFullscreen) return false;
    suppressVisibilityViolationsUntilRef.current = Date.now() + 1500;
    try {
      await el.requestFullscreen({ navigationUI: "hide" });
      setInFullscreen(true);
      await lockExamKeyboard();
      return true;
    } catch {
      try {
        await el.requestFullscreen();
        setInFullscreen(true);
        await lockExamKeyboard();
        return true;
      } catch {
        return false;
      }
    }
  }, [lockExamKeyboard]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (initialMs) => {
      stopTimer();
      const duration = Number(durationMinutes) || 0;
      if (duration <= 0) {
        setTimeLeftMs(null);
        return;
      }
      const startingMs = Number.isFinite(initialMs) ? initialMs : duration * 60 * 1000;
      setTimeLeftMs(startingMs);
      timerRef.current = setInterval(() => {
        setTimeLeftMs((prev) => {
          const next = Math.max(0, (prev ?? 0) - 1000);
          if (next <= 0) stopTimer();
          return next;
        });
      }, 1000);
    },
    [durationMinutes, stopTimer]
  );

  const resetSession = useCallback(() => {
    stopTimer();
    setStarted(false);
    setPendingStart(false);
    setTimeLeftMs(null);
    tabSwitchCountRef.current = 0;
    setTabSwitchCount(0);
    warningOpenRef.current = false;
    lastStrikeAtRef.current = 0;
    setShowTabWarning(false);
  }, [stopTimer]);

  const blockSession = useCallback(
    (reason, count) => {
      setIsBlocked(true);
      setBlockReason(reason);
      resetSession();
      onBlocked?.({ reason, count });
    },
    [onBlocked, resetSession]
  );

  const handleViolation = useCallback(
    (violationType) => {
      if (!started || isBlocked) return;
      if (Date.now() - lastStrikeAtRef.current < 2000) return;
      lastStrikeAtRef.current = Date.now();
      tabSwitchCountRef.current += 1;
      const newCount = tabSwitchCountRef.current;
      setTabSwitchCount(newCount);
      if (newCount >= 3) {
        const reason =
          violationType === "fullscreen"
            ? "Test blocked due to exiting fullscreen 3 times"
            : "Test blocked due to 3 tab switches";
        blockSession(reason, newCount);
      }
    },
    [started, isBlocked, blockSession]
  );

  const dismissTabWarning = useCallback(() => {
    suppressVisibilityViolationsUntilRef.current = Date.now() + 1200;
    warningOpenRef.current = false;
    setShowTabWarning(false);
  }, []);

  const startExam = useCallback(async () => {
    if (isBlocked) {
      alert("This test is blocked. Please contact your administrator.");
      return false;
    }
    if (!acceptedRules) {
      alert("Please accept the rules to proceed.");
      return false;
    }

    tabSwitchCountRef.current = 0;
    setTabSwitchCount(0);
    warningOpenRef.current = false;
    lastStrikeAtRef.current = 0;
    setShowTabWarning(false);

    if (isAppleMobileDevice()) {
      setPendingStart(false);
      setStarted(true);
      startTimer();
      return true;
    }

    if (typeof document !== "undefined" && !document.fullscreenElement) {
      setPendingStart(true);
      const ok = await requestFullscreen();
      if (ok || document.fullscreenElement) {
        setPendingStart(false);
        setStarted(true);
        startTimer();
        return true;
      }
      setPendingStart(true);
      alert("Allow fullscreen to start the test. Chrome cannot restrict tabs without fullscreen.");
      return false;
    }

    setStarted(true);
    startTimer();
    return true;
  }, [acceptedRules, isBlocked, requestFullscreen, startTimer]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (isAppleMobileDevice()) return undefined;

    const handleFullscreenChange = () => {
      const fs = !!document.fullscreenElement;
      setInFullscreen(fs);
      if (document.fullscreenElement) {
        suppressVisibilityViolationsUntilRef.current = Date.now() + 1200;
        lockExamKeyboard();
      } else {
        try {
          navigator.keyboard?.unlock?.();
        } catch {
          /* ignore */
        }
      }
      if (pendingStart && document.fullscreenElement) {
        setPendingStart(false);
        setStarted(true);
        tabSwitchCountRef.current = 0;
        setTabSwitchCount(0);
        warningOpenRef.current = false;
        lastStrikeAtRef.current = 0;
        startTimer();
        return;
      }
      if (started && !document.fullscreenElement && !isBlocked) {
        handleViolation("fullscreen");
        if (fullscreenReenterRef.current) clearTimeout(fullscreenReenterRef.current);
        fullscreenReenterRef.current = setTimeout(() => {
          if (started && !isBlocked && typeof document !== "undefined") {
            const el = document.documentElement;
            if (el?.requestFullscreen) {
              suppressVisibilityViolationsUntilRef.current = Date.now() + 1500;
              el.requestFullscreen({ navigationUI: "hide" })
                .then(() => lockExamKeyboard())
                .catch(() => el.requestFullscreen().then(() => lockExamKeyboard()).catch(() => {}));
            }
          }
        }, 100);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (fullscreenReenterRef.current) clearTimeout(fullscreenReenterRef.current);
    };
  }, [pendingStart, started, startTimer, handleViolation, isBlocked, lockExamKeyboard]);

  useEffect(() => {
    if (!started || isBlocked) return undefined;

    const recordTabLeave = () => {
      if (!startedRef.current || blockedRef.current || submittedRef.current) return;
      if (warningOpenRef.current) return;
      if (Date.now() < suppressVisibilityViolationsUntilRef.current) return;
      warningOpenRef.current = true;
      setShowTabWarning(true);
      handleViolation("tab");
    };

    const examTabIsHidden = () =>
      document.visibilityState === "hidden" || document.hidden === true;

    const handleVisibilityChange = () => {
      if (examTabIsHidden()) recordTabLeave();
    };

    const handlePageHide = () => recordTabLeave();

    const handleKeyDown = (e) => {
      const key = String(e.key || "");
      const combo = e.ctrlKey || e.metaKey || e.altKey;
      if (key === "Tab" && !combo) return;
      if (
        key === "Tab" ||
        (combo && ["Tab", "w", "W", "t", "T", "n", "N"].includes(key)) ||
        key === "F11"
      ) {
        e.preventDefault();
        e.stopPropagation();
        recordTabLeave();
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to leave? Your test progress may be lost.";
      return e.returnValue;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("webkitvisibilitychange", handleVisibilityChange);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("freeze", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    const poll = window.setInterval(() => {
      if (examTabIsHidden()) recordTabLeave();
    }, 400);

    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("webkitvisibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("freeze", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [started, handleViolation, isBlocked]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  useEffect(() => {
    if (!started || submittedRef.current) return;
    if (timeLeftMs === 0 && (Number(durationMinutes) || 0) > 0) {
      onTimeUpRef.current?.();
    }
  }, [timeLeftMs, started, durationMinutes]);

  const setOnTimeUp = useCallback((fn) => {
    onTimeUpRef.current = fn;
  }, []);

  const markSubmitted = useCallback(() => {
    submittedRef.current = true;
    stopTimer();
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [stopTimer]);

  return {
    started,
    acceptedRules,
    setAcceptedRules,
    pendingStart,
    startExam,
    isBlocked,
    blockReason,
    tabSwitchCount,
    showTabWarning,
    dismissTabWarning,
    timeLeftMs,
    formatTime: formatExamTime,
    requestFullscreen,
    markSubmitted,
    setOnTimeUp,
    resetSession,
    inFullscreen,
  };
}
