"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { DocumentViewer } from "@/components/document-viewer";
import type { ViewerDocument } from "@/components/document-viewer";

type PreviewState =
  | { status: "loading" }
  | { status: "error"; reason: string }
  | { status: "ready"; file: ViewerDocument };

/**
 * Shows an owner their own document exactly as a recipient sees it. Nothing
 * here creates a viewer session or records an event, so looking at your own
 * work never shows up in your own analytics.
 */
export function OwnerPreview() {
  const params = useParams<{ fileId: string }>();
  const router = useRouter();
  const fileId = params.fileId;
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/files/${encodeURIComponent(fileId)}`)
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (!response.ok) {
          setPreview({
            status: "error",
            reason: payload.error ?? "That document could not be opened.",
          });
          return;
        }

        setPreview({ status: "ready", file: payload.file });
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ status: "error", reason: "Could not reach the server." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fileId, router]);

  if (preview.status === "loading") {
    return <Shell title="Opening preview">Loading your document…</Shell>;
  }

  if (preview.status === "error") {
    return (
      <Shell title="Preview unavailable">
        <p className="text-ink-2">{preview.reason}</p>
        <Link
          className="mt-4 inline-flex text-sm font-semibold text-signal-ink"
          href="/"
        >
          Back to dashboard
        </Link>
      </Shell>
    );
  }

  const contentUrl = `/api/files/${encodeURIComponent(preview.file.id)}/content`;

  return (
    <DocumentViewer
      backLabel="Back to dashboard"
      banner={
        <div className="border-b border-signal/25 bg-signal-wash">
          <p className="mx-auto max-w-7xl px-4 py-2.5 text-[13px] text-signal-ink sm:px-6 lg:px-8">
            <span className="font-semibold">Preview.</span> This is what
            recipients see. Nothing you do here is tracked or counted in your
            analytics.
          </p>
        </div>
      }
      contentUrl={contentUrl}
      downloadUrl={`${contentUrl}?download=1`}
      eyebrow="Preview as viewer"
      file={preview.file}
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
