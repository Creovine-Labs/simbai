import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import {
  FileAsset,
  LocalState,
  ShareLink,
  TrackingEvent,
  ViewerSession,
  emptyState,
  getFileKind,
  isExpired,
  makeId,
} from "@/lib/local-product";

const STATE_BLOB_PATH = "state/state.json";
const DATA_DIR =
  process.env.VERCEL === "1"
    ? path.join(os.tmpdir(), "simbai-demo-data")
    : path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function readServerState(): Promise<LocalState> {
  if (shouldUseVercelBlob()) {
    try {
      const result = await get(STATE_BLOB_PATH, {
        access: "private",
        useCache: false,
      });

      if (!result || result.statusCode === 304 || !result.stream) {
        return emptyState();
      }

      const raw = await new Response(result.stream).text();
      return { ...emptyState(), ...JSON.parse(raw) } as LocalState;
    } catch {
      return emptyState();
    }
  }

  try {
    const raw = await readFile(STATE_FILE, "utf8");
    return { ...emptyState(), ...JSON.parse(raw) } as LocalState;
  } catch {
    return emptyState();
  }
}

export async function writeServerState(state: LocalState) {
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

export async function resetServerState() {
  if (shouldUseVercelBlob()) {
    const currentState = await readServerState();
    const blobPaths = currentState.files
      .map((file) => file.blobPath)
      .filter((blobPath): blobPath is string => Boolean(blobPath));

    if (blobPaths.length > 0) {
      await del(blobPaths);
    }
  }

  const state = emptyState();
  await writeServerState(state);
  return state;
}

export async function addUploadedFile(file: File) {
  const kind = getFileKind(file.type);
  if (!kind) {
    throw new Error("Only PDF and image files are supported.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be 25 MB or smaller in local V1.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const id = makeId("file");
  const blobPath = `files/${id}-${safeBlobName(file.name)}`;

  if (shouldUseVercelBlob()) {
    await put(blobPath, bytes, {
      access: "private",
      contentType: file.type,
    });
  }

  const asset: FileAsset = {
    id,
    name: file.name,
    type: file.type,
    kind,
    size: file.size,
    dataUrl: shouldUseVercelBlob()
      ? undefined
      : `data:${file.type};base64,${bytes.toString("base64")}`,
    blobPath: shouldUseVercelBlob() ? blobPath : undefined,
    pageCount: kind === "pdf" ? countPdfPages(bytes) : 1,
    createdAt: new Date().toISOString(),
  };

  const state = await readServerState();
  const nextState = { ...state, files: [asset, ...state.files] };
  await writeServerState(nextState);
  return nextState;
}

export async function createShareLink(fileId: string) {
  const state = await readServerState();
  const file = state.files.find((item) => item.id === fileId);

  if (!file) {
    throw new Error("File not found.");
  }

  const link: ShareLink = {
    id: makeId("link"),
    fileId: file.id,
    token: makeId("share"),
    title: `${file.name} link`,
    enabled: true,
    allowDownload: false,
    createdAt: new Date().toISOString(),
  };

  const nextState = { ...state, links: [link, ...state.links] };
  await writeServerState(nextState);
  return nextState;
}

export async function updateShareLink(
  linkId: string,
  patch: Partial<ShareLink>,
) {
  const state = await readServerState();
  const allowedPatch: Partial<ShareLink> = {
    title: patch.title,
    enabled: patch.enabled,
    password: patch.password,
    expiresAt: patch.expiresAt,
    allowDownload: patch.allowDownload,
  };

  const nextState = {
    ...state,
    links: state.links.map((link) =>
      link.id === linkId ? { ...link, ...allowedPatch } : link,
    ),
  };

  await writeServerState(nextState);
  return nextState;
}

export async function createViewerSession(
  token: string,
  userAgent: string,
  viewport: string,
) {
  const state = await readServerState();
  const link = state.links.find((item) => item.token === token);
  const validation = validateShareLink(state, token);

  if (!validation.ok) {
    if (link) {
      await addTrackingEvent({
        linkId: link.id,
        fileId: link.fileId,
        sessionId: "blocked",
        eventType: "link_blocked",
        metadata: { reason: validation.reason },
      });
    }

    return validation;
  }

  const now = new Date().toISOString();
  const session: ViewerSession = {
    id: makeId("ses"),
    linkId: validation.link.id,
    fileId: validation.file.id,
    startedAt: now,
    lastSeenAt: now,
    userAgent,
  };

  const event: TrackingEvent = {
    id: makeId("evt"),
    linkId: validation.link.id,
    fileId: validation.file.id,
    sessionId: session.id,
    eventType: "viewer_started",
    occurredAt: now,
    metadata: { viewport },
  };

  const freshState = await readServerState();
  await writeServerState({
    ...freshState,
    sessions: [session, ...freshState.sessions],
    events: [event, ...freshState.events],
  });

  return { ...validation, session };
}

export async function addTrackingEvent(
  event: Omit<TrackingEvent, "id" | "occurredAt">,
) {
  const state = await readServerState();
  const link = state.links.find((item) => item.id === event.linkId);

  if (!link || !link.enabled || isExpired(link)) {
    return state;
  }

  const nextEvent: TrackingEvent = {
    ...event,
    id: makeId("evt"),
    occurredAt: new Date().toISOString(),
  };

  const nextState = {
    ...state,
    events: [nextEvent, ...state.events],
    sessions: state.sessions.map((session) =>
      session.id === event.sessionId
        ? { ...session, lastSeenAt: nextEvent.occurredAt }
        : session,
    ),
  };

  await writeServerState(nextState);
  return nextState;
}

export function validateShareLink(state: LocalState, token: string) {
  const link = state.links.find((item) => item.token === token);
  if (!link) {
    return { ok: false as const, reason: "This share link was not found." };
  }

  const file = state.files.find((item) => item.id === link.fileId);
  if (!file) {
    return { ok: false as const, reason: "The file for this link is missing." };
  }

  if (!link.enabled) {
    return { ok: false as const, reason: "This share link is disabled." };
  }

  if (isExpired(link)) {
    return { ok: false as const, reason: "This share link has expired." };
  }

  return { ok: true as const, link, file };
}

export async function readFileContent(fileId: string) {
  const state = await readServerState();
  const file = state.files.find((item) => item.id === fileId);

  if (!file) {
    return null;
  }

  if (file.blobPath && shouldUseVercelBlob()) {
    const result = await get(file.blobPath, {
      access: "private",
      useCache: false,
    });

    if (!result || result.statusCode === 304 || !result.stream) {
      return null;
    }

    return {
      stream: result.stream,
      contentType: result.blob.contentType || file.type,
      filename: file.name,
    };
  }

  if (file.dataUrl) {
    const [metadata, base64] = file.dataUrl.split(",");
    const contentType = metadata.match(/^data:(.*);base64$/)?.[1] ?? file.type;
    const body = Buffer.from(base64 ?? "", "base64");

    return {
      stream: body,
      contentType,
      filename: file.name,
    };
  }

  return null;
}

function shouldUseVercelBlob() {
  return process.env.VERCEL === "1";
}

function safeBlobName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

function countPdfPages(bytes: Buffer) {
  const content = bytes.toString("latin1");
  const matches = content.match(/\/Type\s*\/Page\b/g);
  return Math.max(matches?.length ?? 1, 1);
}
