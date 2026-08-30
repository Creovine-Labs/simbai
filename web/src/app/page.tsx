"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  LocalState,
  ShareLink,
  emptyState,
  formatBytes,
  getFileKind,
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

  const selectedFile = state.files.find((file) => file.id === selectedFileId);
  const selectedLinks = state.links.filter(
    (link) => link.fileId === selectedFileId,
  );

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

  const loadState = useCallback(async (options?: { preserveSelection?: boolean }) => {
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
  }, [router]);

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
      <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] text-[#1d2527]">
        <section className="rounded-lg border border-[#d8d1c7] bg-white px-6 py-5 shadow-sm">
          <p className="text-sm font-semibold text-[#35635b]">Simbai Share</p>
          <p className="mt-2 text-sm text-[#68736f]">Checking your session...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f3ee] text-[#1d2527]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#d8d1c7] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#35635b]">
              Simbai Share
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#17201f]">
              Trackable file sharing dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6865]">
              Local V1 stores files and analytics on this local Next.js server,
              so copied links work across browsers on this machine before we
              connect Supabase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-md border border-[#d8d1c7] bg-white px-3 py-2 text-sm">
              <span className="block font-semibold">{user?.name}</span>
              <span className="block text-xs text-[#68736f]">{user?.email}</span>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-[#235a4f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b463e]">
              {isUploading ? "Uploading..." : "Upload files"}
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
              className="rounded-md border border-[#c9c0b3] px-4 py-2 text-sm font-semibold text-[#33413e] transition hover:bg-white"
              onClick={logout}
              type="button"
            >
              Log out
            </button>
            <button
              className="rounded-md border border-[#c9c0b3] px-4 py-2 text-sm font-semibold text-[#33413e] transition hover:bg-white"
              onClick={resetDemoData}
              type="button"
            >
              Reset demo
            </button>
          </div>
        </header>

        {uploadError && (
          <div className="rounded-md border border-[#d8a27b] bg-[#fff8f1] px-4 py-3 text-sm text-[#7a3c18]">
            {uploadError}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Files" value={totals.files} />
          <Metric label="Share links" value={totals.links} />
          <Metric label="Viewer sessions" value={totals.sessions} />
          <Metric label="Tracked events" value={totals.events} />
          <Metric label="Pages engaged" value={totals.pages} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-[#d8d1c7] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Files</h2>
              <span className="text-xs text-[#68736f]">
                {state.files.length} total
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {state.files.length === 0 ? (
                <EmptyState text="Upload a PDF or image to start creating tracked links." />
              ) : (
                state.files.map((file) => (
                  <button
                    className={`rounded-md border p-3 text-left transition ${
                      selectedFileId === file.id
                        ? "border-[#235a4f] bg-[#edf7f3]"
                        : "border-[#e4ded5] hover:bg-[#faf8f4]"
                    }`}
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-semibold">
                      {file.name}
                    </span>
                    <span className="mt-1 block text-xs text-[#68736f]">
                      {file.kind.toUpperCase()} - {formatBytes(file.size)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex flex-col gap-6">
            <div className="rounded-lg border border-[#d8d1c7] bg-white p-5 shadow-sm">
              {selectedFile ? (
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedFile.name}</h2>
                    <p className="mt-1 text-sm text-[#68736f]">
                      {selectedFile.type} - {formatBytes(selectedFile.size)} -{" "}
                      {selectedFile.pageCount} tracked{" "}
                      {selectedFile.pageCount === 1 ? "page" : "pages"}
                    </p>
                  </div>
                  <button
                    className="rounded-md bg-[#202a2a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#111717]"
                    onClick={() => createShareLink(selectedFile.id)}
                    type="button"
                  >
                    Create share link
                  </button>
                </div>
              ) : (
                <EmptyState text="No file selected yet." />
              )}
            </div>

            <div className="rounded-lg border border-[#d8d1c7] bg-white shadow-sm">
              <div className="border-b border-[#e4ded5] p-5">
                <h2 className="text-lg font-semibold">Links and controls</h2>
              </div>

              <div className="divide-y divide-[#ece6dc]">
                {selectedLinks.length === 0 ? (
                  <div className="p-5">
                    <EmptyState text="Create a share link for the selected file." />
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

            <div className="rounded-lg border border-[#d8d1c7] bg-white shadow-sm">
              <div className="border-b border-[#e4ded5] p-5">
                <h2 className="text-lg font-semibold">Recent activity</h2>
              </div>
              <div className="max-h-[360px] overflow-auto">
                {state.events.length === 0 ? (
                  <div className="p-5">
                    <EmptyState text="Open a share link to start collecting events." />
                  </div>
                ) : (
                  state.events.slice(0, 30).map((event) => {
                    const file = state.files.find((item) => item.id === event.fileId);
                    return (
                      <div
                        className="grid gap-1 border-b border-[#f0ebe4] px-5 py-3 text-sm md:grid-cols-[1fr_auto]"
                        key={event.id}
                      >
                        <div>
                          <span className="font-semibold">
                            {event.eventType.replaceAll("_", " ")}
                          </span>
                          {event.pageNumber ? (
                            <span className="text-[#68736f]">
                              {" "}
                              - page {event.pageNumber}
                            </span>
                          ) : null}
                          <p className="mt-1 truncate text-xs text-[#68736f]">
                            {file?.name ?? "Unknown file"}
                          </p>
                        </div>
                        <time className="text-xs text-[#68736f]">
                          {new Date(event.occurredAt).toLocaleString()}
                        </time>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#d8d1c7] bg-white p-4 shadow-sm">
      <p className="text-sm text-[#68736f]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#cfc6b9] bg-[#fbfaf7] px-4 py-6 text-center text-sm text-[#68736f]">
      {text}
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
  const localUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/view/${link.token}`;

  return (
    <div className="p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <input
            className="w-full rounded-md border border-[#d8d1c7] px-3 py-2 text-sm font-semibold outline-none focus:border-[#235a4f]"
            onChange={(event) => onUpdate({ title: event.target.value })}
            value={link.title}
          />
          <p className="mt-2 truncate rounded-md bg-[#f7f3ee] px-3 py-2 text-xs text-[#68736f]">
            {localUrl}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md bg-[#235a4f] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1b463e]"
            onClick={onCopy}
            type="button"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            className="rounded-md border border-[#c9c0b3] px-3 py-2 text-sm font-semibold text-[#33413e] transition hover:bg-[#faf8f4]"
            onClick={() => onUpdate({ enabled: !link.enabled })}
            type="button"
          >
            {link.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 rounded-md border border-[#e4ded5] px-3 py-2 text-sm">
          <input
            checked={link.allowDownload}
            onChange={(event) => onUpdate({ allowDownload: event.target.checked })}
            type="checkbox"
          />
          Allow download
        </label>
        <input
          className="rounded-md border border-[#e4ded5] px-3 py-2 text-sm outline-none focus:border-[#235a4f]"
          onChange={(event) =>
            onUpdate({ password: event.target.value || undefined })
          }
          placeholder="Optional password"
          value={link.password ?? ""}
        />
        <input
          className="rounded-md border border-[#e4ded5] px-3 py-2 text-sm outline-none focus:border-[#235a4f]"
          onChange={(event) =>
            onUpdate({ expiresAt: event.target.value || undefined })
          }
          type="datetime-local"
          value={link.expiresAt?.slice(0, 16) ?? ""}
        />
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-5">
        <SmallStat label="Status" value={link.enabled ? "Enabled" : "Disabled"} />
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
    <div className="rounded-md bg-[#f7f3ee] px-3 py-2">
      <span className="block text-xs text-[#68736f]">{label}</span>
      <span className="mt-1 block truncate font-semibold">{value}</span>
    </div>
  );
}
