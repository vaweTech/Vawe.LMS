/** Detect Apple phones/tablets where the Fullscreen API is unavailable for normal web pages. */
export function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}
