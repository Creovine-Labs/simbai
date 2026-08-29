"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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

  useEffect(() => {
    queueMicrotask(() => {
      void createSession();
    });
  }, []);

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
  }, [viewer, requiresPassword, activePage]);

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
  }, [activePage, requiresPassword, viewer]);

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

  async function createSession() {
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
  }

  async function recordEvent(event: {
    linkId: string;
    fileId: string;
    sessionId: string;
    eventType: string;
    pageNumber?: number;
    metadata?: Record<string, string | number | boolean>;
  }) {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  }

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
    return `${viewer.file.dataUrl}#page=${activePage}&toolbar=0`;
  }, [activePage, viewer]);

  if (viewer.status === "loading") {
    return <Shell title="Opening secure link">Loading viewer...</Shell>;
  }

  if (viewer.status === "blocked") {
    return (
      <Shell title="Link unavailable">
        <p className="text-[#69736f]">{viewer.reason}</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-[#235a4f]" href="/">
          Back to dashboard
        </Link>
      </Shell>
    );
  }

  if (requiresPassword) {
    return (
      <Shell title={viewer.link.title}>
        <div className="max-w-md">
          <p className="text-sm text-[#69736f]">
            This share link is password protected.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-[#d8d1c7] px-3 py-2 outline-none focus:border-[#235a4f]"
              onChange={(event) => setPasswordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitPassword();
              }}
              placeholder="Enter password"
              type="password"
              value={passwordInput}
            />
            <button
              className="rounded-md bg-[#235a4f] px-4 py-2 text-sm font-semibold text-white"
              onClick={submitPassword}
              type="button"
            >
              Open
            </button>
          </div>
          {passwordInput && passwordInput !== viewer.link.password ? (
            <p className="mt-3 text-sm text-[#9a441b]">Password does not match.</p>
          ) : null}
        </div>
      </Shell>
    );
  }

  return (
    <main className="min-h-screen bg-[#ece8df] text-[#1d2527]">
      <header className="border-b border-[#d8d1c7] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#35635b]">
              Secure viewer
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold">
              {viewer.file.name}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {viewer.link.allowDownload ? (
              <a
                className="rounded-md bg-[#235a4f] px-4 py-2 text-sm font-semibold text-white"
                download={viewer.file.name}
                href={viewer.file.dataUrl}
                onClick={trackDownload}
              >
                Download
              </a>
            ) : (
              <span className="rounded-md border border-[#c9c0b3] px-4 py-2 text-sm font-semibold text-[#69736f]">
                Download disabled
              </span>
            )}
            <Link
              className="rounded-md border border-[#c9c0b3] px-4 py-2 text-sm font-semibold"
              href="/"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-lg border border-[#d8d1c7] bg-white p-3">
          <p className="px-2 py-1 text-sm font-semibold">Pages</p>
          <div className="mt-2 grid grid-cols-4 gap-2 lg:grid-cols-1">
            {Array.from({ length: viewer.file.pageCount }).map((_, index) => {
              const page = index + 1;
              return (
                <button
                  className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                    activePage === page
                      ? "border-[#235a4f] bg-[#edf7f3] text-[#1d4d43]"
                      : "border-[#e4ded5] bg-white"
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

        <div className="min-h-[72vh] overflow-hidden rounded-lg border border-[#d8d1c7] bg-white">
          {viewer.file.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={viewer.file.name}
              className="mx-auto max-h-[78vh] w-auto max-w-full object-contain"
              src={viewer.file.dataUrl}
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

function Shell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] px-4 text-[#1d2527]">
      <section className="w-full max-w-xl rounded-lg border border-[#d8d1c7] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#35635b]">
          Simbai Share
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <div className="mt-4">{children}</div>
      </section>
    </main>
  );
}
