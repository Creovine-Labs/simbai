import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    return NextResponse.json({ user: await loginUser(await request.json()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 401 },
    );
  }
}
