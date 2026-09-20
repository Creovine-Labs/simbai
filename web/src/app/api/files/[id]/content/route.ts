import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser, readViewerGrant } from "@/lib/auth-server";
import {
  findOwnedFile,
  readFileContent,
  readServerState,
  resolveViewerGrant,
} from "@/lib/server-store";
import { contentDisposition } from "@/lib/file-type";
import type { FileAsset } from "@/lib/local-product";

type Access = { file: FileAsset; allowDownload: boolean };

/**
 * Two ways in, and only two: a viewer grant tied to a share token, or the
 * owner's own session. Owners need this so they can preview what they sent.
 */
async function authorize(
  request: NextRequest,
  fileId: string,
): Promise<Access | null> {
  const token = request.nextUrl.searchParams.get("token");

  if (token) {
    const sessionId = await readViewerGrant(token);
    const grant = resolveViewerGrant(await readServerState(), token, sessionId);

    if (!grant || grant.file.id !== fileId) return null;
    return { file: grant.file, allowDownload: grant.link.allowDownload };
  }

  const user = await getCurrentUser();
  if (!user) return null;

  const file = await findOwnedFile(fileId, user.id);
  if (!file) return null;

  // It is their own document, so the per-link download switch does not apply.
  return { file, allowDownload: true };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await authorize(request, id);

  if (!access) {
    return NextResponse.json(
      { error: "This file is unavailable. Open the link again to continue." },
      { status: 403 },
    );
  }

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  if (wantsDownload && !access.allowDownload) {
    return NextResponse.json(
      { error: "Downloads are disabled for this link." },
      { status: 403 },
    );
  }

  const content = await readFileContent(access.file);
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
