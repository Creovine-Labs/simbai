import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Trace } from "@/components/trace";
import { LivePulse } from "@/components/ui";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface-2 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--signal) 13%, transparent), transparent 60%)",
          }}
        />
        <Brand className="relative text-lg" />

        <div className="relative">
          <h2 className="max-w-[15ch] text-[28px] font-semibold leading-[1.12] tracking-[-0.03em]">
            Know what happens after you hit send.
          </h2>
          <p className="mt-3 max-w-[34ch] text-sm text-ink-2">
            Secure share links for every document, with page-by-page analytics the
            moment someone opens them.
          </p>
          <div className="mt-8 rounded-2xl border border-line bg-surface p-4">
            <Trace className="h-12 w-full" />
            <p className="mt-3 flex items-center gap-2 font-mono text-[11px] text-ink-2">
              <LivePulse />
              2 people are reading &ldquo;Series A &mdash; Simbai.pdf&rdquo; now
            </p>
          </div>
        </div>

        <p className="relative font-mono text-[11px] tracking-wide text-ink-3">
          Simbai &middot; trackable file sharing
        </p>
      </aside>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <Brand className="mb-8 text-base lg:hidden" />
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-ink-2">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <p className="mt-6 text-center text-sm text-ink-2">{footer}</p>
        </div>
      </div>
    </main>
  );
}
