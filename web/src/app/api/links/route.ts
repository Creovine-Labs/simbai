import { NextResponse } from "next/server";
import { filterStateForUser, requireCurrentUser } from "@/lib/auth-server";
import { createShareLink } from "@/lib/server-store";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = (await request.json()) as { fileId?: string };
    if (!body.fileId) {
      return NextResponse.json({ error: "fileId is required." }, { status: 400 });
    }

    const state = await createShareLink(body.fileId, user.id);
    return NextResponse.json(filterStateForUser(state, user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create link." },
      { status: 400 },
    );
  }
}
