"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import { DocIcon, LinkIcon, UploadIcon } from "@/components/icons";
import { Trace } from "@/components/trace";
import { LivePulse, Pill } from "@/components/ui";
import {
  LocalState,
  ShareLink,
  emptyState,
  formatBytes,
  getFileKind,
  isExpired,
  summarizeLink,
} from "@/lib/local-product";

const MAX_LOCAL_FILE_SIZE = 25 * 1024 * 1024;

type PublicUser = {
  id: string;
  name: string;
  email: string;
};

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<LocalState>(emptyState());
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [copiedToken, setCopiedToken] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [now, setNow] = useState(0);

  const selectedFile = state.files.find((file) => file.id === selectedFileId);
  const selectedLinks = state.links.filter((link) => link.fileId === selectedFileId);

  const totals = useMemo(() => {
    const viewedPages = new Set(
      state.events
        .filter((event) => event.eventType === "page_viewed")
        .map((event) => `${event.fileId}:${event.pageNumber}`),
    );

    return {
      files: state.files.length,
      links: state.links.length,
      sessions: state.sessions.length,
      events: state.events.length,
      pages: viewedPages.size,
    };
  }, [state]);

  const activeViewers = useMemo(() => {
    if (!now) return 0;
    const cutoff = now - 60_000;
    return state.sessions.filter(
      (session) => new Date(session.lastSeenAt).getTime() > cutoff,
    ).length;
  }, [state.sessions, now]);

  const loadState = useCallback(
    async (options?: { preserveSelection?: boolean }) => {
      const response = await fetch("/api/auth/me");
      const payload = await response.json();

      if (!response.ok || !payload.user) {
        router.push("/login");
        return;
      }

      const nextState = payload.state as LocalState;
      setUser(payload.user as PublicUser);
      setState(nextState);
      setAuthChecked(true);
      setSelectedFileId((current) => {
        if (
          options?.preserveSelection &&
          current &&
          nextState.files.some((file) => file.id === current)
        ) {
          return current;
        }

        return nextState.files[0]?.id ?? "";
      });
    },
    [router],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadState();
    });
  }, [loadState]);

  useEffect(() => {
    const refresh = window.setInterval(() => {
      void loadState({ preserveSelection: true });
    }, 2500);

    return () => window.clearInterval(refresh);
  }, [loadState, selectedFileId]);

  useEffect(() => {
    queueMicrotask(() => setNow(Date.now()));
    const tick = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(tick);
  }, []);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    setUploadError("");
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const formData = new FormData();

    for (const file of files) {
      const kind = getFileKind(file.type);
      if (!kind) {
        setUploadError("Only PDF and image files are supported in local V1.");
        continue;
      }

      if (file.size > MAX_LOCAL_FILE_SIZE) {
        setUploadError("Keep each local V1 file under 25 MB.");
        continue;
      }

      formData.append("files", file);
    }

    if (!formData.has("files")) {
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    const response = await fetch("/api/files", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    setIsUploading(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      setUploadError(payload.error ?? "Upload failed.");
    } else {
      const nextState = payload as LocalState;
      setState(nextState);
      setSelectedFileId(nextState.files[0]?.id ?? "");
    }

    event.target.value = "";
  }

  async function createShareLink(fileId: string) {
    const response = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    if (response.status === 401) {
      router.push("/login");
      return;
    }

    setState((await response.json()) as LocalState);
  }

  async function updateLink(linkId: string, patch: Partial<ShareLink>) {
    const response = await fetch(`/api/links/${linkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (response.status === 401) {
      router.push("/login");
      return;
    }

    setState((await response.json()) as LocalState);
  }

  async function copyShareLink(link: ShareLink) {
    const url = `${window.location.origin}/view/${link.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(link.token);
    window.setTimeout(() => setCopiedToken(""), 1400);
  }

  async function resetDemoData() {
    const response = await fetch("/api/state", { method: "DELETE" });
    if (response.status === 401) {
      router.push("/login");
      return;
    }

    setState((await response.json()) as LocalState);
    setSelectedFileId("");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!authChecked) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper">
        <div className="rounded-xl border border-line bg-surface px-6 py-5 text-center shadow-sm">
          <Brand className="justify-center text-sm" />
          <p className="mt-2 font-mono text-xs text-ink-3">Checking your session…</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Brand className="text-base" />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-signal font-display text-[11px] font-bold text-white">
                {initials(user?.name)}
              </span>
              <span className="leading-tight">
                <span className="block text-xs font-semibold">{user?.name}</span>
                <span className="block font-mono text-[10px] text-ink-3">
                  {user?.email}
                </span>
              </span>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-signal-ink">
              <UploadIcon className="h-4 w-4" />
              {isUploading ? "Uploading…" : "Upload"}
              <input
                className="sr-only"
                disabled={isUploading}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                multiple
                onChange={handleUpload}
              />
            </label>
            <button
              className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-2 transition hover:border-ink-3 hover:text-ink"
              onClick={logout}
              type="button"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Workspace
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold">Overview</h1>
            {activeViewers > 0 ? (
              <span className="flex items-center gap-2 font-mono text-[11px] text-ink-2">
                <LivePulse />
                {activeViewers} viewing now
              </span>
            ) : null}
          </div>
        </div>

        {uploadError ? (
          <div className="mt-4 rounded-lg border border-crit/40 bg-crit/5 px-4 py-3 text-sm text-crit">
            {uploadError}
          </div>
        ) : null}

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Documents" value={totals.files} />
          <Metric label="Share links" value={totals.links} />
          <Metric label="Viewer sessions" value={totals.sessions} />
          <Metric label="Tracked events" value={totals.events} />
          <Metric label="Pages engaged" value={totals.pages} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="h-max rounded-xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Documents</h2>
              <span className="font-mono text-[10px] text-ink-3">
                {state.files.length}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              {state.files.length === 0 ? (
                <EmptyState text="Upload a PDF or image to start creating tracked links." />
              ) : (
                state.files.map((file) => {
                  const selected = selectedFileId === file.id;
                  return (
                    <button
                      className={`rounded-lg border p-3 text-left transition ${
                        selected
                          ? "border-signal bg-signal-wash"
                          : "border-line hover:bg-surface-2"
                      }`}
                      key={file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      type="button"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-9 w-8 flex-none place-items-center rounded border border-signal/25 bg-signal-wash text-signal-ink">
                          <DocIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold">
                            {file.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10px] text-ink-3">
                            {file.kind.toUpperCase()} &middot; {formatBytes(file.size)}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              {selectedFile ? (
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">
                      {selectedFile.name}
                    </h2>
                    <p className="mt-1 font-mono text-[11px] text-ink-3">
                      {selectedFile.type} &middot; {formatBytes(selectedFile.size)}{" "}
                      &middot; {selectedFile.pageCount} tracked{" "}
                      {selectedFile.pageCount === 1 ? "page" : "pages"}
                    </p>
                  </div>
                  <button
                    className="inline-flex flex-none items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-signal-ink"
                    onClick={() => createShareLink(selectedFile.id)}
                    type="button"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Create share link
                  </button>
                </div>
              ) : (
                <EmptyState text="Select a document to manage its share links." />
              )}
            </div>

            <div className="rounded-xl border border-line bg-surface shadow-sm">
              <div className="border-b border-line p-5">
                <h2 className="text-sm font-semibold">Links &amp; controls</h2>
              </div>

              <div className="divide-y divide-line-2">
                {selectedLinks.length === 0 ? (
                  <div className="p-5">
                    <EmptyState text="Create a share link for the selected document." />
                  </div>
                ) : (
                  selectedLinks.map((link) => (
                    <LinkRow
                      copied={copiedToken === link.token}
                      key={link.id}
                      link={link}
                      onCopy={() => copyShareLink(link)}
                      onUpdate={(patch) => updateLink(link.id, patch)}
                      summary={summarizeLink(link, state)}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface shadow-sm">
              <div className="border-b border-line p-5">
                <h2 className="text-sm font-semibold">Recent activity</h2>
              </div>
              <div className="max-h-[380px] overflow-auto p-2">
                {state.events.length === 0 ? (
                  <div className="p-3">
                    <EmptyState text="Open a share link to start collecting events." />
                  </div>
                ) : (
                  <ol className="relative">
                    {state.events.slice(0, 40).map((event, index, list) => {
                      const file = state.files.find(
                        (item) => item.id === event.fileId,
                      );
                      return (
                        <li
                          className="relative grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5"
                          key={event.id}
                        >
                          {index < list.length - 1 ? (
                            <span className="absolute left-[16px] top-6 h-full w-px bg-line" />
                          ) : null}
                          <span
                            className={`relative z-10 mt-1 h-2.5 w-2.5 rounded-full border-2 bg-surface ${
                              event.eventType === "link_blocked"
                                ? "border-crit"
                                : event.eventType === "download_clicked"
                                  ? "border-good"
                                  : "border-signal"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-[13px]">
                              <span className="font-semibold">
                                {event.eventType.replaceAll("_", " ")}
                              </span>
                              {event.pageNumber ? (
                                <span className="text-ink-2">
                                  {" "}
                                  &middot; page {event.pageNumber}
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate font-mono text-[10px] text-ink-3">
                              {file?.name ?? "Unknown document"}
                            </p>
                          </div>
                          <time className="whitespace-nowrap font-mono text-[10px] text-ink-3">
                            {relativeTime(event.occurredAt, now)}
                          </time>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 flex justify-end">
          <button
            className="rounded-lg border border-line px-3 py-1.5 font-mono text-[11px] text-ink-3 transition hover:border-ink-3 hover:text-ink-2"
            onClick={resetDemoData}
            type="button"
          >
            Reset demo data
          </button>
        </div>
      </main>
    </div>
  );
}

function initials(name?: string) {
  if (!name) return "··";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function relativeTime(iso: string, now: number) {
  if (!now) return "";
  const diff = now - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface-2 px-4 py-6 text-center">
      <Trace className="mx-auto h-8 w-32 opacity-70" />
      <p className="mt-2 text-sm text-ink-2">{text}</p>
    </div>
  );
}

function LinkRow({
  copied,
  link,
  onCopy,
  onUpdate,
  summary,
}: {
  copied: boolean;
  link: ShareLink;
  onCopy: () => void;
  onUpdate: (patch: Partial<ShareLink>) => void;
  summary: ReturnType<typeof summarizeLink>;
}) {
  const url =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/view/${link.token}`;
  const expired = isExpired(link);
  const tone = link.enabled ? (expired ? "expired" : "active") : "off";
  const status = link.enabled ? (expired ? "Expired" : "Active") : "Disabled";

  return (
    <div className="p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-signal"
              onChange={(event) => onUpdate({ title: event.target.value })}
              value={link.title}
            />
            <Pill tone={tone}>{status}</Pill>
          </div>
          <p className="mt-2 truncate rounded-lg bg-surface-2 px-3 py-2 font-mono text-[11px] text-ink-2">
            {url}
          </p>
        </div>
        <div className="flex flex-none flex-wrap gap-2">
          <button
            className="rounded-lg bg-signal px-3 py-2 text-sm font-semibold text-white transition hover:bg-signal-ink"
            onClick={onCopy}
            type="button"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-2 transition hover:border-ink-3 hover:text-ink"
            onClick={() => onUpdate({ enabled: !link.enabled })}
            type="button"
          >
            {link.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 md:grid-cols-3">
        <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-2">
          <input
            checked={link.allowDownload}
            className="accent-signal"
            onChange={(event) => onUpdate({ allowDownload: event.target.checked })}
            type="checkbox"
          />
          Allow download
        </label>
        <input
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-signal"
          onChange={(event) =>
            onUpdate({ password: event.target.value || undefined })
          }
          placeholder="Optional password"
          value={link.password ?? ""}
        />
        <input
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-signal"
          onChange={(event) =>
            onUpdate({ expiresAt: event.target.value || undefined })
          }
          type="datetime-local"
          value={link.expiresAt?.slice(0, 16) ?? ""}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SmallStat label="Views" value={summary.views} />
        <SmallStat label="Events" value={summary.events} />
        <SmallStat label="Pages" value={summary.pages} />
        <SmallStat label="Downloads" value={summary.downloads} />
      </div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <span className="block font-mono text-[10px] uppercase tracking-wide text-ink-3">
        {label}
      </span>
      <span className="mt-0.5 block truncate font-display text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}
