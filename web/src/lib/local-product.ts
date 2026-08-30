export type FileKind = "pdf" | "image";

export type FileAsset = {
  id: string;
  ownerUserId?: string;
  name: string;
  type: string;
  kind: FileKind;
  size: number;
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

export type TrackingEvent = {
  id: string;
  linkId: string;
  fileId: string;
  sessionId: string;
  eventType:
    | "link_opened"
    | "viewer_started"
    | "page_viewed"
    | "download_clicked"
    | "viewer_closed"
    | "link_blocked";
  pageNumber?: number;
  metadata?: Record<string, string | number | boolean>;
  occurredAt: string;
};

export type ViewerSession = {
  id: string;
  linkId: string;
  fileId: string;
  startedAt: string;
  lastSeenAt: string;
  userAgent: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

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
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}_${random.replaceAll("-", "").slice(0, 16)}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function getFileKind(type: string): FileKind | null {
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  return null;
}

export function isExpired(link: ShareLink) {
  return Boolean(link.expiresAt && new Date(link.expiresAt) < new Date());
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
