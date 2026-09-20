"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import { FileAsset, ShareLink, ViewerSession } from "@/lib/local-product";

type ViewerState =
  | { status: "loading" }
  | { status: "blocked"; reason: string }
  | {
      status: "ready";
      link: ShareLink;
      file: FileAsset;
      session: ViewerSession;
    };

export default function ShareViewer() {
  const params = useParams<{ token: string }>();
  const [viewer, setViewer] = useState<ViewerState>({ status: "loading" });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordAccepted, setPasswordAccepted] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const openedEventRecorded = useRef(false);

  const recordEvent = useCallback(
    async (event: {
      linkId: string;
      fileId: string;
      sessionId: string;
      eventType: string;
      pageNumber?: number;
      metadata?: Record<string, string | number | boolean>;
    }) => {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    },
    [],
  );

  const createSession = useCallback(async () => {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: params.token,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setViewer({
        status: "blocked",
        reason: payload.reason ?? "This share link is unavailable.",
      });
      return;
    }

    setViewer({
      status: "ready",
      link: payload.link,
      file: payload.file,
      session: payload.session,
    });
  }, [params.token]);

  useEffect(() => {
    queueMicrotask(() => {
      void createSession();
    });
  }, [createSession]);

  const requiresPassword =
    viewer.status === "ready" && viewer.link.password && !passwordAccepted;

  useEffect(() => {
    if (viewer.status !== "ready" || requiresPassword || openedEventRecorded.current) {
      return;
    }

    openedEventRecorded.current = true;
    void recordEvent({
      linkId: viewer.link.id,
      fileId: viewer.file.id,
      sessionId: viewer.session.id,
      eventType: "link_opened",
      pageNumber: activePage,
    });
  }, [viewer, requiresPassword, activePage, recordEvent]);

  useEffect(() => {
    if (viewer.status !== "ready" || requiresPassword) return;

    const heartbeat = window.setInterval(() => {
      void recordEvent({
        linkId: viewer.link.id,
        fileId: viewer.file.id,
        sessionId: viewer.session.id,
        eventType: "page_viewed",
        pageNumber: activePage,
        metadata: { heartbeat: true },
      });
    }, 8000);

    return () => window.clearInterval(heartbeat);
  }, [activePage, requiresPassword, viewer, recordEvent]);

  useEffect(() => {
    if (viewer.status !== "ready") return;

    const revalidate = window.setInterval(async () => {
      const response = await fetch(`/api/share/${params.token}`);
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setViewer({
          status: "blocked",
          reason: payload.reason ?? "This share link is no longer available.",
        });
      } else {
        setViewer((current) =>
          current.status === "ready"
            ? { ...current, link: payload.link, file: payload.file }
            : current,
        );
      }
    }, 5000);

    return () => window.clearInterval(revalidate);
  }, [params.token, viewer.status]);

  function submitPassword() {
    if (viewer.status !== "ready") return;
    setPasswordAccepted(passwordInput === viewer.link.password);
  }

  function setPage(page: number) {
    if (viewer.status !== "ready") return;
    setActivePage(page);
    void recordEvent({
      linkId: viewer.link.id,
      fileId: viewer.file.id,
      sessionId: viewer.session.id,
      eventType: "page_viewed",
      pageNumber: page,
    });
  }

  function trackDownload() {
    if (viewer.status !== "ready") return;
    void recordEvent({
      linkId: viewer.link.id,
      fileId: viewer.file.id,
      sessionId: viewer.session.id,
      eventType: "download_clicked",
      pageNumber: activePage,
    });
  }

  const pdfSrc = useMemo(() => {
    if (viewer.status !== "ready" || viewer.file.kind !== "pdf") return "";
    return `${fileContentUrl(viewer.file.id, params.token)}#page=${activePage}&toolbar=0`;
  }, [activePage, params.token, viewer]);

  if (viewer.status === "loading") {
    return <Shell title="Opening secure link">Loading viewer…</Shell>;
  }

  if (viewer.status === "blocked") {
    return (
      <Shell title="Link unavailable">
        <p className="text-ink-2">{viewer.reason}</p>
        <Link
          className="mt-4 inline-flex text-sm font-semibold text-signal-ink"
          href="/"
        >
          Back to dashboard
        </Link>
      </Shell>
    );
  }

  if (requiresPassword) {
    return (
      <Shell title={viewer.link.title}>
        <div className="max-w-md">
          <p className="text-sm text-ink-2">This share link is password protected.</p>
          <div className="mt-4 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-signal"
              onChange={(event) => setPasswordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitPassword();
              }}
              placeholder="Enter password"
              type="password"
              value={passwordInput}
            />
            <button
              className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal-ink"
              onClick={submitPassword}
              type="button"
            >
              Open
            </button>
          </div>
          {passwordInput && passwordInput !== viewer.link.password ? (
            <p className="mt-3 text-sm text-crit">Password does not match.</p>
          ) : null}
        </div>
      </Shell>
    );
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              Secure viewer
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold">{viewer.file.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {viewer.link.allowDownload ? (
              <a
                className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal-ink"
                download={viewer.file.name}
                href={fileContentUrl(viewer.file.id, params.token)}
                onClick={trackDownload}
              >
                Download
              </a>
            ) : (
              <span className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-3">
                Download disabled
              </span>
            )}
            <Link
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-2 transition hover:border-ink-3 hover:text-ink"
              href="/"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="h-max rounded-xl border border-line bg-surface p-3">
          <p className="px-2 py-1 text-sm font-semibold">Pages</p>
          <div className="mt-2 grid grid-cols-4 gap-2 lg:grid-cols-1">
            {Array.from({ length: viewer.file.pageCount }).map((_, index) => {
              const page = index + 1;
              const active = activePage === page;
              return (
                <button
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-signal bg-signal-wash text-signal-ink"
                      : "border-line bg-surface hover:bg-surface-2"
                  }`}
                  key={page}
                  onClick={() => setPage(page)}
                  type="button"
                >
                  Page {page}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-h-[72vh] overflow-hidden rounded-xl border border-line bg-surface">
          {viewer.file.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={viewer.file.name}
              className="mx-auto max-h-[78vh] w-auto max-w-full object-contain"
              src={fileContentUrl(viewer.file.id, params.token)}
            />
          ) : (
            <iframe
              className="h-[78vh] w-full"
              src={pdfSrc}
              title={viewer.file.name}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function fileContentUrl(fileId: string, token: string) {
  return `/api/files/${fileId}/content?token=${encodeURIComponent(token)}`;
}

function Shell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
      <section className="w-full max-w-xl rounded-xl border border-line bg-surface p-6 shadow-sm">
        <Brand className="text-sm" />
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <div className="mt-4">{children}</div>
      </section>
    </main>
  );
}
