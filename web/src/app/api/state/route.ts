import { NextResponse } from "next/server";
import { AuthenticationError, readSession, requireCurrentUser } from "@/lib/auth-server";
import { filterStateForUser } from "@/lib/state-access";
import { resetServerState } from "@/lib/server-store";
import { NO_STORE, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    // Single read, same as /api/auth/me.
    const { state, user } = await readSession();
    if (!user) throw new AuthenticationError();

    return NextResponse.json(filterStateForUser(state, user.id), {
      headers: NO_STORE,
    });
  } catch (error) {
    return errorResponse(error, "Could not read workspace.");
  }
}

export async function DELETE() {
  try {
    const user = await requireCurrentUser();
    const state = await resetServerState(user.id);
    return NextResponse.json(filterStateForUser(state, user.id), {
      headers: NO_STORE,
    });
  } catch (error) {
    return errorResponse(error, "Could not reset workspace.");
  }
}
