import { NextResponse } from "next/server";
import { createFirebaseSession } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { idToken?: string };

    if (!body.idToken) {
      return NextResponse.json({ error: "Firebase ID token is required." }, { status: 400 });
    }

    return NextResponse.json({ user: await createFirebaseSession(body.idToken) });
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
