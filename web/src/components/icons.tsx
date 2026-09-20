type IconProps = { className?: string };

const base = "stroke-current";

export function DocIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" className={`${base} ${className}`}>
      <path
        d="M6 2.6h5.2L15.4 6.8V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 2.8V7h4.2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LinkIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" className={`${base} ${className}`}>
      <path
        d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 1 0-4.2-4.2l-1 1"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 1 0 4.2 4.2l1-1"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UploadIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" className={`${base} ${className}`}>
      <path d="M11 14V4.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8.2 11 4.2l4 4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4.5 15v1.6A1.6 1.6 0 0 0 6.1 18.2h9.8a1.6 1.6 0 0 0 1.6-1.6V15"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true" className={`${base} ${className}`}>
      <path
        d="M1.8 11S4.9 5.2 11 5.2 20.2 11 20.2 11 17.1 16.8 11 16.8 1.8 11 1.8 11Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="11" r="2.6" strokeWidth="1.5" />
    </svg>
  );
}
