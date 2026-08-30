import { NextResponse } from "next/server";
import { filterStateForUser, requireCurrentUser } from "@/lib/auth-server";
import { addUploadedFile } from "@/lib/server-store";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const formData = await request.formData();
    const uploads = formData.getAll("files").filter((item) => item instanceof File);

    if (uploads.length === 0) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    let state;
    for (const file of uploads) {
      state = await addUploadedFile(file, user.id);
    }

    return NextResponse.json(filterStateForUser(state!, user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
