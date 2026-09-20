"use client";

import { useState } from "react";

export function initials(name?: string) {
  if (!name) return "··";
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "··"
  );
}

/**
 * Shows the profile picture when there is one, and falls back to initials if it
 * is missing or fails to load — provider-hosted avatars do go stale.
 */
export function Avatar({
  name,
  src,
  className = "h-7 w-7",
  textClassName = "text-[11px]",
}: {
  name?: string;
  src?: string;
  className?: string;
  textClassName?: string;
}) {
  // Remembering *which* src failed, rather than a bare flag, means a newly
  // uploaded picture is tried again instead of inheriting the old failure.
  const [failedSrc, setFailedSrc] = useState<string>();

  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className={`flex-none rounded-md object-cover ${className}`}
        key={src}
        onError={() => setFailedSrc(src)}
        referrerPolicy="no-referrer"
        src={src}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid flex-none place-items-center rounded-md bg-signal font-display font-bold text-white ${textClassName} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
