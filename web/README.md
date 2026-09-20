# Simbai Web App

This is the Next.js app for the Simbai local V1 prototype.

## Run Locally

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Use `localhost` (not `127.0.0.1`) so Firebase's "Continue with Google" popup works —
`localhost` is an authorized domain by default; `127.0.0.1` is not.

## Scripts

```powershell
npm run dev
npm run lint
npm run build
npm run start
```

## Notes

Local development uses server-side JSON storage at `.data/state.json`. It is intentionally not committed.

When hosted on Vercel, the prototype uses a private Vercel Blob store for uploaded file content and shared state. The production direction is still Supabase Auth, PostgreSQL, Supabase Storage, and Vercel.

The prototype includes Firebase-backed signup/login routes:

```text
/signup
/login
```

Dashboard data is scoped to the logged-in user.

## Firebase Auth

The Firebase project is `simbai` (web app "Simbai Web"). `web/.env.local` already
holds the client config; `web/.env.example` lists the required keys:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
```

Email/Password and Google sign-in are both enabled on the project. The auth flow is:

1. Client signs in with Firebase (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`,
   or `signInWithPopup` for Google) in `src/lib/firebase-client.ts`.
2. The client POSTs the Firebase ID token to `/api/auth/session`.
3. `src/lib/firebase-admin.ts` verifies the token against Google's public certs, then
   `src/lib/auth-server.ts` upserts the user and sets the `simbai_session` cookie.

### Deployment (Vercel)

Hosted at `https://web-two-nu-73.vercel.app`. All five Firebase env vars above are
set in the Vercel project (`creovine-academy/web`) for Production, Preview, and
Development. Env-var changes only take effect on the next deployment.

Firebase authorized domains must include every host that runs "Continue with
Google". Currently: `localhost`, `simbai.firebaseapp.com`, `simbai.web.app`. Add
`web-two-nu-73.vercel.app` in Firebase Console → Authentication → Settings →
Authorized domains (and `127.0.0.1` if you run the dev server there).
