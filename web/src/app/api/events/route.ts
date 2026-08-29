import { NextResponse } from "next/server";
import { TrackingEvent } from "@/lib/local-product";
import { addTrackingEvent } from "@/lib/server-store";

export async function POST(request: Request) {
  const event = (await request.json()) as Omit<TrackingEvent, "id" | "occurredAt">;

  if (!event.linkId || !event.fileId || !event.sessionId || !event.eventType) {
    return NextResponse.json({ error: "Invalid event payload." }, { status: 400 });
  }

  return NextResponse.json(await addTrackingEvent(event));
}
