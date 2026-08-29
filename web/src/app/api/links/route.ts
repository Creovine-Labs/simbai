import { NextResponse } from "next/server";
import { createShareLink } from "@/lib/server-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { fileId?: string };
    if (!body.fileId) {
      return NextResponse.json({ error: "fileId is required." }, { status: 400 });
    }

    return NextResponse.json(await createShareLink(body.fileId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create link." },
      { status: 400 },
    );
  }
}
