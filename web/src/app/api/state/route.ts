import { NextResponse } from "next/server";
import { filterStateForUser, requireCurrentUser } from "@/lib/auth-server";
import { readServerState, resetServerState } from "@/lib/server-store";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    return NextResponse.json(filterStateForUser(await readServerState(), user.id));
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const user = await requireCurrentUser();
    return NextResponse.json(filterStateForUser(await resetServerState(user.id), user.id));
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
}
