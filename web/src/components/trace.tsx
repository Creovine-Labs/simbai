export function Trace({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 60"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <line x1="0" y1="42" x2="320" y2="42" stroke="var(--line)" strokeWidth="1" />
      <path
        d="M0 42 H80 l6 -3 6 4 8 -2 H165 l7 -12 6 26 7 -34 6 32 6 -9 7 6 H250 l6 -4 6 4 H320"
        fill="none"
        stroke="var(--signal)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="191" cy="6" r="3" fill="var(--signal)" />
      <circle cx="191" cy="6" r="3" fill="none" stroke="var(--signal)" strokeWidth="1.4">
        <animate attributeName="r" values="3;13" dur="2.2s" repeatCount="indefinite" />
        <animate
          attributeName="opacity"
          values="0.8;0"
          dur="2.2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
