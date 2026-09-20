export type FileKind = "pdf" | "image";

export type FileAsset = {
  id: string;
  ownerUserId?: string;
  name: string;
  type: string;
  kind: FileKind;
  size: number;
  /** Key inside the active content store (Vercel Blob, or `.data/` on disk). */
  storagePath?: string;
  /** Legacy fields kept so state written by earlier builds still resolves. */
  dataUrl?: string;
  blobPath?: string;
  pageCount: number;
  createdAt: string;
};

export type ShareLink = {
  id: string;
  ownerUserId?: string;
  fileId: string;
  token: string;
  title: string;
  enabled: boolean;
  password?: string;
  expiresAt?: string;
  allowDownload: boolean;
  createdAt: string;
};

/** A link as the viewer is allowed to see it: never carries the password. */
export type PublicShareLink = Omit<ShareLink, "password" | "ownerUserId"> & {
  passwordRequired: boolean;
};

export type ViewerEventType =
  | "link_opened"
  | "viewer_started"
  | "page_viewed"
  | "download_clicked"
  | "viewer_closed"
  | "link_blocked";

/** Event types a viewer client is allowed to report. The rest are server-issued. */
export const CLIENT_EVENT_TYPES = [
  "page_viewed",
  "download_clicked",
  "viewer_closed",
] as const satisfies readonly ViewerEventType[];

export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

export type EventMetadata = Record<string, string | number | boolean>;

export type TrackingEvent = {
  id: string;
  linkId: string;
  fileId: string;
  sessionId: string;
  eventType: ViewerEventType;
  pageNumber?: number;
  metadata?: EventMetadata;
  occurredAt: string;
};

export type ViewerSession = {
  id: string;
  linkId: string;
  fileId: string;
  startedAt: string;
  lastSeenAt: string;
  userAgent: string;
  /** Password in force when access was granted; a change revokes this session. */
  passwordFingerprint: string;
};

export type AppUser = {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /** Picture from the identity provider, refreshed on every sign-in. */
  avatarUrl?: string;
  /** An uploaded picture, which takes precedence over the provider's. */
  avatarStoragePath?: string;
  avatarContentType?: string;
  /** Set once the user edits their name, so sign-in stops overwriting it. */
  nameIsCustom?: boolean;
  createdAt: string;
  updatedAt?: string;
};

export const MAX_NAME_LENGTH = 80;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Name must be text.");
  }

  const name = value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  if (!name) {
    throw new Error("Name cannot be empty.");
  }

  return name;
}

export type AuthSession = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

export type LocalState = {
  users: AppUser[];
  authSessions: AuthSession[];
  files: FileAsset[];
  links: ShareLink[];
  events: TrackingEvent[];
  sessions: ViewerSession[];
};

/** Events retained per link. Older ones are dropped as new ones arrive. */
export const MAX_EVENTS_PER_LINK = 500;
export const MAX_TITLE_LENGTH = 200;
export const MAX_PASSWORD_LENGTH = 200;

export function emptyState(): LocalState {
  return {
    users: [],
    authSessions: [],
    files: [],
    links: [],
    events: [],
    sessions: [],
  };
}

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function getFileKind(type: string): FileKind | null {
  if (type === "application/pdf") return "pdf";
  // SVG is an active document, not a picture: it is never an accepted kind.
  if (type === "image/svg+xml") return null;
  if (type.startsWith("image/")) return "image";
  return null;
}

export function isExpired(link: Pick<ShareLink, "expiresAt">, now = new Date()) {
  return Boolean(link.expiresAt && new Date(link.expiresAt) < now);
}

/** Strips the password and owner before a link is sent to a viewer. */
export function publicLink(link: ShareLink): PublicShareLink {
  return {
    id: link.id,
    fileId: link.fileId,
    token: link.token,
    title: link.title,
    enabled: link.enabled,
    expiresAt: link.expiresAt,
    allowDownload: link.allowDownload,
    createdAt: link.createdAt,
    passwordRequired: Boolean(link.password),
  };
}

export type LinkPatch = {
  title?: string;
  enabled?: boolean;
  password?: string | null;
  expiresAt?: string | null;
  allowDownload?: boolean;
};

/**
 * Applies only the keys the caller actually sent. An absent key leaves the
 * current value alone; an explicit `null` clears the optional ones.
 */
export function applyLinkPatch(link: ShareLink, patch: unknown): ShareLink {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("Link update must be an object.");
  }

  const input = patch as Record<string, unknown>;
  const next: ShareLink = { ...link };

  if ("title" in input) {
    if (typeof input.title !== "string") {
      throw new Error("Link title must be text.");
    }
    const title = input.title.trim().slice(0, MAX_TITLE_LENGTH);
    if (!title) {
      throw new Error("Link title cannot be empty.");
    }
    next.title = title;
  }

  if ("enabled" in input) {
    if (typeof input.enabled !== "boolean") {
      throw new Error("Link enabled must be true or false.");
    }
    next.enabled = input.enabled;
  }

  if ("allowDownload" in input) {
    if (typeof input.allowDownload !== "boolean") {
      throw new Error("Link allowDownload must be true or false.");
    }
    next.allowDownload = input.allowDownload;
  }

  if ("password" in input) {
    if (input.password === null || input.password === "") {
      delete next.password;
    } else if (typeof input.password === "string") {
      next.password = input.password.slice(0, MAX_PASSWORD_LENGTH);
    } else {
      throw new Error("Link password must be text or null.");
    }
  }

  if ("expiresAt" in input) {
    if (input.expiresAt === null || input.expiresAt === "") {
      delete next.expiresAt;
    } else if (typeof input.expiresAt === "string") {
      const parsed = new Date(input.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error("Link expiry is not a valid date.");
      }
      // Always persisted as UTC so the server and browser agree on the instant.
      next.expiresAt = parsed.toISOString();
    } else {
      throw new Error("Link expiry must be a date string or null.");
    }
  }

  return next;
}

/** `datetime-local` has no zone, so it is read and written as local wall time. */
export function toDateTimeLocalValue(iso: string | undefined) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function summarizeLink(link: ShareLink, state: LocalState) {
  const events = state.events.filter((event) => event.linkId === link.id);
  const sessions = state.sessions.filter((session) => session.linkId === link.id);
  const viewedPages = new Set(
    events
      .filter((event) => event.eventType === "page_viewed" && event.pageNumber)
      .map((event) => event.pageNumber),
  );

  return {
    views: sessions.length,
    events: events.length,
    pages: viewedPages.size,
    downloads: events.filter((event) => event.eventType === "download_clicked")
      .length,
    lastSeen:
      events.length > 0
        ? events
            .map((event) => event.occurredAt)
            .sort()
            .at(-1)
        : undefined,
  };
}
