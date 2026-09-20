import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { makeId } from "@/lib/local-product";
import type { AppUser, LocalState } from "@/lib/local-product";
import { publicUser } from "@/lib/state-access";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import type { VerifiedFirebaseUser } from "@/lib/firebase-admin";
import { mutateState, readServerState } from "@/lib/server-store";

export const SESSION_COOKIE = "simbai_session";
const SESSION_DAYS = 14;
const VIEWER_COOKIE_PREFIX = "simbai_view_";

/**
 * The session token is 32 bytes of CSPRNG output, so there is nothing to
 * brute-force and no reason to key-stretch. A single SHA-256 keeps lookups off
 * the critical path — this runs on every authenticated request.
 */
function hashSessionToken(token: string) {
  return createHash("sha256")
    .update(`simbai-session-v1:${token}`)
    .digest("hex");
}

/** Resolves a session cookie against an already-loaded state. No store read. */
export function userFromState(state: LocalState, token: string | undefined) {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const session = state.authSessions.find(
    (item) => item.tokenHash === tokenHash && new Date(item.expiresAt) > now,
  );

  if (!session) return null;
  return state.users.find((user) => user.id === session.userId) ?? null;
}

/**
 * One store read for both the session and the workspace. The dashboard polls
 * this constantly, and the store bills per read, so loading it twice per
 * request was the single largest source of traffic.
 */
export async function readSession(): Promise<{
  state: LocalState;
  user: AppUser | null;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const state = await readServerState();
  return { state, user: userFromState(state, token) };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  return (await readSession()).user;
}

export async function requireCurrentUser(): Promise<AppUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}

export class AuthenticationError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationError";
  }
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
    const tokenHash = hashSessionToken(token);
    await mutateState((state) => [
      {
        ...state,
        authSessions: state.authSessions.filter(
          (session) => session.tokenHash !== tokenHash,
        ),
      },
      undefined,
    ]);
  }

  cookieStore.delete(SESSION_COOKIE);
}

async function createSessionCookie(userId: string) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await mutateState((state) => [
    {
      ...state,
      authSessions: [
        {
          id: makeId("auth"),
          userId,
          tokenHash: hashSessionToken(token),
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
        ...state.authSessions.filter(
          (session) => new Date(session.expiresAt) > now,
        ),
      ],
    },
    undefined,
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Accounts are keyed on the Firebase UID alone. Linking on a matching email
 * would let anyone who registers an unverified address inherit the existing
 * account that owns it.
 */
async function upsertFirebaseUser(
  firebaseUser: VerifiedFirebaseUser,
): Promise<AppUser> {
  return mutateState((state) => {
    const now = new Date().toISOString();
    const existing = state.users.find(
      (user) => user.firebaseUid === firebaseUser.uid,
    );

    if (existing) {
      const updated: AppUser = {
        ...existing,
        // A name the user set in their profile survives later sign-ins.
        name: existing.nameIsCustom ? existing.name : firebaseUser.name,
        email: firebaseUser.email,
        emailVerified: firebaseUser.emailVerified,
        avatarUrl: firebaseUser.picture,
        updatedAt: now,
      };

      return [
        {
          ...state,
          users: state.users.map((user) =>
            user.id === existing.id ? updated : user,
          ),
        },
        updated,
      ];
    }

    const emailOwner = state.users.find(
      (user) => user.email === firebaseUser.email,
    );

    if (emailOwner) {
      throw new Error(
        "An account already exists for this email address. Sign in with the method you used originally.",
      );
    }

    const user: AppUser = {
      id: `firebase_${firebaseUser.uid}`,
      firebaseUid: firebaseUser.uid,
      name: firebaseUser.name,
      email: firebaseUser.email,
      emailVerified: firebaseUser.emailVerified,
      avatarUrl: firebaseUser.picture,
      createdAt: now,
      updatedAt: now,
    };

    return [{ ...state, users: [user, ...state.users] }, user];
  });
}

/* -------------------------------------------------------------------------- */
/* Viewer grants                                                              */
/* -------------------------------------------------------------------------- */

function viewerCookieName(token: string) {
  // The token comes from the URL, so it is constrained before it names a cookie.
  if (!/^[A-Za-z0-9_]{1,64}$/.test(token)) return null;
  return `${VIEWER_COOKIE_PREFIX}${token}`;
}

/** Reads the grant proving this browser passed the link's password check. */
export async function readViewerGrant(token: string) {
  const name = viewerCookieName(token);
  if (!name) return undefined;
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

export async function setViewerGrant(token: string, sessionId: string) {
  const name = viewerCookieName(token);
  if (!name) return;
  const cookieStore = await cookies();
  cookieStore.set(name, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export { publicUser };
