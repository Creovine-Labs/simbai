"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import {
  AuthDivider,
  AuthError,
  AuthField,
  GoogleButton,
  SubmitButton,
} from "@/components/auth-form";
import { useFirebaseAuth } from "@/components/use-firebase-auth";
import { signInWithEmail, signInWithGoogle } from "@/lib/firebase-client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, loading, run } = useFirebaseAuth("Login failed.");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => signInWithEmail(email, password));
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
        onClick={() => void run(signInWithGoogle)}
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
