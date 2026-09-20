import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/auth-server";
import { filterStateForUser } from "@/lib/state-access";
import { readServerState } from "@/lib/server-store";
import { NO_STORE } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { user: null, state: null },
      { status: 401, headers: NO_STORE },
    );
  }

  const state = await readServerState();
  return NextResponse.json(
    { user: publicUser(user), state: filterStateForUser(state, user.id) },
    { headers: NO_STORE },
  );
}
