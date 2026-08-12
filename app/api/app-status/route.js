import { NextResponse } from "next/server";
import {
  adminDb,
  readDocumentViaRest,
  writeDocumentViaRest,
} from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readDisabledFlag() {
  try {
    if (adminDb) {
      const snap = await adminDb.collection("appConfig").doc("runtime").get();
      if (!snap.exists) {
        return { disabled: false, updatedAt: null, updatedBy: null };
      }
      const data = snap.data() || {};
      return {
        disabled: Boolean(data.disabled),
        updatedAt: data.updatedAt || null,
        updatedBy: data.updatedBy || null,
      };
    }
  } catch (e) {
    console.warn("app-status Admin SDK read failed, trying REST:", e?.message || e);
  }

  try {
    const data = await readDocumentViaRest("appConfig", "runtime");
    if (!data) {
      return { disabled: false, updatedAt: null, updatedBy: null };
    }
    return {
      disabled: Boolean(data.disabled),
      updatedAt: data.updatedAt || null,
      updatedBy: data.updatedBy || null,
    };
  } catch (e) {
    console.error("app-status REST read failed:", e);
    return { disabled: false, updatedAt: null, updatedBy: null };
  }
}

async function writeDisabledFlag(disabled, updatedBy = "vawemap") {
  const payload = {
    disabled: Boolean(disabled),
    updatedAt: new Date().toISOString(),
    updatedBy: String(updatedBy || "vawemap").trim() || "vawemap",
  };

  try {
    if (adminDb) {
      await adminDb.collection("appConfig").doc("runtime").set(payload, { merge: true });
      return payload;
    }
  } catch (e) {
    console.warn("app-status Admin SDK write failed, trying REST:", e?.message || e);
  }

  await writeDocumentViaRest("appConfig", "runtime", payload);
  return payload;
}

export async function GET() {
  try {
    const status = await readDisabledFlag();
    return NextResponse.json(
      {
        disabled: status.disabled,
        updatedAt: status.updatedAt,
        updatedBy: status.updatedBy,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    console.error("app-status GET error:", e);
    return NextResponse.json(
      { disabled: false },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

/** Public POST — used by /Admin/vawemap without login. */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.disabled !== "boolean") {
      return NextResponse.json(
        { error: "Body must include boolean `disabled`." },
        { status: 400 }
      );
    }
    const payload = await writeDisabledFlag(body.disabled, body.updatedBy || "vawemap");
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    console.error("app-status POST error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to update app status." },
      { status: 500 }
    );
  }
}
