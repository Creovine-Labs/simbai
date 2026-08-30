import { cookies } from "next/headers";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { AppUser, LocalState, makeId } from "@/lib/local-product";
import { readServerState, writeServerState } from "@/lib/server-store";

const SESSION_COOKIE = "simbai_session";
const SESSION_DAYS = 14;

export type PublicUser = {
  id: string;
  name: string;
  email: string;
};

export function publicUser(user: AppUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
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

export async function signUpUser({
  email,
  name,
  password,
}: {
  email: string;
  name: string;
  password: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !name.trim() || password.length < 8) {
    throw new Error("Use a name, valid email, and password of at least 8 characters.");
  }

  const state = await readServerState();
  if (state.users.some((user) => user.email === normalizedEmail)) {
    throw new Error("An account with this email already exists.");
  }

  const passwordSalt = randomBytes(16).toString("hex");
  const user: AppUser = {
    id: makeId("user"),
    name: name.trim(),
    email: normalizedEmail,
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
    createdAt: new Date().toISOString(),
  };

  const nextState = {
    ...state,
    users: [user, ...state.users],
  };

  await writeServerState(nextState);
  await createSessionCookie(user.id);
  return publicUser(user);
}

export async function loginUser({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const state = await readServerState();
  const user = state.users.find(
    (item) => item.email === email.trim().toLowerCase(),
  );

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    throw new Error("Email or password is incorrect.");
  }

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

function hashPassword(password: string, salt: string) {
  return pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
}

function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashSessionToken(token: string) {
  return pbkdf2Sync(token, "simbai-session-v1", 80000, 32, "sha256").toString(
    "hex",
  );
}
