import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MCQ_PROJECT_ID = "questions-for-lms";
const MCQ_API_KEY = "AIzaSyDnrfMoTNMlghOiQ3hzevfTAKJpUaeC7yA";

function parseFirestoreField(field) {
  if (!field || typeof field !== "object") return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return Number(field.doubleValue);
  if ("booleanValue" in field) return field.booleanValue;
  return undefined;
}

function mapFirestoreDoc(doc) {
  const id = String(doc?.name || "").split("/").pop();
  const fields = doc?.fields || {};
  return {
    id,
    slug: id,
    label: parseFirestoreField(fields.label) || id.replace(/_/g, " ").toUpperCase(),
    order: Number(parseFirestoreField(fields.order) || 0),
  };
}

async function countTestsForGroup(slug) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${MCQ_PROJECT_ID}` +
    `/databases/(default)/documents/mockTests/${encodeURIComponent(slug)}/tests` +
    `?key=${MCQ_API_KEY}&pageSize=1`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data?.documents) ? data.documents.length : 0;
  } catch {
    return 0;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyWithTests = searchParams.get("withTests") === "1";

    const url =
      `https://firestore.googleapis.com/v1/projects/${MCQ_PROJECT_ID}` +
      `/databases/(default)/documents/mockTests?key=${MCQ_API_KEY}&pageSize=100`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Mock test groups REST error:", res.status, text);
      return NextResponse.json([], {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    const data = await res.json();
    let groups = (Array.isArray(data?.documents) ? data.documents : [])
      .map(mapFirestoreDoc)
      .filter((g) => g.id);

    if (onlyWithTests) {
      const counted = await Promise.all(
        groups.map(async (g) => {
          const testCount = await countTestsForGroup(g.slug);
          return { ...g, testCount };
        })
      );
      // Keep group if it has ≥1 test, OR if count failed (unknown) — but hide zero-test groups.
      // Note: pageSize=1 only tells us "has at least one", not exact count.
      groups = counted.filter((g) => (g.testCount || 0) > 0);
    }

    groups.sort((a, b) => {
      const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });

    return NextResponse.json(groups, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    console.error("Mock test groups API error:", e);
    return NextResponse.json([], {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
