import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth-server";
import { filterStateForUser } from "@/lib/state-access";
import { createShareLink } from "@/lib/server-store";
import { NO_STORE, errorResponse } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = (await request.json()) as { fileId?: unknown };

    if (typeof body.fileId !== "string" || !body.fileId) {
      return NextResponse.json({ error: "fileId is required." }, { status: 400 });
    }

    const state = await createShareLink(body.fileId, user.id);
    return NextResponse.json(filterStateForUser(state, user.id), {
      headers: NO_STORE,
    });
  } catch (error) {
    return errorResponse(error, "Could not create link.");
  }
}
