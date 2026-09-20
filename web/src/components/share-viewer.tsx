"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { DocumentViewer } from "@/components/document-viewer";
import type { ViewerDocument } from "@/components/document-viewer";
import { useVisiblePolling } from "@/components/use-poll";
import type { ClientEventType } from "@/lib/local-product";

const PRESENCE_INTERVAL_MS = 30_000;
const REVALIDATE_INTERVAL_MS = 15_000;

type ViewerLink = {
  id: string;
  title: string;
  allowDownload: boolean;
  passwordRequired: boolean;
};

type ViewerState =
  | { status: "loading" }
  | { status: "password"; message: string }
  | { status: "blocked"; reason: string }
  | { status: "ready"; link: ViewerLink; file: ViewerDocument };

export function ShareViewer() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [viewer, setViewer] = useState<ViewerState>({ status: "loading" });
  const [passwordInput, setPasswordInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const recordEvent = useCallback(
    (eventType: ClientEventType, pageNumber?: number) => {
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, eventType, pageNumber }),
      }).catch(() => undefined);
    },
    [token],
  );

  /**
   * The password is checked on the server; a wrong one simply yields no grant,
   * so nothing about the document reaches this component until it is right.
   */
  const requestSession = useCallback(
    async (password?: string): Promise<ViewerState> => {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        if (payload.passwordRequired) {
          return { status: "password", message: password ? payload.reason : "" };
        }

        return {
          status: "blocked",
          reason: payload.reason ?? "This share link is unavailable.",
        };
      }

      return { status: "ready", link: payload.link, file: payload.file };
    },
    [token],
  );

  useEffect(() => {
    let cancelled = false;

    requestSession().then(
      (next) => {
        if (!cancelled) setViewer(next);
      },
      () => {
        if (!cancelled) {
          setViewer({ status: "blocked", reason: "Could not reach the server." });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [requestSession]);

  const isReady = viewer.status === "ready";

  // Presence only — the server records no event for these.
  useVisiblePolling(
    () => {
      void fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch(() => undefined);
    },
    PRESENCE_INTERVAL_MS,
    isReady,
  );

  // Picks up the owner disabling the link, changing its password, or expiring it.
  useVisiblePolling(
    async () => {
      const response = await fetch(`/api/share/${encodeURIComponent(token)}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        setViewer({
          status: "blocked",
          reason: payload.reason ?? "This share link is no longer available.",
        });
        return;
      }

      setViewer((current) =>
        current.status === "ready"
          ? { ...current, link: payload.link, file: payload.file }
          : current,
      );
    },
    REVALIDATE_INTERVAL_MS,
    isReady,
  );

  useEffect(() => {
    if (!isReady) return;

    const onPageHide = () => {
      navigator.sendBeacon?.(
        "/api/events",
        new Blob([JSON.stringify({ token, eventType: "viewer_closed" })], {
          type: "application/json",
        }),
      );
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [isReady, token]);

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    void requestSession(passwordInput)
      .then(setViewer)
      .finally(() => setSubmitting(false));
  }

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

  if (viewer.status === "password") {
    return (
      <Shell title="Password required">
        <form className="max-w-md" onSubmit={submitPassword}>
          <p className="text-sm text-ink-2">This share link is password protected.</p>
          <div className="mt-4 flex gap-2">
            <input
              aria-label="Share link password"
              autoComplete="off"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-signal"
              onChange={(event) => setPasswordInput(event.target.value)}
              placeholder="Enter password"
              type="password"
              value={passwordInput}
            />
            <button
              className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal-ink disabled:opacity-60"
              disabled={submitting || !passwordInput}
              type="submit"
            >
              {submitting ? "Checking…" : "Open"}
            </button>
          </div>
          {viewer.message ? (
            <p className="mt-3 text-sm text-crit">{viewer.message}</p>
          ) : null}
        </form>
      </Shell>
    );
  }

  const contentUrl = `/api/files/${encodeURIComponent(viewer.file.id)}/content?token=${encodeURIComponent(token)}`;

  return (
    <DocumentViewer
      contentUrl={contentUrl}
      downloadUrl={viewer.link.allowDownload ? `${contentUrl}&download=1` : undefined}
      file={viewer.file}
      onDownload={() => recordEvent("download_clicked")}
      onPageChange={(page) => recordEvent("page_viewed", page)}
    />
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
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
      <section className="w-full max-w-xl rounded-xl border border-line bg-surface p-6 shadow-sm">
        <Brand className="text-sm" />
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <div className="mt-4">{children}</div>
      </section>
    </main>
  );
}
