# Simbai Web App

This is the Next.js app for the Simbai local V1 prototype: upload a PDF or
image, create a tracked share link, and see what the recipient did with it.

## Run Locally

```bash
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

```bash
npm run dev     # development server
npm run lint    # eslint
npm test        # unit tests (node --test, TypeScript run directly)
npm run build   # production build
npm run start   # serve the production build
npm run check   # lint + typecheck + tests, the same gate CI runs
```

Tests live beside the modules they cover as `src/lib/*.test.ts` and run on
Node's built-in test runner, so there is no test framework to install. Node 23
or newer is required, because the suite imports `.ts` files directly.

## Storage

Local development keeps state in `.data/state.json` and uploaded bytes in
`.data/files/`. Neither is committed.

When `VERCEL=1`, both move to a private Vercel Blob store. The production
direction is still Supabase Auth, PostgreSQL, Supabase Storage, and Vercel.

Vercel Blob bills per operation, and this design reads the whole store on
every request, so request volume is a real cost. Keep it in mind before adding
any polling: the dashboard refreshes every 30s and the viewer every 60s, each
costing one read, and anything the user does themselves updates the page from
that write's own response rather than waiting for a poll. A read failure is
never treated as an empty store — `readServerState` throws
`StoreUnavailableError` so an outage can't lead to a write that erases
everything. This is the main reason to finish the move to Postgres.

Every read-modify-write of the state file is serialized through an in-process
lock, so concurrent requests on one instance cannot clobber each other. The JSON
store has no compare-and-set, so two Vercel instances writing at the same
instant can still lose an update. That limitation goes away with a real
database; do not treat this store as durable under load.

## Sharing model

A share link is a capability: the token in the URL is the only thing standing
between a recipient and the file, so treat the URL as the secret.

On top of the token, a link carries three owner-controlled settings, all
enforced on the server:

- **Enabled / disabled**, re-checked on every request.
- **Expiry**, stored as a UTC instant. The dashboard shows and edits it in your
  local timezone; the browser and the server agree on the moment it lapses.
- **Password**, verified in `/api/sessions`. It is never sent to the viewer.

Opening a link mints a *viewer grant* — an httpOnly cookie naming a viewer
session — and `/api/files/[id]/content` serves bytes only against a valid grant.
The grant is re-validated on every use, so disabling a link, letting it expire,
or changing its password immediately cuts off viewers who are already reading.

### Uploads

Accepted types are decided by sniffing magic bytes, not by the browser's
declared MIME type: PDF, PNG, JPEG, GIF and WebP. SVG is rejected because it is
a scriptable document rather than a picture. Files are served back with the
sniffed type, `X-Content-Type-Options: nosniff`, and a restrictive
`Content-Security-Policy`, so stored content cannot execute on this origin.
The limit is 25 MB per file and 10 files per request.

### Analytics

`page_viewed`, `download_clicked` and `viewer_closed` are the only events a
viewer client may report, and the link and file they belong to are taken from
the grant rather than the request body. Presence ("N viewing now") is a separate
ping that updates a timestamp instead of storing an event, and each link retains
its most recent 500 events.

## Security headers

`src/proxy.ts` issues a per-request nonce and the Content-Security-Policy; this
is why every page is dynamically rendered. Static headers — `nosniff`,
`Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` — are set in
`next.config.ts`.

Note that `proxy.ts` is the Next.js 16 name for what used to be `middleware.ts`.

## Firebase Auth

The Firebase project is `simbai` (web app "Simbai Web"). `web/.env.local` holds
the client config; `web/.env.example` lists the required keys:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
```

Email/Password and Google sign-in are both enabled. The auth flow is:

1. Client signs in with Firebase (`signInWithEmailAndPassword`,
   `createUserWithEmailAndPassword`, or `signInWithPopup` for Google) in
   `src/lib/firebase-client.ts`.
2. The client POSTs the Firebase ID token to `/api/auth/session`.
3. `src/lib/firebase-admin.ts` verifies the token against Google's public certs,
   then `src/lib/auth-server.ts` upserts the user and sets the `simbai_session`
   cookie.

Accounts are keyed on the Firebase UID alone. A sign-in whose email already
belongs to a different UID is refused rather than merged, so registering an
unverified address cannot take over an existing account.

### Deployment (Vercel)

Hosted at `https://web-two-nu-73.vercel.app`. All five Firebase env vars above are
set in the Vercel project (`creovine-academy/web`) for Production, Preview, and
Development. Env-var changes only take effect on the next deployment.

Firebase authorized domains must include every host that runs "Continue with
Google". Currently: `localhost`, `simbai.firebaseapp.com`, `simbai.web.app`. Add
`web-two-nu-73.vercel.app` in Firebase Console → Authentication → Settings →
Authorized domains (and `127.0.0.1` if you run the dev server there).
