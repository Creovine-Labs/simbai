import type { ReactNode } from "react";

const FIELD_CLASS =
  "rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-signal";

export function GoogleButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-ink-3 disabled:opacity-60"
    >
      <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 3.5 29.3 1.5 24 1.5 11.6 1.5 1.5 11.6 1.5 24S11.6 46.5 24 46.5 46.5 36.4 46.5 24c0-1.2-.1-2.3-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M4.3 14.7l6.6 4.8C12.7 15 17.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 3.5 29.3 1.5 24 1.5 15.6 1.5 8.3 6.3 4.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 46.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 37.6 26.7 38.5 24 38.5c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C10.1 41.6 16.5 46.5 24 46.5z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C41 36.3 46.5 31 46.5 24c0-1.2-.1-2.3-.4-3.5z"
        />
      </svg>
      {label}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="my-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-3">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function AuthField({
  label,
  type,
  value,
  onChange,
  minLength,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      <input
        required
        type={type}
        value={value}
        minLength={minLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      />
    </label>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm text-crit">{message}</p>;
}

export function SubmitButton({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-lg bg-signal px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-signal-ink disabled:opacity-70"
    >
      {children}
    </button>
  );
}
