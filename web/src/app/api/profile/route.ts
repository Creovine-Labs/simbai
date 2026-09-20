import { NextResponse } from "next/server";
import { publicUser, requireCurrentUser } from "@/lib/auth-server";
import {
  removeUserAvatar,
  setUserAvatar,
  updateUserName,
} from "@/lib/server-store";
import { NO_STORE, errorResponse } from "@/lib/api";

/** Update the display name. */
export async function PATCH(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = (await request.json()) as { name?: unknown };
    const updated = await updateUserName(user.id, body.name);
    return NextResponse.json({ user: publicUser(updated) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Could not update your profile.");
  }
}

/** Replace the profile picture. */
export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const formData = await request.formData();
    const avatar = formData.get("avatar");

    if (!(avatar instanceof File)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }

    const updated = await setUserAvatar(user.id, avatar);
    return NextResponse.json({ user: publicUser(updated) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Could not save your profile picture.");
  }
}

/** Fall back to whatever the identity provider supplies. */
export async function DELETE() {
  try {
    const user = await requireCurrentUser();
    const updated = await removeUserAvatar(user.id);
    return NextResponse.json({ user: publicUser(updated) }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, "Could not remove your profile picture.");
  }
}
