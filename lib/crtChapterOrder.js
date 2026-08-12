/** Sort CRT course chapters by their `order` field (numeric). */
export function sortChaptersByOrder(chapters) {
  return [...chapters].sort(
    (a, b) => Number(a.order || 0) - Number(b.order || 0)
  );
}

/** True when chapter orders are not exactly 1, 2, 3, … */
export function chaptersNeedRenumbering(chapters) {
  const sorted = sortChaptersByOrder(chapters);
  return sorted.some((ch, index) => Number(ch.order) !== index + 1);
}

/**
 * Build map of old order → new order for chapters that must change.
 * @returns {Map<number, number>}
 */
export function buildChapterOrderRemap(chapters) {
  const sorted = sortChaptersByOrder(chapters);
  const remap = new Map();
  sorted.forEach((ch, index) => {
    const oldOrder = Number(ch.order) || index + 1;
    const newOrder = index + 1;
    if (oldOrder !== newOrder) {
      remap.set(oldOrder, newOrder);
    }
  });
  return remap;
}

/**
 * Persist sequential orders 1..n for all chapters.
 * @param {Array} chapters - chapter objects with `id`
 * @param {(id: string, newOrder: number) => Promise<void>} updateOrder
 * @returns {Promise<Array>} chapters with updated `order` in memory
 */
export async function renumberChaptersSequential(chapters, updateOrder) {
  const sorted = sortChaptersByOrder(chapters);
  await Promise.all(
    sorted.map((ch, index) => {
      const newOrder = index + 1;
      if (Number(ch.order) === newOrder) return Promise.resolve();
      return updateOrder(ch.id, newOrder);
    })
  );
  return sorted.map((ch, index) => ({ ...ch, order: index + 1 }));
}

/**
 * Rewrite "Day N" in progress-test title to the new day number.
 * e.g. "Day 9 MCQ Test" → "Day 8 MCQ Test"
 * Custom titles without a leading "Day N" are left unchanged.
 */
export function rewriteProgressTestTitle(title, newDay) {
  const nextDay = Number(newDay) || 1;
  const raw = typeof title === "string" ? title.trim() : "";
  if (!raw) {
    return `Day ${nextDay} Test`;
  }
  if (/^day\s+\d+/i.test(raw)) {
    return raw.replace(/^day\s+\d+/i, `Day ${nextDay}`);
  }
  return raw;
}

/**
 * After deleting a day, shift progress tests: remove tests on deleted day,
 * decrement day for tests after the deleted day (and update titles).
 */
export async function remapProgressTestsAfterDayDelete(
  tests,
  deletedOrder,
  { deleteTest, updateTestDay }
) {
  if (!deletedOrder || deletedOrder < 1) return;
  await Promise.all(
    tests.map((test) => {
      const day = Number(test.day) || 1;
      if (day === deletedOrder) {
        return deleteTest(test.id);
      }
      if (day > deletedOrder) {
        const newDay = day - 1;
        return updateTestDay(
          test.id,
          newDay,
          rewriteProgressTestTitle(test.title, newDay)
        );
      }
      return Promise.resolve();
    })
  );
}

/**
 * When chapter orders are renumbered (gap fix), remap test `day` + title via order map.
 */
export async function remapProgressTestsByOrderMap(tests, orderRemap, { updateTestDay }) {
  if (!orderRemap?.size) return;
  await Promise.all(
    tests.map((test) => {
      const day = Number(test.day) || 1;
      if (orderRemap.has(day)) {
        const newDay = orderRemap.get(day);
        return updateTestDay(
          test.id,
          newDay,
          rewriteProgressTestTitle(test.title, newDay)
        );
      }
      return Promise.resolve();
    })
  );
}

/**
 * Heal titles that still say the wrong day (e.g. badge Day 8 / title "Day 9 MCQ Test").
 * Only updates when title starts with "Day <n>" and n !== stored day.
 */
export async function healProgressTestTitles(tests, { updateTest }) {
  if (!Array.isArray(tests) || tests.length === 0 || !updateTest) return tests;
  const updated = [];
  await Promise.all(
    tests.map(async (test) => {
      const day = Number(test.day) || 1;
      const raw = typeof test.title === "string" ? test.title.trim() : "";
      const match = raw.match(/^day\s+(\d+)/i);
      if (!match || Number(match[1]) === day) {
        updated.push(test);
        return;
      }
      const nextTitle = rewriteProgressTestTitle(raw, day);
      await updateTest(test.id, { title: nextTitle });
      updated.push({ ...test, title: nextTitle });
    })
  );
  return updated;
}
