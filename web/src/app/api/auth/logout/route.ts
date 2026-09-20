import { NextResponse } from "next/server";
import { logoutUser } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api";

export async function POST() {
  try {
    await logoutUser();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Could not sign you out.");
  }
}
