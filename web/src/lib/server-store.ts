import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import {
  MAX_AVATAR_BYTES,
  MAX_PASSWORD_LENGTH,
  applyLinkPatch,
  emptyState,
  isExpired,
  makeId,
  normalizeDisplayName,
  publicLink,
  revisionOf,
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
  ViewerSession,
} from "./local-product";
import { countPdfPages, sniffFileType } from "./file-type";
import {
  normalizePageNumber,
  passwordFingerprint,
  removeLinkCascade,
  trimEventsForLink,
  validateShareLink,
  verifyLinkPassword,
} from "./state-access";

const STATE_BLOB_PATH = "state/state.json";
const DATA_DIR =
  process.env.VERCEL === "1"
    ? path.join(os.tmpdir(), "simbai-demo-data")
    : path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOADS_PER_REQUEST = 10;

function shouldUseVercelBlob() {
  return process.env.VERCEL === "1";
}

/**
 * The last state this instance wrote. The blob store can serve a read that
 * predates our own write, so we keep the newer of the two.
 */
let lastWritten: { revision: number; state: LocalState } | null = null;

function freshest(fromStore: LocalState): LocalState {
  if (lastWritten && lastWritten.revision > revisionOf(fromStore)) {
    return lastWritten.state;
  }
  return fromStore;
}

/**
 * Raised when the store could not be read. Deliberately distinct from "the
 * store is empty": treating a failed read as empty state is how a transient
 * outage turns into a write that erases every file and link.
 */
export class StoreUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("The data store is temporarily unavailable.");
    this.name = "StoreUnavailableError";
    this.cause = cause;
  }
}

async function loadStateFromStore(): Promise<LocalState> {
  if (shouldUseVercelBlob()) {
    let result;
    try {
      result = await get(STATE_BLOB_PATH, { access: "private", useCache: false });
    } catch (cause) {
      // Network error, revoked token, exhausted quota: unknown, not empty.
      throw new StoreUnavailableError(cause);
    }

    // A genuinely absent object is an empty workspace, which is fine.
    if (!result || result.statusCode === 304 || !result.stream) {
      return emptyState();
    }

    try {
      const raw = await new Response(result.stream).text();
      return { ...emptyState(), ...JSON.parse(raw) } as LocalState;
    } catch (cause) {
      // A truncated or malformed body must not read as "no data".
      throw new StoreUnavailableError(cause);
    }
  }

  try {
    const raw = await readFile(STATE_FILE, "utf8");
    return { ...emptyState(), ...JSON.parse(raw) } as LocalState;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException)?.code === "ENOENT") {
      return emptyState();
    }
    throw new StoreUnavailableError(cause);
  }
}

export async function readServerState(): Promise<LocalState> {
  return freshest(await loadStateFromStore());
}

async function writeServerState(state: LocalState) {
  lastWritten = { revision: revisionOf(state), state };

  if (shouldUseVercelBlob()) {
    await put(STATE_BLOB_PATH, JSON.stringify(state, null, 2), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

/**
 * Serializes every read-modify-write cycle so concurrent requests in this
 * process cannot clobber one another.
 *
 * This is a per-instance lock. The JSON store has no compare-and-set, so two
 * Vercel lambdas writing at the same instant can still lose an update; that is
 * a property of the prototype store and goes away with a real database.
 */
let mutationQueue: Promise<unknown> = Promise.resolve();

function withStateLock<T>(run: () => Promise<T>): Promise<T> {
  // Chained on both settle paths so one failed mutation cannot stall the queue.
  const next = mutationQueue.then(run, run);
  mutationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

type Mutation<T> = (state: LocalState) => Promise<[LocalState, T]> | [LocalState, T];

async function mutateState<T>(mutate: Mutation<T>): Promise<T> {
  return withStateLock(async () => {
    const current = await readServerState();
    // The revision is advanced before the mutator runs, so every state it
    // derives by spreading — including the one it hands back to the caller —
    // already carries the new value.
    const staged: LocalState = { ...current, revision: revisionOf(current) + 1 };
    const [next, result] = await mutate(staged);
    await writeServerState(next);
    return result;
  });
}

export { mutateState };

/* -------------------------------------------------------------------------- */
/* File content                                                               */
/* -------------------------------------------------------------------------- */

function safeBlobName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "file";
}

function localPathFor(storagePath: string) {
  const resolved = path.resolve(DATA_DIR, storagePath);
  const root = path.resolve(DATA_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Refusing to read outside the data directory.");
  }
  return resolved;
}

async function writeFileContent(storagePath: string, bytes: Buffer, type: string) {
  if (shouldUseVercelBlob()) {
    await put(storagePath, bytes, { access: "private", contentType: type });
    return;
  }

  const target = localPathFor(storagePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

async function deleteStoredKeys(keys: string[]) {
  if (keys.length === 0) return;

  if (shouldUseVercelBlob()) {
    await del(keys).catch(() => undefined);
    return;
  }

  await Promise.all(
    keys.map((key) =>
      rm(localPathFor(key), { force: true }).catch(() => undefined),
    ),
  );
}

async function deleteFileContent(files: FileAsset[]) {
  await deleteStoredKeys(
    files
      .map((file) => file.storagePath ?? file.blobPath)
      .filter((key): key is string => Boolean(key)),
  );
}

/** Reads one stored object by key, whichever backend is active. */
async function readStoredContent(
  key: string,
  contentType: string,
  filename: string,
): Promise<FileContent | null> {
  if (shouldUseVercelBlob()) {
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode === 304 || !result.stream) return null;
    return { body: result.stream, contentType, filename };
  }

  try {
    return {
      body: new Uint8Array(await readFile(localPathFor(key))),
      contentType,
      filename,
    };
  } catch {
    return null;
  }
}

export type FileContent = {
  body: ReadableStream<Uint8Array> | Uint8Array<ArrayBuffer>;
  contentType: string;
  filename: string;
};

export async function readFileContent(
  file: FileAsset,
): Promise<FileContent | null> {
  const key = file.storagePath ?? file.blobPath;

  if (key) {
    // The type was sniffed at upload; never trust what the store echoes back.
    return readStoredContent(key, file.type, file.name);
  }

  // Written by earlier builds that inlined bytes into the state file.
  if (file.dataUrl) {
    const [, base64] = file.dataUrl.split(",");
    return {
      body: new Uint8Array(Buffer.from(base64 ?? "", "base64")),
      contentType: file.type,
      filename: file.name,
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Uploads                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Validates and stores every upload before touching the state file, so a
 * rejected file cannot leave earlier files half-committed.
 */
export async function addUploadedFiles(files: File[], ownerUserId: string) {
  if (files.length === 0) {
    throw new Error("No files uploaded.");
  }

  if (files.length > MAX_UPLOADS_PER_REQUEST) {
    throw new Error(`Upload at most ${MAX_UPLOADS_PER_REQUEST} files at a time.`);
  }

  const prepared: { asset: FileAsset; bytes: Buffer }[] = [];

  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`"${file.name}" is larger than 25 MB.`);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error(`"${file.name}" is larger than 25 MB.`);
    }

    const sniffed = sniffFileType(bytes);
    if (!sniffed) {
      throw new Error(
        `"${file.name}" is not a PDF, PNG, JPEG, GIF or WebP file.`,
      );
    }

    const id = makeId("file");
    prepared.push({
      bytes,
      asset: {
        id,
        ownerUserId,
        name: file.name.slice(0, 200) || "file",
        // The sniffed type, not the browser's claim, is what gets served back.
        type: sniffed.contentType,
        kind: sniffed.kind,
        size: bytes.byteLength,
        storagePath: `files/${id}-${safeBlobName(file.name)}`,
        pageCount:
          sniffed.kind === "pdf" ? await countPdfPages(bytes) : 1,
        createdAt: new Date().toISOString(),
      },
    });
  }

  for (const { asset, bytes } of prepared) {
    await writeFileContent(asset.storagePath!, bytes, asset.type);
  }

  return mutateState((state) => {
    const next = {
      ...state,
      files: [...prepared.map((item) => item.asset), ...state.files],
    };
    return [next, next];
  });
}

/* -------------------------------------------------------------------------- */
/* Links                                                                      */
/* -------------------------------------------------------------------------- */

export async function createShareLink(fileId: string, ownerUserId: string) {
  return mutateState((state) => {
    const file = state.files.find(
      (item) => item.id === fileId && item.ownerUserId === ownerUserId,
    );

    if (!file) {
      throw new Error("File not found.");
    }

    const link: ShareLink = {
      id: makeId("link"),
      ownerUserId,
      fileId: file.id,
      token: makeId("share"),
      title: `${file.name} link`,
      enabled: true,
      allowDownload: false,
      createdAt: new Date().toISOString(),
    };

    const next = { ...state, links: [link, ...state.links] };
    return [next, next];
  });
}

export async function updateShareLink(
  linkId: string,
  patch: unknown,
  ownerUserId: string,
) {
  return mutateState((state) => {
    const existing = state.links.find(
      (link) => link.id === linkId && link.ownerUserId === ownerUserId,
    );

    if (!existing) {
      throw new Error("Link not found.");
    }

    const updated = applyLinkPatch(existing, patch);
    const next = {
      ...state,
      links: state.links.map((link) => (link.id === linkId ? updated : link)),
    };
    return [next, next];
  });
}

/** Removes a link along with the sessions and events that belong to it. */
export async function deleteShareLink(linkId: string, ownerUserId: string) {
  return mutateState((state) => {
    const existing = state.links.find(
      (link) => link.id === linkId && link.ownerUserId === ownerUserId,
    );

    if (!existing) {
      throw new Error("Link not found.");
    }

    const next = removeLinkCascade(state, linkId);
    return [next, next];
  });
}

/* -------------------------------------------------------------------------- */
/* Viewer access                                                              */
/* -------------------------------------------------------------------------- */

export type ShareSnapshot =
  | { ok: false; reason: string; passwordRequired?: boolean }
  | { ok: true; link: PublicShareLink; file: PublicFile };

export type PublicFile = {
  id: string;
  name: string;
  kind: FileAsset["kind"];
  type: string;
  size: number;
  pageCount: number;
};

function publicFile(file: FileAsset): PublicFile {
  return {
    id: file.id,
    name: file.name,
    kind: file.kind,
    type: file.type,
    size: file.size,
    pageCount: file.pageCount,
  };
}

/** What an anonymous caller may learn about a link: never the password. */
export async function readShareSnapshot(token: string): Promise<ShareSnapshot> {
  const state = await readServerState();
  const validation = validateShareLink(state, token);

  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  return {
    ok: true,
    link: publicLink(validation.link),
    file: publicFile(validation.file),
  };
}

export type OpenViewerResult =
  | { ok: false; reason: string; passwordRequired: boolean }
  | {
      ok: true;
      link: PublicShareLink;
      file: PublicFile;
      session: Pick<ViewerSession, "id" | "linkId" | "fileId" | "startedAt">;
    };

/**
 * Creates a viewer session, which is the grant the content route checks. The
 * password is verified here, on the server, and never leaves it.
 */
export async function openViewerSession(input: {
  token: string;
  password?: string;
  userAgent: string;
  viewport: string;
}): Promise<OpenViewerResult> {
  return mutateState<OpenViewerResult>((state) => {
    const validation = validateShareLink(state, input.token);

    if (!validation.ok) {
      const link = state.links.find((item) => item.token === input.token);
      const blocked: LocalState = link
        ? {
            ...state,
            events: trimEventsForLink(
              [
                {
                  id: makeId("evt"),
                  linkId: link.id,
                  fileId: link.fileId,
                  sessionId: "blocked",
                  eventType: "link_blocked",
                  metadata: { reason: validation.reason },
                  occurredAt: new Date().toISOString(),
                },
                ...state.events,
              ],
              link.id,
            ),
          }
        : state;

      return [
        blocked,
        { ok: false, reason: validation.reason, passwordRequired: false },
      ];
    }

    const { link, file } = validation;
    const supplied = input.password?.slice(0, MAX_PASSWORD_LENGTH);

    if (!verifyLinkPassword(link, supplied)) {
      return [
        state,
        {
          ok: false,
          reason: supplied
            ? "That password is not correct."
            : "This share link is password protected.",
          passwordRequired: true,
        },
      ];
    }

    const now = new Date().toISOString();
    const session: ViewerSession = {
      id: makeId("ses"),
      linkId: link.id,
      fileId: file.id,
      startedAt: now,
      lastSeenAt: now,
      userAgent: input.userAgent.slice(0, 300),
      passwordFingerprint: passwordFingerprint(link.password),
    };

    const events: TrackingEvent[] = [
      {
        id: makeId("evt"),
        linkId: link.id,
        fileId: file.id,
        sessionId: session.id,
        eventType: "viewer_started",
        occurredAt: now,
        metadata: { viewport: input.viewport.slice(0, 32) },
      },
      {
        id: makeId("evt"),
        linkId: link.id,
        fileId: file.id,
        sessionId: session.id,
        eventType: "link_opened",
        occurredAt: now,
      },
    ];

    const next: LocalState = {
      ...state,
      sessions: [session, ...state.sessions],
      events: trimEventsForLink([...events, ...state.events], link.id),
    };

    return [
      next,
      {
        ok: true,
        link: publicLink(link),
        file: publicFile(file),
        session: {
          id: session.id,
          linkId: session.linkId,
          fileId: session.fileId,
          startedAt: session.startedAt,
        },
      },
    ];
  });
}

/**
 * Re-checks a grant on every use, so disabling a link, letting it expire, or
 * changing its password takes effect immediately for sessions already open.
 */
export function resolveViewerGrant(
  state: LocalState,
  token: string,
  sessionId: string | undefined,
) {
  if (!sessionId) return null;

  const validation = validateShareLink(state, token);
  if (!validation.ok) return null;

  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session || session.linkId !== validation.link.id) return null;

  if (session.passwordFingerprint !== passwordFingerprint(validation.link.password)) {
    return null;
  }

  return { link: validation.link, file: validation.file, session };
}

/** Presence only: keeps "viewing now" fresh without storing an event per tick. */
export async function touchViewerSession(token: string, sessionId: string) {
  return mutateState((state) => {
    const grant = resolveViewerGrant(state, token, sessionId);
    if (!grant) return [state, false];

    const next = {
      ...state,
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, lastSeenAt: new Date().toISOString() }
          : session,
      ),
    };
    return [next, true];
  });
}

export async function recordViewerEvent(input: {
  token: string;
  sessionId: string;
  eventType: ClientEventType;
  pageNumber?: unknown;
  metadata?: EventMetadata;
}) {
  return mutateState((state) => {
    const grant = resolveViewerGrant(state, input.token, input.sessionId);
    if (!grant) return [state, false];

    if (input.eventType === "download_clicked" && !grant.link.allowDownload) {
      return [state, false];
    }

    const occurredAt = new Date().toISOString();
    const event: TrackingEvent = {
      id: makeId("evt"),
      // Identity comes from the grant, never from the request body.
      linkId: grant.link.id,
      fileId: grant.file.id,
      sessionId: grant.session.id,
      eventType: input.eventType,
      pageNumber: normalizePageNumber(input.pageNumber, grant.file.pageCount),
      metadata: input.metadata,
      occurredAt,
    };

    const next: LocalState = {
      ...state,
      events: trimEventsForLink([event, ...state.events], grant.link.id),
      sessions: state.sessions.map((session) =>
        session.id === grant.session.id
          ? { ...session, lastSeenAt: occurredAt }
          : session,
      ),
    };

    return [next, true];
  });
}

/* -------------------------------------------------------------------------- */
/* Reset                                                                      */
/* -------------------------------------------------------------------------- */

export async function resetServerState(userId: string) {
  const doomed = await mutateState((state) => {
    const userFiles = state.files.filter((file) => file.ownerUserId === userId);
    const userFileIds = new Set(userFiles.map((file) => file.id));
    const userLinkIds = new Set(
      state.links
        .filter((link) => link.ownerUserId === userId && userFileIds.has(link.fileId))
        .map((link) => link.id),
    );

    const next: LocalState = {
      ...state,
      files: state.files.filter((file) => file.ownerUserId !== userId),
      links: state.links.filter((link) => !userLinkIds.has(link.id)),
      sessions: state.sessions.filter((session) => !userLinkIds.has(session.linkId)),
      events: state.events.filter((event) => !userLinkIds.has(event.linkId)),
    };

    return [next, { next, userFiles }];
  });

  // Content is removed after the state write: an orphaned blob is harmless,
  // a state row pointing at deleted bytes is not.
  await deleteFileContent(doomed.userFiles);
  return doomed.next;
}

/* -------------------------------------------------------------------------- */
/* Owner access                                                               */
/* -------------------------------------------------------------------------- */

/** Lets an owner read their own file without minting a viewer grant. */
export async function findOwnedFile(fileId: string, ownerUserId: string) {
  const state = await readServerState();
  return (
    state.files.find(
      (file) => file.id === fileId && file.ownerUserId === ownerUserId,
    ) ?? null
  );
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateUserName(userId: string, name: unknown) {
  const displayName = normalizeDisplayName(name);

  return mutateState<AppUser>((state) => {
    const existing = state.users.find((user) => user.id === userId);
    if (!existing) {
      throw new Error("Account not found.");
    }

    const updated: AppUser = {
      ...existing,
      name: displayName,
      // Remember the choice so the next sign-in does not revert it.
      nameIsCustom: true,
      updatedAt: new Date().toISOString(),
    };

    return [
      {
        ...state,
        users: state.users.map((user) => (user.id === userId ? updated : user)),
      },
      updated,
    ];
  });
}

export async function setUserAvatar(userId: string, file: File) {
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Profile pictures must be 2 MB or smaller.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new Error("Profile pictures must be 2 MB or smaller.");
  }

  const sniffed = sniffFileType(bytes);
  if (!sniffed || sniffed.kind !== "image") {
    throw new Error("Profile pictures must be a PNG, JPEG, GIF or WebP image.");
  }

  const storagePath = `avatars/${userId}-${makeId("img")}`;
  await writeFileContent(storagePath, bytes, sniffed.contentType);

  const { updated, previous } = await mutateState<{
    updated: AppUser;
    previous?: string;
  }>((state) => {
    const existing = state.users.find((user) => user.id === userId);
    if (!existing) {
      throw new Error("Account not found.");
    }

    const next: AppUser = {
      ...existing,
      avatarStoragePath: storagePath,
      avatarContentType: sniffed.contentType,
      updatedAt: new Date().toISOString(),
    };

    return [
      {
        ...state,
        users: state.users.map((user) => (user.id === userId ? next : user)),
      },
      { updated: next, previous: existing.avatarStoragePath },
    ];
  });

  // Drop the superseded picture only once the new one is committed.
  if (previous && previous !== storagePath) {
    await deleteStoredKeys([previous]);
  }

  return updated;
}

export async function removeUserAvatar(userId: string) {
  const { updated, previous } = await mutateState<{
    updated: AppUser;
    previous?: string;
  }>((state) => {
    const existing = state.users.find((user) => user.id === userId);
    if (!existing) {
      throw new Error("Account not found.");
    }

    const next: AppUser = { ...existing, updatedAt: new Date().toISOString() };
    delete next.avatarStoragePath;
    delete next.avatarContentType;

    return [
      {
        ...state,
        users: state.users.map((user) => (user.id === userId ? next : user)),
      },
      { updated: next, previous: existing.avatarStoragePath },
    ];
  });

  if (previous) {
    await deleteStoredKeys([previous]);
  }

  return updated;
}

export async function readUserAvatar(user: AppUser): Promise<FileContent | null> {
  if (!user.avatarStoragePath) return null;

  return readStoredContent(
    user.avatarStoragePath,
    user.avatarContentType ?? "application/octet-stream",
    "avatar",
  );
}

export { isExpired, validateShareLink };
