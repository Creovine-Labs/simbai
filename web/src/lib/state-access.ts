import { createHash, timingSafeEqual } from "node:crypto";
import {
  CLIENT_EVENT_TYPES,
  MAX_EVENTS_PER_LINK,
  isExpired,
  publicLink,
} from "./local-product";
import type {
  AppUser,
  ClientEventType,
  EventMetadata,
  FileAsset,
  LocalState,
  PublicShareLink,
  ShareLink,
  TrackingEvent,
} from "./local-product";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl?: string;
};

export function publicUser(user: AppUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
  };
}

/** Everything the dashboard is allowed to see, scoped to one owner. */
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

export type LinkValidation =
  | { ok: false; reason: string }
  | { ok: true; link: ShareLink; file: FileAsset };

export function validateShareLink(
  state: LocalState,
  token: string,
  now = new Date(),
): LinkValidation {
  const link = state.links.find((item) => item.token === token);
  if (!link) {
    return { ok: false, reason: "This share link was not found." };
  }

  const file = state.files.find((item) => item.id === link.fileId);
  if (!file) {
    return { ok: false, reason: "The file for this link is missing." };
  }

  if (!link.enabled) {
    return { ok: false, reason: "This share link is disabled." };
  }

  if (isExpired(link, now)) {
    return { ok: false, reason: "This share link has expired." };
  }

  return { ok: true, link, file };
}

/**
 * Identifies the password in force on a link. Stored on each viewer session so
 * that changing or removing the password revokes access already handed out.
 */
export function passwordFingerprint(password?: string) {
  return createHash("sha256")
    .update(`simbai-link-password-v1:${password ?? ""}`)
    .digest("hex");
}

export function verifyLinkPassword(link: ShareLink, supplied: string | undefined) {
  if (!link.password) return true;
  // Hash first so the comparison is over equal-length buffers and constant time.
  const expected = createHash("sha256").update(link.password).digest();
  const actual = createHash("sha256").update(supplied ?? "").digest();
  return timingSafeEqual(expected, actual);
}

export function isClientEventType(value: unknown): value is ClientEventType {
  return (
    typeof value === "string" &&
    (CLIENT_EVENT_TYPES as readonly string[]).includes(value)
  );
}

const MAX_METADATA_KEYS = 8;
const MAX_METADATA_VALUE_LENGTH = 120;

/** Viewer-supplied metadata is untrusted: drop anything unexpected or oversized. */
export function sanitizeEventMetadata(value: unknown): EventMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => /^[a-zA-Z0-9_]{1,32}$/.test(key))
    .slice(0, MAX_METADATA_KEYS)
    .flatMap<[string, string | number | boolean]>(([key, item]) => {
      if (typeof item === "string") {
        return [[key, item.slice(0, MAX_METADATA_VALUE_LENGTH)]];
      }
      if (typeof item === "boolean") return [[key, item]];
      if (typeof item === "number" && Number.isFinite(item)) return [[key, item]];
      return [];
    });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function normalizePageNumber(value: unknown, pageCount: number) {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
  if (value < 1 || value > pageCount) return undefined;
  return value;
}

/** Keeps the newest events for a link so the store cannot grow without bound. */
export function trimEventsForLink(
  events: TrackingEvent[],
  linkId: string,
  limit = MAX_EVENTS_PER_LINK,
): TrackingEvent[] {
  let kept = 0;
  return events.filter((event) => {
    if (event.linkId !== linkId) return true;
    kept += 1;
    return kept <= limit;
  });
}

export function publicLinkFor(link: ShareLink): PublicShareLink {
  return publicLink(link);
}
