import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth-server";
import { filterStateForUser } from "@/lib/state-access";
import { readServerState, resetServerState } from "@/lib/server-store";
import { NO_STORE, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const state = await readServerState();
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
