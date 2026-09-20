import { NextResponse } from "next/server";
import { readViewerGrant, setViewerGrant } from "@/lib/auth-server";
import { openViewerSession, touchViewerSession } from "@/lib/server-store";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { NO_STORE, errorResponse } from "@/lib/api";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    token?: unknown;
    password?: unknown;
    userAgent?: unknown;
    viewport?: unknown;
  };

  if (typeof body.token !== "string" || !body.token) {
    return NextResponse.json({ ok: false, reason: "token is required." }, { status: 400 });
  }

  // Password attempts are limited per link so a share token cannot be brute-forced.
  const limit = rateLimit(`${clientKey(request, "viewer")}:${body.token}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, reason: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const result = await openViewerSession({
      token: body.token,
      password: typeof body.password === "string" ? body.password : undefined,
      userAgent:
        typeof body.userAgent === "string"
          ? body.userAgent
          : request.headers.get("user-agent") ?? "",
      viewport: typeof body.viewport === "string" ? body.viewport : "",
    });

    if (result.ok) {
      await setViewerGrant(body.token, result.session.id);
    }

    return NextResponse.json(result, {
      status: result.ok ? 200 : 403,
      headers: NO_STORE,
    });
  } catch (error) {
    return errorResponse(error, "Could not open this link right now.");
  }
}

/** Presence ping. Keeps "viewing now" current without recording an event. */
export async function PATCH(request: Request) {
  const body = (await request.json()) as { token?: unknown };

  if (typeof body.token !== "string" || !body.token) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const sessionId = await readViewerGrant(body.token);
  if (!sessionId) {
    return NextResponse.json({ ok: false }, { status: 403, headers: NO_STORE });
  }

  try {
    const ok = await touchViewerSession(body.token, sessionId);
    return NextResponse.json({ ok }, { status: ok ? 200 : 403, headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Could not record presence.");
  }
}
