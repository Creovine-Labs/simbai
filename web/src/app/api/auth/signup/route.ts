import { NextResponse } from "next/server";
import { signUpUser } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    return NextResponse.json({ user: await signUpUser(await request.json()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signup failed." },
      { status: 400 },
    );
  }
}
