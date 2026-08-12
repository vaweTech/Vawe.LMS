/** Local calendar date as YYYY-MM-DD (for HTML date inputs). */
export function getLocalTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateInputValue(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.trim().split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function startOfLocalDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** True when date is today or earlier (no tomorrow / future). */
export function isDateOfBirthAllowed(value) {
  const date = parseDateInputValue(value);
  if (!date) return false;
  const today = startOfLocalDay(new Date());
  const picked = startOfLocalDay(date);
  return picked <= today;
}

/** True when date is today or later (no yesterday / past). */
export function isDateOfJoiningAllowed(value) {
  const date = parseDateInputValue(value);
  if (!date) return false;
  const today = startOfLocalDay(new Date());
  const picked = startOfLocalDay(date);
  return picked >= today;
}

export function validateDateOfBirth(value) {
  if (!value) {
    return { valid: false, message: "Date of Birth is required." };
  }
  if (!isDateOfBirthAllowed(value)) {
    return {
      valid: false,
      message:
        "Date of Birth cannot be tomorrow or a future date. Please select today or an earlier date.",
    };
  }
  return { valid: true };
}

export function validateDateOfJoining(value) {
  if (!value) {
    return { valid: false, message: "Date of Joining is required." };
  }
  if (!isDateOfJoiningAllowed(value)) {
    return {
      valid: false,
      message:
        "Date of Joining cannot be yesterday or a past date. Please select today or a future date.",
    };
  }
  return { valid: true };
}
