import { NextResponse } from "next/server";
import { readShareSnapshot } from "@/lib/server-store";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { NO_STORE, errorResponse } from "@/lib/api";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const limit = rateLimit(clientKey(request, "share"), 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, reason: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const { token } = await context.params;

  try {
    const snapshot = await readShareSnapshot(token);
    return NextResponse.json(snapshot, {
      status: snapshot.ok ? 200 : 403,
      headers: NO_STORE,
    });
  } catch (error) {
    // A store outage must not read as "this link does not exist".
    return errorResponse(error, "Could not open this link right now.");
  }
}
