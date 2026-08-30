import { NextRequest, NextResponse } from "next/server";
import {
  readFileContent,
  readServerState,
  validateShareLink,
} from "@/lib/server-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Share token is required." }, { status: 401 });
  }

  const state = await readServerState();
  const validation = validateShareLink(state, token);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 403 });
  }

  if (validation.file.id !== id) {
    return NextResponse.json({ error: "File does not belong to this link." }, { status: 403 });
  }

  const content = await readFileContent(id);
  if (!content) {
    return NextResponse.json({ error: "File content was not found." }, { status: 404 });
  }

  return new Response(content.stream, {
    headers: {
      "Content-Disposition": `inline; filename="${content.filename.replaceAll('"', "")}"`,
      "Content-Type": content.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
