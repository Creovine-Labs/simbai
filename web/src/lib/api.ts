import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth-server";

/**
 * Turns a thrown error into a response. Only messages we raise deliberately are
 * echoed back; anything unexpected is logged and reported generically.
 */
export function errorResponse(error: unknown, fallback: string, status = 400) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
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
