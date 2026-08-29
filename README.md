# Simbai

Simbai is a trackable file-sharing platform prototype. Users can upload files, create share links, open those links in a public viewer, and track viewer activity from a dashboard.

## Current Version

This repository currently contains a local V1 prototype. It is designed for product testing before Supabase, authentication, persistent object storage, and Vercel deployment are connected.

Implemented in local V1:

- PDF and image uploads
- Share-link creation
- Public viewer route
- Link enable/disable controls
- Optional password and expiry fields
- Download permission toggle
- Viewer sessions
- Page-view and heartbeat events
- Download click tracking
- Dashboard analytics summary and activity feed
- Local server-side JSON storage for demo data

## Project Structure

```text
.
├── PRODUCT_ARCHITECTURE.md
├── README.md
└── web
    ├── src/app
    │   ├── api
    │   ├── page.tsx
    │   └── view/[token]/page.tsx
    └── src/lib
```

## Local Development

Requirements:

- Node.js 20+
- npm

Run the app:

```bash
cd web
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## Verification

From the `web` directory:

```bash
npm run lint
npm run build
```

## Local Data

Local V1 stores prototype files, links, sessions, and events in:

```text
web/.data/state.json
```

That file is ignored by Git.

## Roadmap

Next major steps:

- Connect Supabase Auth
- Add PostgreSQL and Prisma schema
- Move file storage to Supabase Storage
- Replace local JSON tracking with database-backed events
- Deploy an early thin slice to Vercel

See `PRODUCT_ARCHITECTURE.md` for the full product architecture.
