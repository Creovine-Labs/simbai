import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth-server";
import { StoreUnavailableError } from "@/lib/server-store";

/**
 * Turns a thrown error into a response. Only messages we raise deliberately are
 * echoed back; anything unexpected is logged and reported generically.
 */
export function errorResponse(error: unknown, fallback: string, status = 400) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // 503, never 401: a store outage must not look like a signed-out session.
  if (error instanceof StoreUnavailableError) {
    console.error("Data store unavailable", error.cause);
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error("Unhandled route error", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
} as const;
