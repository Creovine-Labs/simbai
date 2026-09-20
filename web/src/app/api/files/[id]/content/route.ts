import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readViewerGrant } from "@/lib/auth-server";
import {
  readFileContent,
  readServerState,
  resolveViewerGrant,
} from "@/lib/server-store";
import { contentDisposition } from "@/lib/file-type";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Share token is required." }, { status: 401 });
  }

  // Access rests on the viewer grant, which is only issued once the link's
  // password (if any) has been checked server-side.
  const sessionId = await readViewerGrant(token);
  const grant = resolveViewerGrant(await readServerState(), token, sessionId);

  if (!grant) {
    return NextResponse.json(
      { error: "This link is unavailable. Open it again to continue." },
      { status: 403 },
    );
  }

  if (grant.file.id !== id) {
    return NextResponse.json(
      { error: "File does not belong to this link." },
      { status: 403 },
    );
  }

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  if (wantsDownload && !grant.link.allowDownload) {
    return NextResponse.json(
      { error: "Downloads are disabled for this link." },
      { status: 403 },
    );
  }

  const content = await readFileContent(grant.file);
  if (!content) {
    return NextResponse.json({ error: "File content was not found." }, { status: 404 });
  }

  return new NextResponse(content.body, {
    headers: {
      "Content-Type": content.contentType,
      "Content-Disposition": contentDisposition(content.filename, wantsDownload),
      // The type was decided by sniffing the bytes at upload; forbid re-sniffing,
      // and sandbox the response so a stored file can never act as a document.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox; base-uri 'none'",
      "Cache-Control": "private, no-store",
    },
  });
}
