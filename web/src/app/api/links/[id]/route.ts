import { NextResponse } from "next/server";
import { updateShareLink } from "@/lib/server-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await updateShareLink(id, await request.json()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update link." },
      { status: 400 },
    );
  }
}
