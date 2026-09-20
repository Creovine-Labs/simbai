import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth-server";
import { filterStateForUser } from "@/lib/state-access";
import { deleteShareLink, updateShareLink } from "@/lib/server-store";
import { NO_STORE, errorResponse } from "@/lib/api";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const state = await updateShareLink(id, await request.json(), user.id);
    return NextResponse.json(filterStateForUser(state, user.id), {
      headers: NO_STORE,
    });
  } catch (error) {
    return errorResponse(error, "Could not update link.");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const state = await deleteShareLink(id, user.id);
    return NextResponse.json(filterStateForUser(state, user.id), {
      headers: NO_STORE,
    });
  } catch (error) {
    return errorResponse(error, "Could not delete link.");
  }
}
