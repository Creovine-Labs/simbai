"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Login failed.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <AuthShell
      footer={
        <>
          New to Simbai?{" "}
          <Link className="font-semibold text-[#235a4f]" href="/signup">
            Create an account
          </Link>
        </>
      }
      title="Log in"
    >
      <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
        <Field
          label="Email"
          onChange={setEmail}
          type="email"
          value={email}
        />
        <Field
          label="Password"
          onChange={setPassword}
          type="password"
          value={password}
        />
        {error ? <p className="text-sm text-[#9a441b]">{error}</p> : null}
        <button
          className="rounded-md bg-[#235a4f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1b463e]"
          disabled={loading}
          type="submit"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({
  children,
  footer,
  title,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] px-4 text-[#1d2527]">
      <section className="w-full max-w-md rounded-lg border border-[#d8d1c7] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#35635b]">
          Simbai Share
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#68736f]">
          Access your file library, share links, and viewer analytics.
        </p>
        {children}
        <p className="mt-6 text-center text-sm text-[#68736f]">{footer}</p>
      </section>
    </main>
  );
}

function Field({
  label,
  onChange,
  type,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold">
      {label}
      <input
        className="rounded-md border border-[#d8d1c7] px-3 py-3 font-normal outline-none focus:border-[#235a4f]"
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
  );
}
