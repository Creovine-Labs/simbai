import { NextResponse } from "next/server";
import { createFirebaseSession } from "@/lib/auth-server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { NO_STORE } from "@/lib/api";

// A Firebase ID token is a JWT; anything much larger is not worth verifying.
const MAX_ID_TOKEN_LENGTH = 4096;

export async function POST(request: Request) {
  // Verification costs an RSA check, so cap how often one caller can ask.
  const limit = rateLimit(clientKey(request, "session"), 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const body = (await request.json()) as { idToken?: unknown };

    if (typeof body.idToken !== "string" || !body.idToken) {
      return NextResponse.json(
        { error: "Firebase ID token is required." },
        { status: 400 },
      );
    }

    if (body.idToken.length > MAX_ID_TOKEN_LENGTH) {
      return NextResponse.json(
        { error: "Firebase ID token is malformed." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { user: await createFirebaseSession(body.idToken) },
      { headers: NO_STORE },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create Firebase session.",
      },
      { status: 401 },
    );
  }
}
