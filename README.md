# Simbai

Share a document and know what happens after you hit send.

Simbai lets you upload a PDF or an image, make a share link for it, and see
who opened it, which pages they looked at, and whether they downloaded it. It is
built for the moment after you send a pitch deck, a proposal or a report and
want to know if anybody actually looked.

This is an open source project built step by step in the
[Creovine Academy](https://academy.creovine.com) course AI Software
Engineering. Each lesson adds to it, so the history of this repository is the
course.

## What it does

**Your library**

- Sign up with email and password, or continue with Google
- Upload PDFs and images (PNG, JPEG, WebP, GIF), up to 25 MB each and 10 at a time
- Preview any document exactly as the person you share it with will see it
- A profile page to change your name and profile picture

**Share links**

- Make one or more share links per document, each with its own name
- Optional password, checked on the server
- Optional expiry date
- Turn downloading on or off
- Switch a link off at any time, or delete it

**Tracking**

- When a link was opened, and by how many viewers
- Which pages each viewer opened, and how long they had it open
- Who is reading right now
- Download clicks
- A dashboard with totals and an activity feed that updates while you watch

Anyone with a link can open it in their browser. They do not need an account.

## What it does not do yet

- Markdown, Word or other file types. PDFs and images only.
- Search inside documents.
- Teams or shared workspaces. Each account sees only its own files.
- Email notifications when a link is opened.

## How it is built

| Part | Uses |
| --- | --- |
| App | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Sign in | Firebase Authentication (email and password, Google) |
| Storage, deployed | Vercel Blob, for files and app data |
| Storage, on your computer | a JSON file in `web/.data/`, ignored by Git |
| Hosting | Vercel |

The storage choice is automatic: on Vercel (`VERCEL=1`) it uses Blob, on your
own machine it writes to `web/.data/`. A single JSON file is fine for a demo and
is not meant for many users at once. A real database is on the roadmap.

## Run it on your computer

You need Node.js 20 or newer and a Firebase project with Email/Password and
Google sign-in turned on.

```bash
git clone https://github.com/Creovine-Labs/simbai.git
cd simbai/web
npm install
cp .env.example .env.local
```

Open `web/.env.local` and fill in your own Firebase values. They are in the
Firebase console under Project settings, then Your apps. `.env.example` says
what each one is. Then:

```bash
npm run dev
```

and open http://localhost:3000.

`.env.local` is ignored by Git on purpose, so your keys never end up on GitHub.
That is also why a fresh clone cannot sign anybody in until you add them.

## Deploy it

1. Import the repository into Vercel and set the root directory to `web`.
2. Add a Vercel Blob store to the project. That sets `BLOB_READ_WRITE_TOKEN`.
3. Add the Firebase variables from `.env.example` to the project's environment variables.
4. In Firebase, under Authentication, then Settings, then Authorized domains, add your Vercel address. Google sign-in fails without it.

## Checks

From `web/`:

```bash
npm run check   # lint, type check and unit tests
npm run build
```

The same checks run on every pull request.

## Roadmap

- A real database instead of one JSON file
- Search across your documents
- More file types
- Notifications when someone opens your link
- Teams

`PRODUCT_ARCHITECTURE.md` has the longer product thinking behind it.

## License

Copyright 2026 Creovine Labs.

Licensed under the [Apache License, Version 2.0](LICENSE). You can use, change
and share this code, including commercially, as long as you keep the license
and say what you changed.
