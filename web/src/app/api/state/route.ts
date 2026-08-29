import { NextResponse } from "next/server";
import { readServerState, resetServerState } from "@/lib/server-store";

export async function GET() {
  return NextResponse.json(await readServerState());
}

export async function DELETE() {
  return NextResponse.json(await resetServerState());
}
