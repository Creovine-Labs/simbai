"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { isFirebaseClientConfigured } from "@/lib/firebase-client";

type Credential = { user: { getIdToken: () => Promise<string> } };

/**
 * Shared by login and signup: run a Firebase action, trade the resulting ID
 * token for an app session, then land on the dashboard.
 */
export function useFirebaseAuth(fallbackMessage: string) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (action: () => Promise<Credential>) => {
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

        router.replace("/");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : fallbackMessage);
      } finally {
        setLoading(false);
      }
    },
    [fallbackMessage, router],
  );

  return { error, loading, run };
}
