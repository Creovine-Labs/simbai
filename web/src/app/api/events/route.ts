import { NextResponse } from "next/server";
import { readViewerGrant } from "@/lib/auth-server";
import { recordViewerEvent } from "@/lib/server-store";
import { isClientEventType, sanitizeEventMetadata } from "@/lib/state-access";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { NO_STORE, errorResponse } from "@/lib/api";

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "events"), 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many events." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = (await request.json()) as {
    token?: unknown;
    eventType?: unknown;
    pageNumber?: unknown;
    metadata?: unknown;
  };

  if (typeof body.token !== "string" || !body.token) {
    return NextResponse.json({ ok: false, error: "token is required." }, { status: 400 });
  }

  if (!isClientEventType(body.eventType)) {
    return NextResponse.json(
      { ok: false, error: "Unsupported event type." },
      { status: 400 },
    );
  }

  // The grant cookie, not the request body, decides which link this belongs to.
  const sessionId = await readViewerGrant(body.token);
  if (!sessionId) {
    return NextResponse.json({ ok: false }, { status: 403, headers: NO_STORE });
  }

  try {
    const ok = await recordViewerEvent({
      token: body.token,
      sessionId,
      eventType: body.eventType,
      pageNumber: body.pageNumber,
      metadata: sanitizeEventMetadata(body.metadata),
    });

    return NextResponse.json({ ok }, { status: ok ? 200 : 403, headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Could not record that event.");
  }
}
