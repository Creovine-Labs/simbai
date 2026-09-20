import { NextResponse } from "next/server";
import { publicUser, readSession } from "@/lib/auth-server";
import { filterStateForUser } from "@/lib/state-access";
import { NO_STORE, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    // One store read serves both the session check and the workspace.
    const { state, user } = await readSession();

    if (!user) {
      return NextResponse.json(
        { user: null, state: null },
        { status: 401, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      { user: publicUser(user), state: filterStateForUser(state, user.id) },
      { headers: NO_STORE },
    );
  } catch (error) {
    return errorResponse(error, "Could not load your workspace.");
  }
}
