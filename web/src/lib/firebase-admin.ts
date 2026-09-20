import { createPublicKey, verify } from "node:crypto";

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

type FirebaseJwtHeader = {
  alg?: string;
  kid?: string;
};

type FirebaseJwtPayload = {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  exp?: number;
  iat?: number;
};

export type VerifiedFirebaseUser = {
  uid: string;
  email: string;
  name: string;
  picture?: string;
};

let cachedCerts: { expiresAt: number; certs: Record<string, string> } | null =
  null;

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<VerifiedFirebaseUser> {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("Firebase project id is missing.");
  }

  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Firebase ID token is malformed.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJwtPart<FirebaseJwtHeader>(encodedHeader);
  const payload = parseJwtPart<FirebaseJwtPayload>(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Firebase ID token has an invalid header.");
  }

  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];

  if (!cert) {
    throw new Error("Firebase ID token certificate was not found.");
  }

  const signatureIsValid = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey(cert),
    base64UrlToBuffer(encodedSignature),
  );

  if (!signatureIsValid) {
    throw new Error("Firebase ID token signature is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) {
    throw new Error("Firebase ID token has expired.");
  }

  if (!payload.iat || payload.iat > now + 60) {
    throw new Error("Firebase ID token issued-at time is invalid.");
  }

  if (payload.aud !== projectId) {
    throw new Error("Firebase ID token audience is invalid.");
  }

  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Firebase ID token issuer is invalid.");
  }

  if (!payload.sub || payload.sub.length > 128) {
    throw new Error("Firebase ID token subject is invalid.");
  }

  if (!payload.email) {
    throw new Error("Firebase account is missing an email address.");
  }

  return {
    uid: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture,
  };
}

async function getFirebaseCerts() {
  if (cachedCerts && cachedCerts.expiresAt > Date.now()) {
    return cachedCerts.certs;
  }

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) {
    throw new Error("Could not fetch Firebase token certificates.");
  }

  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const certs = (await response.json()) as Record<string, string>;

  cachedCerts = {
    certs,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };

  return certs;
}

function parseJwtPart<T>(value: string): T {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8")) as T;
}

function base64UrlToBuffer(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}
