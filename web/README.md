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

The current prototype uses local server-side JSON storage at `.data/state.json`. It is intentionally not committed. The production direction is Supabase Auth, PostgreSQL, Supabase Storage, and Vercel.
