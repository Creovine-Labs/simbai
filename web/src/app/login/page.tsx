"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import {
  AuthDivider,
  AuthError,
  AuthField,
  GoogleButton,
  SubmitButton,
} from "@/components/auth-form";
import {
  isFirebaseClientConfigured,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/firebase-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await finishFirebaseAuth(() => signInWithEmail(email, password));
  }

  async function continueWithGoogle() {
    await finishFirebaseAuth(signInWithGoogle);
  }

  async function finishFirebaseAuth(
    action: () => Promise<{ user: { getIdToken: () => Promise<string> } }>,
  ) {
    setError("");

    if (!isFirebaseClientConfigured()) {
      setError("Firebase is not configured yet. Add the Firebase env variables first.");
      return;
    }

    try {
      setLoading(true);
      const credential = await action();
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not create app session.");
        return;
      }

      router.push("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in to Simbai"
      subtitle="Your library, share links and viewer analytics."
      footer={
        <>
          New to Simbai?{" "}
          <Link className="font-semibold text-signal-ink" href="/signup">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton
        label="Continue with Google"
        disabled={loading}
        onClick={continueWithGoogle}
      />

      <AuthDivider />

      <form className="flex flex-col gap-3.5" onSubmit={submit}>
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <AuthField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <AuthError message={error} />
        <SubmitButton disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
