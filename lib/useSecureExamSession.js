"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAppleMobileDevice } from "@/lib/deviceDetect";

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

  const requestFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return false;
    if (isAppleMobileDevice()) return false;
    const el = document.documentElement;
    if (document.fullscreenElement) return true;
    if (!el?.requestFullscreen) return false;
    suppressVisibilityViolationsUntilRef.current = Date.now() + 4000;
    try {
      await el.requestFullscreen();
      setInFullscreen(true);
      return true;
    } catch {
      return false;
    }
  }, []);

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
    suppressVisibilityViolationsUntilRef.current = Date.now() + 800;
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
      setPendingStart(false);
      setStarted(true);
      startTimer();
      return true;
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
        suppressVisibilityViolationsUntilRef.current = Date.now() + 3500;
      }
      if (pendingStart && document.fullscreenElement) {
        setPendingStart(false);
        setStarted(true);
        tabSwitchCountRef.current = 0;
        setTabSwitchCount(0);
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
              suppressVisibilityViolationsUntilRef.current = Date.now() + 4000;
              el.requestFullscreen().catch(() => {});
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
  }, [pendingStart, started, startTimer, handleViolation, isBlocked]);

  useEffect(() => {
    if (!started || isBlocked) return undefined;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setShowTabWarning(false);
        return;
      }
      if (Date.now() < suppressVisibilityViolationsUntilRef.current) return;
      setShowTabWarning(true);
      handleViolation("tab");
    };

    const handleKeyDown = (e) => {
      if (
        (e.altKey && e.key === "Tab") ||
        (e.ctrlKey && (e.key === "Tab" || e.key === "w" || e.key === "W")) ||
        e.key === "F11"
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation("tab");
        return false;
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
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
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
