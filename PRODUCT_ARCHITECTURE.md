# Trackable File Sharing Platform - Product Architecture

Last updated: 2026-08-19

## 1. Product Summary

We are building a web platform where users can upload files, generate secure share links, send those links to recipients, and track how recipients interact with the shared content.

The product is closest to a lightweight DocSend-style platform: secure document sharing, link controls, page-level analytics, recipient activity, and a dashboard for follow-up decisions.

The first version should be built locally, then deployed to Vercel when the account and project are ready.

## 2. Comparable Products and Research Notes

### DocSend

DocSend is the clearest commercial reference. It focuses on secure sharing, document analytics, data rooms, page-by-page analytics, real-time notifications, access controls, spaces, NDAs, dynamic watermarking, and eSignature.

Important lessons for our product:

- The core user value is not just file hosting. It is knowing who engaged, when they engaged, and what they cared about.
- Unique links per recipient are important because they make analytics more useful.
- Access can be revoked or changed after a link has already been sent.
- Multiple documents can later be grouped into a "space" or "data room".
- Security and privacy positioning matter because users may upload sensitive files.

Sources:

- https://www.docsend.com/
- https://www.docsend.com/how-it-works/
- https://www.dropbox.com/apps/docsend
- https://www.docsend.com/trust-center/

### Papermark

Papermark is the most relevant open-source reference. It describes itself as an open-source DocSend alternative with secure share links, document analytics, custom branding, custom domains, and self-hosting.

Its public README shows a stack that maps well to our project:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- PostgreSQL
- NextAuth.js
- Tinybird for analytics
- Resend for email
- Stripe for payments
- Vercel for hosting
- AWS S3 or Vercel Blob for file storage

Important lessons for our product:

- Next.js + TypeScript is a good full-stack foundation.
- PostgreSQL should hold users, files, links, recipients, permissions, and event metadata.
- File storage should be separate from the database.
- Analytics can start in Postgres for MVP simplicity and later move to a dedicated analytics store if volume grows.
- Page-level analytics should be designed from the beginning, even if advanced charts come later.

Source:

- https://github.com/papermark/papermark

### Coneshare

Coneshare is an open-source self-hosted DocSend/VDR alternative that adds secure sharing, document tracking, and workflow automation on top of existing storage providers. Its architecture is multi-service: Django/DRF backend, Celery and Redis for async tasks, Go for high-performance file delivery and media streaming, and React/Vite frontend.

Important lessons for our product:

- Separating file delivery/viewing from dashboard logic can matter later.
- Async processing is useful for file conversion, preview generation, emails, webhooks, and heavy analytics jobs.
- Workflow automation can become a future differentiator: Slack alerts, webhooks, CRM updates, and email notifications.

For our MVP, we should not copy this multi-service complexity. We should keep one Next.js app plus managed services, then split services only when scale demands it.

Source:

- https://github.com/coneshare/coneshare

### Hashdocs

Hashdocs positions itself as an open-source data room with link controls and advanced tracking. Its feature list includes domain restrictions, password protection, expiry, secure viewer controls, dynamic watermarks, custom data rooms, and eSignatures.

Important lessons for our product:

- Link controls should be a first-class part of the data model.
- Download disablement, watermarking, email gating, and expiry are expected in this category.
- "Data rooms" are likely a later product expansion after single-file sharing works well.

Sources:

- https://hashdocs.org/
- https://reactjsexample.com/an-open-source-docsend-alternative-with-powerful-link-controls-and-advanced-tracking/

## 3. Product Goals

### Primary Goal

Give a user a simple way to upload a document, share a link, and understand useful engagement signals about how the recipient interacted with that link.

### User Personas

- Founder sending pitch decks to investors.
- Salesperson sending proposals to leads.
- Freelancer sending contracts, portfolios, or deliverables to clients.
- Agency sending client reports or campaign files.
- Recruiter or consultant sending private documents.
- Small team needing external file sharing with better visibility than Google Drive.

### Core User Promise

"Send files as secure links and know what happened after you sent them."

## 4. MVP Scope

The MVP should be intentionally focused. We should build the smallest complete loop:

1. User signs up and logs in.
2. User uploads a PDF or document.
3. System creates a file record and stores the file.
4. User creates a share link.
5. Recipient opens the link in a public viewer.
6. System tracks recipient events.
7. User views analytics in a dashboard.
8. User can disable or delete the link.

### MVP File Types

Start with:

- PDF
- Images: PNG, JPG, JPEG, WEBP

Later:

- DOCX
- PPTX
- XLSX
- Videos
- ZIP files

PDF should be the priority because page-level tracking is clearest there.

### MVP Analytics

Track:

- Link opened
- Viewer session started
- Viewer session ended
- Page viewed
- Time spent per page
- File downloaded, if downloads are enabled
- Device type
- Browser
- Operating system
- Approximate location from IP, if we decide this is legally and ethically appropriate
- Referrer, if available

### MVP Access Controls

Include:

- Public link token
- Link enabled/disabled
- Optional password
- Optional expiry date
- Download allowed/disabled

Download control note:

"Disable download" in the MVP means the viewer will hide download affordances and the server will avoid exposing a permanent direct file URL. It should be positioned as access-control friction, not a perfect technical guarantee. If a recipient can view a PDF or image in their browser, they may still be able to screenshot, print, inspect network traffic, or otherwise capture the content. Stronger protection requires later work such as page-image conversion, watermarking, streaming/proxy controls, and abuse monitoring.

Later:

- Email verification
- Allowed email domains
- Recipient-specific links
- NDA gate
- Dynamic watermarking
- Screenshot/print friction
- Team roles and permissions

## 5. Recommended Technical Stack

### Application

- Next.js with App Router
- TypeScript
- React
- Tailwind CSS
- shadcn/ui or a similar component foundation

Reasoning:

- Works well locally.
- Deploys cleanly to Vercel.
- Supports dashboard pages, public share pages, API routes, server actions, and authentication.
- Strong ecosystem for file upload, PDF rendering, and analytics.

### Database

- PostgreSQL
- Prisma ORM

Recommended provider:

- Supabase Postgres for early development and deployment

Reasoning:

- Postgres is reliable for relational data and event records.
- Prisma gives a clear schema and migration workflow.
- Supabase reduces local database setup friction and removes the need for Docker at the beginning.

### File Storage

Recommended starting choice:

- Supabase Storage

Important rule:

Do not store uploaded files directly in the database. Store metadata in Postgres and binary files in object storage.

Storage access decision:

- Buckets should be private by default.
- Dashboard file access should require an authenticated workspace member.
- Public share links should never reveal long-lived storage URLs.
- The app should issue short-lived signed URLs only after validating the share link, or proxy file bytes/pages through a controlled route if stronger download friction is required.
- File metadata remains in Postgres through Prisma. Binary objects remain in Supabase Storage.

### Authentication

Recommended starting choice:

- Supabase Auth

Reasoning:

- One provider can handle auth, database, and storage.
- Faster MVP setup.
- Less infrastructure overhead.

Supabase Auth and Prisma integration decision:

- Supabase Auth is the source of truth for authentication identity.
- The app database will still have its own User table managed by Prisma.
- User.id should mirror the Supabase auth user id where possible, or store it explicitly as auth_user_id with a unique constraint.
- On first signup/login, the app creates or upserts:
  - User
  - Workspace
  - WorkspaceMember with role owner
- Server-side dashboard requests must read the Supabase session using Supabase SSR helpers, then query Prisma for the matching User and WorkspaceMember rows.
- Middleware can protect broad authenticated routes, but authorization must still happen in server actions/API routes using workspace membership checks.
- The MVP is workspace-backed even for solo users. Team UI can stay hidden until collaboration features are ready.

### Analytics Storage

MVP:

- Store tracking events in Postgres.

Later:

- Move high-volume analytics to Tinybird, ClickHouse, PostHog, or another event analytics store.

Reasoning:

- Postgres is enough for early product validation.
- Dedicated analytics infrastructure adds complexity before we know usage volume.

### Email

MVP:

- Resend

Uses:

- Login verification, if needed.
- Link-view notifications.
- Password reset.
- Team invites later.

### Payments

Later:

- Stripe

Do not build payments in the first MVP unless monetization is required immediately.

## 6. High-Level Architecture

```text
User Browser
  |
  | Dashboard, uploads, analytics
  v
Next.js App on Vercel
  |
  | Auth/session checks
  v
Auth Provider

Next.js App
  |
  | File metadata, users, links, events
  v
PostgreSQL Database

Next.js App
  |
  | Upload and retrieve files
  v
Object Storage

Recipient Browser
  |
  | Opens share link
  v
Public Viewer Route
  |
  | Emits tracking events
  v
Tracking API
  |
  v
PostgreSQL Events Table
```

## 7. Main Application Areas

### 7.1 Marketing / Public Site

Purpose:

- Explain the product.
- Drive signups.
- Show pricing later.

MVP can keep this minimal. The app experience matters more than a large landing page.

### 7.2 Authentication

Required screens:

- Sign up
- Log in
- Forgot password
- Account settings

### 7.3 Dashboard

Required views:

- Overview
- Files
- Links
- Analytics
- Settings

Useful dashboard metrics:

- Total files
- Total links
- Total views
- Unique viewers
- Most-viewed files
- Recent activity
- Top engaged links

### 7.4 File Manager

Core actions:

- Upload file
- Rename file
- Delete/archive file
- View file metadata
- Create share link
- See existing links for file

### 7.5 Link Manager

Core actions:

- Create link
- Copy link
- Enable/disable link
- Set expiry
- Set password
- Toggle download permission
- View analytics per link

### 7.6 Public Viewer

Responsibilities:

- Validate link token.
- Check whether link is enabled.
- Check expiry.
- Check password if required.
- Render the file safely.
- Track session and page activity.
- Respect download setting.

Viewer requirements:

- No dashboard navigation.
- Fast loading.
- Works on mobile and desktop.
- Clear error states for expired, disabled, missing, or password-protected links.

PDF/image rendering decision:

- PDFs should render in the browser with pdf.js or a React wrapper around pdf.js.
- Images should render through controlled app access, not public permanent bucket URLs.
- The public viewer should request file access through the app after link validation.
- For MVP simplicity, the app may return short-lived signed Supabase URLs to pdf.js/images after validating the share token.
- If stronger download friction becomes a hard requirement, move to an app proxy or page-image conversion model where the browser receives page assets rather than the original file.
- Page-level PDF analytics should be driven by pdf.js page visibility/intersection events plus heartbeat events.
- Vercel serverless limits should be considered before doing heavy PDF conversion inside request/response routes. Expensive conversion should be deferred to background jobs later.

### 7.7 Analytics

Analytics should answer:

- Was the link opened?
- When was it opened?
- How many times was it opened?
- Which pages were viewed?
- How long did the viewer spend?
- Did they download?
- Which links are most engaged?
- Which recipients are inactive?

The dashboard should prioritize useful business signals instead of vanity charts.

## 8. Core Data Model

This is a planning-level model. Exact schema can change during implementation.

### User

Represents the account owner.

Fields:

- id
- name
- email
- avatar_url
- created_at
- updated_at

### Workspace

Represents an account container. The MVP is workspace-backed from day one, even when each workspace has only one owner. Team collaboration UI is not part of the MVP, but the schema should include workspaces to avoid a painful migration later.

Fields:

- id
- name
- owner_user_id
- created_at
- updated_at

### WorkspaceMember

Represents user membership in a workspace. In the MVP, each new user receives one workspace and one WorkspaceMember row with role owner. Additional members and visible team-management screens are later features.

Fields:

- id
- workspace_id
- user_id
- role: owner, admin, member, viewer
- created_at

### FileAsset

Represents an uploaded file.

Fields:

- id
- workspace_id
- uploaded_by_user_id
- original_filename
- display_name
- mime_type
- file_size
- storage_provider
- storage_key
- page_count
- status: uploaded, processing, ready, failed, archived
- created_at
- updated_at

### ShareLink

Represents a link that can be sent to recipients.

Fields:

- id
- workspace_id
- file_asset_id
- created_by_user_id
- token
- title
- enabled
- password_hash
- expires_at
- allow_download
- require_email
- created_at
- updated_at

### Recipient

Represents a known viewer when the system captures identity.

Fields:

- id
- workspace_id
- email
- name
- company
- created_at
- updated_at

### ViewerSession

Represents one visit/session through a share link.

Fields:

- id
- share_link_id
- recipient_id
- anonymous_id
- ip_hash
- user_agent
- browser
- os
- device_type
- country
- region
- city
- referrer
- started_at
- ended_at
- duration_seconds

Privacy note:

Store IP carefully. Prefer hashing or truncation unless there is a strong product reason to retain raw IP addresses.

### TrackingEvent

Represents individual actions during a session.

Fields:

- id
- workspace_id
- share_link_id
- file_asset_id
- viewer_session_id
- recipient_id
- event_type
- page_number
- metadata_json
- occurred_at

Event types:

- link_opened
- password_submitted
- viewer_started
- page_viewed
- page_left
- download_clicked
- viewer_closed
- link_blocked

Indexing guidance:

- Index by workspace_id and occurred_at for dashboard analytics.
- Index by share_link_id and occurred_at for link-level analytics.
- Index by viewer_session_id and occurred_at for session timelines.
- Index by file_asset_id and occurred_at for file-level reporting.
- Consider a composite index on workspace_id, event_type, occurred_at for common dashboard filters.

Idempotency and deduplication guidance:

- Event ingestion should accept a client-generated event_id or idempotency_key.
- Heartbeats should be upserted or aggregated instead of blindly inserting noisy duplicate rows.
- Page duration should be calculated from page focus/blur/page-change events and periodically compacted into PageView.
- The app should tolerate repeated events caused by retries, refreshes, network reconnects, and browser lifecycle quirks.

Retention guidance:

- Raw TrackingEvent rows can be retained for a limited period once the product has enough usage data.
- PageView and session aggregates should be retained longer because they power the dashboard with less storage cost.
- Exact retention periods can be finalized with pricing and privacy requirements, but the schema should allow cleanup jobs from the start.

### PageView

Optional aggregate table for faster analytics.

Fields:

- id
- viewer_session_id
- file_asset_id
- share_link_id
- page_number
- first_seen_at
- last_seen_at
- total_seconds
- view_count

## 9. Tracking Design

### Session Tracking

When a recipient opens a share link:

1. Public viewer validates the token.
2. System creates a ViewerSession.
3. Browser receives a session id or anonymous session token.
4. Viewer sends events while the recipient reads.
5. System updates session end time using heartbeat or unload events.

Public tracking API requirements:

- Tracking endpoints must accept only valid share/session tokens.
- Tracking endpoints should not require recipient login.
- Each event should include an idempotency key.
- The server should validate event type, page number, session ownership, and link status.
- The server should reject events for disabled, expired, or invalid links.
- The server should cap metadata size to prevent large payload abuse.
- The server should avoid trusting client-calculated totals without sanity checks.

### Page-Level Tracking

For PDF viewing:

- Track the active visible page.
- Record page_viewed when a page becomes visible.
- Record duration by measuring time between active page changes.
- Send periodic heartbeat events so time is not lost if the tab closes suddenly.

### Accuracy Limits

We should be honest in the product:

- Time-on-page is an estimate.
- Browser unload events are not always reliable.
- Location from IP is approximate.
- Ad blockers or privacy tools can interfere with tracking.

### Identity Strategy

MVP:

- Anonymous sessions by default.
- Optional email capture before viewing.

Later:

- Unique recipient links.
- Email verification.
- CRM-style recipient profiles.

## 10. Security and Privacy Foundation

This product handles potentially sensitive files, so security must be designed early.

### Required Security Rules

- Every file belongs to a workspace.
- Every dashboard request checks authenticated user permissions.
- Share links use long random tokens.
- File access must go through permission checks.
- Direct storage URLs should be private or time-limited.
- Passwords must be hashed, never stored as plain text.
- Deleted/disabled links must stop file access immediately.
- Uploaded files should be validated by MIME type and size.
- Rate limiting should protect public link routes and password attempts.
- Audit logs should be kept for important link and file actions.

Concrete MVP abuse limits:

- Upload size limit: start with 25 MB per file unless product needs require more.
- Accepted upload types: PDF, PNG, JPG, JPEG, WEBP.
- Public viewer route: rate limit by link token and IP fingerprint.
- Password attempts: rate limit by link token and IP fingerprint, with temporary cooldown after repeated failures.
- Tracking ingestion: rate limit by viewer session and IP fingerprint.
- Per-account storage: set a conservative quota in the database even before billing exists.
- Per-account link/event volume: track usage counters so pricing and abuse controls can be added without redesigning the schema.

### Privacy Rules

- Clearly disclose analytics tracking to platform users.
- Avoid collecting unnecessary personal data.
- Treat recipient emails and IP-derived metadata as personal data.
- Provide a way to delete workspace data.
- Consider GDPR/CCPA-style export and deletion later.

### Abuse Prevention

Risks:

- Malware uploads.
- Phishing pages disguised as file links.
- Public links used for spam.
- Sensitive data leaks.

Mitigations:

- File type restrictions.
- File size limits.
- Malware scanning later.
- Rate limits.
- Report abuse flow later.
- Clear account suspension/admin controls later.

## 11. Vercel Deployment Direction

The app should be designed for Vercel from the beginning.

### Vercel-Friendly Choices

- Next.js App Router
- Serverless-compatible API routes
- External Postgres database
- External object storage
- Environment variables for secrets
- No dependency on local disk for uploaded files

### Environment Variables We Will Likely Need

- DATABASE_URL
- NEXT_PUBLIC_APP_URL
- AUTH_SECRET
- STORAGE_PROVIDER
- STORAGE_BUCKET
- STORAGE_ACCESS_KEY
- STORAGE_SECRET_KEY
- RESEND_API_KEY
- STRIPE_SECRET_KEY later
- STRIPE_WEBHOOK_SECRET later

### Local Development

Local development should run on the computer before deployment.

Minimum local requirements:

- Node.js
- npm
- Git
- Code editor
- Access to hosted database/storage, or local Postgres later

Current computer check:

- Node.js is installed.
- npm is installed.
- Git is installed.
- Python is installed.
- Docker was not found.

Docker is not required for the MVP if we use hosted Supabase/Vercel services.

## 12. Recommended Build Phases

### Phase 0 - Foundation

Deliverables:

- Architecture document.
- Product scope.
- Technology decisions.
- Account setup plan for Vercel and database/storage.
- Initial repository setup.

Status:

- This document covers the architecture/foundation step.

### Phase 1 - Local App Skeleton

Deliverables:

- Next.js app.
- TypeScript.
- Styling system.
- Basic dashboard shell.
- Auth setup.
- Database connection.

No file sharing yet.

### Phase 1.5 - Early Thin Deployment

Deliverables:

- Deploy the skeleton app to Vercel.
- Connect production/staging Supabase environment variables.
- Verify auth callback URLs.
- Verify database connection from Vercel.
- Verify storage permissions with a tiny test object if available.
- Smoke test serverless routes.

Reasoning:

Deploying a thin slice early catches Vercel/Supabase issues before upload, viewer, and analytics code depend on them.

### Phase 2 - Upload and File Library

Deliverables:

- Upload PDF/image.
- Store file in object storage.
- Store metadata in Postgres.
- File list dashboard.
- File detail page.

### Phase 3 - Share Links and Public Viewer

Deliverables:

- Create share link.
- Copy share link.
- Public viewer route.
- Link validation.
- Password and expiry support.
- Download toggle.

### Phase 4 - Analytics MVP

Deliverables:

- Viewer sessions.
- Link opened events.
- Page viewed events.
- Time-on-page estimates.
- Download events.
- Link analytics dashboard.

### Phase 5 - Product Polish

Deliverables:

- Better dashboard charts.
- Email notifications.
- Recipient email capture.
- Activity feed.
- Link controls UI.
- Improved empty/loading/error states.

### Phase 6 - Deployment

Deliverables:

- Vercel project.
- Production environment variables.
- Production database.
- Production storage bucket.
- Domain setup.
- Smoke testing.

### Phase 7 - Advanced Features

Possible features:

- Team invites and visible workspace management.
- Data rooms/spaces.
- Multiple files per link.
- Custom branding.
- Custom domains.
- Dynamic watermarking.
- Email verification.
- Allowed domains.
- Webhooks.
- Slack notifications.
- Stripe billing.
- Admin panel.

## 13. MVP Non-Goals

Do not build these at the start:

- Full virtual data rooms.
- eSignature.
- AI document Q&A.
- Enterprise SSO.
- Complex role permissions.
- Native mobile apps.
- Video streaming analytics.
- Full malware scanning pipeline.
- White-label custom domains.
- Payment subscriptions.

These can come after the core product loop works.

## 14. Key Product Decisions To Confirm

Before coding, we should confirm:

1. Product name.
2. First target customer: founders, sales teams, freelancers, agencies, or general users.
3. Whether the MVP should include images alongside PDFs, or whether PDF-only is enough for launch.
4. Whether recipients must enter email before viewing.
5. Whether we start with password-protected links enabled in MVP UI.
6. Whether analytics location tracking should be included in MVP.
7. Whether downloads should be disabled by default or simply configurable per link.
8. Whether the product needs a landing page before the dashboard.

Already decided:

- Use Supabase for auth, database, and storage in the MVP.
- Use Prisma for app database schema and migrations.
- Use a workspace-backed schema from day one, while hiding team UI until later.
- Use pdf.js for MVP PDF viewing.
- Treat download prevention as friction, not a perfect guarantee.
- Deploy a thin vertical slice to Vercel early, after the app skeleton.

## 15. Suggested Initial Decision

Recommended MVP direction:

- Build a Next.js + TypeScript app.
- Use Supabase for Postgres, Auth, and Storage.
- Deploy to Vercel.
- Start with PDF and image uploads.
- Track anonymous link opens, sessions, page views, and downloads.
- Add optional password and expiry to share links.
- Use workspace-backed solo accounts from day one.
- Use Supabase Auth as the identity source and Prisma User/Workspace rows for application authorization.
- Render PDFs with pdf.js through controlled app access to private storage.
- Keep payments, data rooms, and custom domains for later.

This creates the fastest path to a real working product without overbuilding infrastructure too early.
