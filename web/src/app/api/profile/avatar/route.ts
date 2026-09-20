import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth-server";
import { readUserAvatar } from "@/lib/server-store";
import { contentDisposition } from "@/lib/file-type";
import { errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const avatar = await readUserAvatar(user);

    if (!avatar) {
      return NextResponse.json({ error: "No profile picture set." }, { status: 404 });
    }

    return new NextResponse(avatar.body, {
      headers: {
        "Content-Type": avatar.contentType,
        "Content-Disposition": contentDisposition("avatar", false),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox; base-uri 'none'",
        // Private to this user, but the ?v= query lets a new upload bust it.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return errorResponse(error, "Could not read your profile picture.");
  }
}
