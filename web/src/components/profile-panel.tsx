"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Brand } from "@/components/brand";
import { MAX_AVATAR_BYTES, MAX_NAME_LENGTH } from "@/lib/local-product";

type PublicUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl?: string;
  hasCustomAvatar: boolean;
};

export function ProfilePanel() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (cancelled || !payload.user) return;
        setUser(payload.user as PublicUser);
        setName((payload.user as PublicUser).name);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your profile.");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  function applyResult(updated: PublicUser, message: string) {
    setUser(updated);
    setName(updated.name);
    setNotice(message);
    // The header on other pages reads the same data, so refresh it too.
    router.refresh();
  }

  async function send(path: string, init: RequestInit, message: string) {
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const response = await fetch(path, init);

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "That change could not be saved.");
        return;
      }

      applyResult(payload.user as PublicUser, message);
    } finally {
      setBusy(false);
    }
  }

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(
      "/api/profile",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
      "Name updated.",
    );
  }

  function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      setError("Profile pictures must be 2 MB or smaller.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);
    void send(
      "/api/profile",
      { method: "POST", body: formData },
      "Profile picture updated.",
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const nameChanged = user ? name.trim() !== user.name : false;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Brand className="text-base" />
          <Link
            className="tap-target ml-auto inline-flex items-center rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-2 transition hover:border-ink-3 hover:text-ink"
            href="/"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          Account
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Your profile</h1>

        {error ? (
          <div className="mt-5 rounded-lg border border-crit/40 bg-crit/5 px-4 py-3 text-sm text-crit">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-5 rounded-lg border border-good/40 bg-good/5 px-4 py-3 text-sm text-good">
            {notice}
          </div>
        ) : null}

        <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Profile picture</h2>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Avatar
              className="h-16 w-16"
              name={user?.name}
              src={user?.avatarUrl}
              textClassName="text-xl"
            />
            <div className="flex flex-wrap gap-2">
              <label className="tap-target inline-flex cursor-pointer items-center rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-signal-ink">
                {busy ? "Working…" : "Upload new picture"}
                <input
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={uploadAvatar}
                  type="file"
                />
              </label>
              {user?.hasCustomAvatar ? (
                <button
                  className="tap-target rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-2 transition hover:border-ink-3 hover:text-ink"
                  disabled={busy}
                  onClick={() =>
                    void send(
                      "/api/profile",
                      { method: "DELETE" },
                      "Profile picture removed.",
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            PNG, JPEG, GIF or WebP, up to 2 MB.
            {user && !user.hasCustomAvatar
              ? " Right now this comes from the account you signed in with."
              : ""}
          </p>
        </section>

        <section className="mt-5 rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Display name</h2>
          <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={saveName}>
            <label className="flex w-full min-w-0 flex-col gap-1.5 sm:min-w-[240px] sm:flex-1">
              <span className="text-xs font-semibold text-ink-2">Name</span>
              <input
                className="tap-target rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-signal"
                maxLength={MAX_NAME_LENGTH}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <button
              className="tap-target w-full rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-signal-ink disabled:opacity-50 sm:w-auto"
              disabled={busy || !nameChanged || !name.trim()}
              type="submit"
            >
              Save
            </button>
          </form>
        </section>

        <section className="mt-5 rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Email</h2>
          <p className="mt-3 flex flex-wrap items-center gap-2 break-all font-mono text-sm text-ink-2">
            {user?.email ?? "…"}
            {user ? (
              <span
                className={`rounded-full border px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide ${
                  user.emailVerified
                    ? "border-good/40 text-good"
                    : "border-warn/40 text-warn"
                }`}
              >
                {user.emailVerified ? "Verified" : "Unverified"}
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Managed by the account you sign in with, so it cannot be changed here.
          </p>
        </section>

        <section className="mt-5 rounded-xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Session</h2>
          <button
            className="tap-target mt-3 w-full rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-2 transition hover:border-ink-3 hover:text-ink sm:w-auto"
            onClick={() => void logout()}
            type="button"
          >
            Log out
          </button>
        </section>
      </div>
    </main>
  );
}
