export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect width="24" height="24" rx="7" fill="var(--signal)" />
      <path
        d="M4.5 14.5h3l2-5 2.6 8 2-6 1.5 3h3.4"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display font-bold tracking-tight text-ink ${className}`}
    >
      <BrandMark className="h-6 w-6 rounded-[7px]" />
      Simbai
    </span>
  );
}
