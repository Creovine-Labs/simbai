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
import { createFirebaseUser, signInWithGoogle } from "@/lib/firebase-client";

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, loading, run } = useFirebaseAuth("Signup failed.");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => createFirebaseUser(name, email, password));
  }

  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      subtitle="Start a private workspace for trackable file sharing."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-semibold text-signal-ink" href="/login">
            Log in
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
          label="Name"
          type="text"
          value={name}
          onChange={setName}
          autoComplete="name"
        />
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
          minLength={8}
          autoComplete="new-password"
        />
        <AuthError message={error} />
        <SubmitButton disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
