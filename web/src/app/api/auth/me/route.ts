import { NextResponse } from "next/server";
import {
  filterStateForUser,
  getCurrentUser,
  publicUser,
} from "@/lib/auth-server";
import { readServerState } from "@/lib/server-store";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ user: null, state: null }, { status: 401 });
  }

  const state = await readServerState();
  return NextResponse.json({
    user: publicUser(user),
    state: filterStateForUser(state, user.id),
  });
}
