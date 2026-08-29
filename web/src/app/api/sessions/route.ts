import { NextResponse } from "next/server";
import { createViewerSession } from "@/lib/server-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    token?: string;
    userAgent?: string;
    viewport?: string;
  };

  if (!body.token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }

  const result = await createViewerSession(
    body.token,
    body.userAgent ?? "",
    body.viewport ?? "",
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
