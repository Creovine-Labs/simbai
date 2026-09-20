import type { ReactNode } from "react";

export function LivePulse({ tone = "good" }: { tone?: "good" | "signal" }) {
  const color = tone === "signal" ? "bg-signal" : "bg-good";
  return (
    <span className="relative flex h-2 w-2 flex-none" aria-hidden="true">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${color}`}
      />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

const PILL_TONES = {
  active: "text-good border-good/40",
  expired: "text-warn border-warn/40",
  off: "text-ink-3 border-line",
} as const;

export function Pill({
  tone,
  children,
}: {
  tone: keyof typeof PILL_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 rounded-full border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${PILL_TONES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
