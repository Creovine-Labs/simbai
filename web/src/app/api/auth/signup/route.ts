import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Use Firebase Auth, then POST the Firebase ID token to /api/auth/session." },
    { status: 410 },
  );
}
