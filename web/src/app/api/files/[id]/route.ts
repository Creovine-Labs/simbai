import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth-server";
import { findOwnedFile } from "@/lib/server-store";
import { NO_STORE, errorResponse } from "@/lib/api";

/** Metadata an owner needs to render the preview of their own document. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const file = await findOwnedFile(id, user.id);

    if (!file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        file: {
          id: file.id,
          name: file.name,
          kind: file.kind,
          type: file.type,
          size: file.size,
          pageCount: file.pageCount,
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return errorResponse(error, "Could not read that document.");
  }
}
