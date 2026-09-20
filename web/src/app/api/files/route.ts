import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth-server";
import { filterStateForUser } from "@/lib/state-access";
import { addUploadedFiles } from "@/lib/server-store";
import { NO_STORE, errorResponse } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const formData = await request.formData();
    const uploads = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);

    const state = await addUploadedFiles(uploads, user.id);
    return NextResponse.json(filterStateForUser(state, user.id), {
      headers: NO_STORE,
    });
  } catch (error) {
    return errorResponse(error, "Upload failed.");
  }
}
