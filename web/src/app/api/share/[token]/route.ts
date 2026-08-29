import { NextResponse } from "next/server";
import { readServerState, validateShareLink } from "@/lib/server-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const state = await readServerState();
  const validation = validateShareLink(state, token);
  return NextResponse.json(validation, { status: validation.ok ? 200 : 403 });
}
