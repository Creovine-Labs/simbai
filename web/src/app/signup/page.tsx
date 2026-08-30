"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Signup failed.");
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] px-4 text-[#1d2527]">
      <section className="w-full max-w-md rounded-lg border border-[#d8d1c7] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#35635b]">
          Simbai Share
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-[#68736f]">
          Start a private workspace for trackable file sharing.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
          <Field label="Name" onChange={setName} type="text" value={name} />
          <Field label="Email" onChange={setEmail} type="email" value={email} />
          <Field
            label="Password"
            minLength={8}
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#68736f]">
          Already have an account?{" "}
          <Link className="font-semibold text-[#235a4f]" href="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}

function Field({
  label,
  minLength,
  onChange,
  type,
  value,
}: {
  label: string;
  minLength?: number;
  onChange: (value: string) => void;
  type: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold">
      {label}
      <input
        className="rounded-md border border-[#d8d1c7] px-3 py-3 font-normal outline-none focus:border-[#235a4f]"
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
  );
}
