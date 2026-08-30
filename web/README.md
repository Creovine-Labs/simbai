# Simbai Web App

This is the Next.js app for the Simbai local V1 prototype.

## Run Locally

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

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

The prototype includes signup/login routes:

```text
/signup
/login
```

Dashboard data is scoped to the logged-in user.
