"use client";

import Link from "next/link";
import { ReactNode, useMemo, useState } from "react";

export type ViewerDocument = {
  id: string;
  name: string;
  kind: "pdf" | "image";
  pageCount: number;
};

/**
 * The reader UI, with no opinion on where the document came from. The share
 * viewer wires tracking into it; the owner preview deliberately does not.
 */
export function DocumentViewer({
  file,
  contentUrl,
  downloadUrl,
  onPageChange,
  onDownload,
  banner,
  eyebrow = "Secure viewer",
  backHref = "/",
  backLabel = "Dashboard",
}: {
  file: ViewerDocument;
  contentUrl: string;
  downloadUrl?: string;
  onPageChange?: (page: number) => void;
  onDownload?: () => void;
  banner?: ReactNode;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const [activePage, setActivePage] = useState(1);

  function goToPage(page: number) {
    setActivePage(page);
    onPageChange?.(page);
  }

  const pdfSrc = useMemo(
    () =>
      file.kind === "pdf" ? `${contentUrl}#page=${activePage}&toolbar=0` : "",
    [activePage, contentUrl, file.kind],
  );

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              {eyebrow}
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold">{file.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {downloadUrl ? (
              <a
                className="tap-target inline-flex items-center rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal-ink"
                download={file.name}
                href={downloadUrl}
                onClick={onDownload}
              >
                Download
              </a>
            ) : (
              <span className="tap-target inline-flex items-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-3">
                Download disabled
              </span>
            )}
            <Link
              className="tap-target inline-flex items-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-2 transition hover:border-ink-3 hover:text-ink"
              href={backHref}
            >
              {backLabel}
            </Link>
          </div>
        </div>
      </header>

      {banner}

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="h-max min-w-0 rounded-xl border border-line bg-surface p-3">
          <p className="px-2 py-1 text-sm font-semibold">Pages</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-1">
            {Array.from({ length: file.pageCount }).map((_, index) => {
              const page = index + 1;
              const active = activePage === page;
              return (
                <button
                  className={`tap-target rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-signal bg-signal-wash text-signal-ink"
                      : "border-line bg-surface hover:bg-surface-2"
                  }`}
                  key={page}
                  onClick={() => goToPage(page)}
                  type="button"
                >
                  Page {page}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-h-[60vh] min-w-0 overflow-hidden rounded-xl border border-line bg-surface sm:min-h-[72vh]">
          {file.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={file.name}
              className="mx-auto max-h-[78vh] w-auto max-w-full object-contain"
              src={contentUrl}
            />
          ) : (
            <iframe className="h-[78vh] w-full" src={pdfSrc} title={file.name} />
          )}
        </div>
      </section>
    </main>
  );
}
