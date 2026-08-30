import { NextResponse } from "next/server";
import { filterStateForUser, requireCurrentUser } from "@/lib/auth-server";
import { updateShareLink } from "@/lib/server-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const state = await updateShareLink(id, await request.json(), user.id);
    return NextResponse.json(filterStateForUser(state, user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update link." },
      { status: 400 },
    );
  }
}
