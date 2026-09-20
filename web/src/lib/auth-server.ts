import { cookies } from "next/headers";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { AppUser, LocalState, makeId } from "@/lib/local-product";
import { VerifiedFirebaseUser, verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { readServerState, writeServerState } from "@/lib/server-store";

const SESSION_COOKIE = "simbai_session";
const SESSION_DAYS = 14;

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};

export function publicUser(user: AppUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
}

export function filterStateForUser(state: LocalState, userId: string): LocalState {
  const files = state.files.filter((file) => file.ownerUserId === userId);
  const fileIds = new Set(files.map((file) => file.id));
  const links = state.links.filter(
    (link) => link.ownerUserId === userId && fileIds.has(link.fileId),
  );
  const linkIds = new Set(links.map((link) => link.id));
  const sessions = state.sessions.filter((session) => linkIds.has(session.linkId));
  const sessionIds = new Set(sessions.map((session) => session.id));

  return {
    ...state,
    users: [],
    authSessions: [],
    files,
    links,
    sessions,
    events: state.events.filter(
      (event) => linkIds.has(event.linkId) && sessionIds.has(event.sessionId),
    ),
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const state = await readServerState();
  const tokenHash = hashSessionToken(token);
  const session = state.authSessions.find(
    (item) => item.tokenHash === tokenHash && new Date(item.expiresAt) > new Date(),
  );

  if (!session) {
    return null;
  }

  return state.users.find((user) => user.id === session.userId) ?? null;
}

export async function createFirebaseSession(idToken: string) {
  const firebaseUser = await verifyFirebaseIdToken(idToken);
  const user = await upsertFirebaseUser(firebaseUser);
  await createSessionCookie(user.id);
  return publicUser(user);
}

export async function logoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const state = await readServerState();
    const tokenHash = hashSessionToken(token);
    await writeServerState({
      ...state,
      authSessions: state.authSessions.filter(
        (session) => session.tokenHash !== tokenHash,
      ),
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

async function createSessionCookie(userId: string) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const state = await readServerState();
  await writeServerState({
    ...state,
    authSessions: [
      {
        id: makeId("auth"),
        userId,
        tokenHash: hashSessionToken(token),
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      ...state.authSessions.filter((session) => new Date(session.expiresAt) > now),
    ],
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

function hashSessionToken(token: string) {
  return pbkdf2Sync(token, "simbai-session-v1", 80000, 32, "sha256").toString(
    "hex",
  );
}

async function upsertFirebaseUser(firebaseUser: VerifiedFirebaseUser) {
  const state = await readServerState();
  const now = new Date().toISOString();
  const existingUser = state.users.find(
    (user) => user.firebaseUid === firebaseUser.uid || user.email === firebaseUser.email,
  );

  if (existingUser) {
    const updatedUser: AppUser = {
      ...existingUser,
      id: existingUser.id,
      firebaseUid: firebaseUser.uid,
      name: firebaseUser.name,
      email: firebaseUser.email,
      avatarUrl: firebaseUser.picture,
      authProvider: "firebase",
      updatedAt: now,
    };

    await writeServerState({
      ...state,
      users: state.users.map((user) =>
        user.id === existingUser.id ? updatedUser : user,
      ),
    });

    return updatedUser;
  }

  const user: AppUser = {
    id: `firebase_${firebaseUser.uid}`,
    firebaseUid: firebaseUser.uid,
    name: firebaseUser.name,
    email: firebaseUser.email,
    avatarUrl: firebaseUser.picture,
    authProvider: "firebase",
    createdAt: now,
    updatedAt: now,
  };

  await writeServerState({
    ...state,
    users: [user, ...state.users],
  });

  return user;
}
