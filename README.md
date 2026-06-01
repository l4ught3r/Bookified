<div align="right">
  <a href="README.md">English</a> | <a href="README.ru.md">Русский</a>
</div>

<div align="center">
  <br />
  <img src="public/icon.svg" alt="Bookified" width="96" height="96" />
  <br />
  <h1>Bookified</h1>
  <p><strong>Personal reading library with offline support and an AI assistant</strong></p>
  <br />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <br />
  <img src="https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk&logoColor=white" alt="Clerk" />
  <img src="https://img.shields.io/badge/Supabase-Storage-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Postgres-Drizzle-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="Postgres" />
  <br />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Gemini-AI-8E75B2?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" />
</div>

---

## About

**Bookified** is a web app for managing and reading your own e-books. Upload files, browse your library, read in the browser with adjustable typography, keep progress locally, and sync metadata when signed in. An integrated AI assistant answers questions about the current book and chapter using Google Gemini.

The UI is available in **English** and **Russian** (`next-intl`, locale prefix in URLs: `/en/...`, `/ru/...`).

### Main routes

| Route                       | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `/[locale]/library`         | Personal library: search, filters, favorites, offline download |
| `/[locale]/add-book`        | Upload a new book                                              |
| `/[locale]/reader/[bookId]` | Reader: reflowable text (EPUB/FB2/TXT) or PDF viewer           |
| `/[locale]`                 | Reader home; resumes last session when possible                |

---

## Features

- **Multi-format upload** — EPUB, FB2, PDF, TXT (up to 100 MB per file)
- **Parsing pipeline** — chapters, table of contents, covers, embedded fonts and images stored in Supabase
- **Reflowable reader** — typography (font, size, line height, margins), TOC, text selection toolbar (copy / ask AI)
- **PDF reader** — page navigation, zoom, fit-to-width, keyboard arrows
- **Library** — grid/list views, search, status filters (reading / finished / favorites), sorting
- **Offline mode** — IndexedDB (Dexie) caches books and reading progress; works without sign-in for local books
- **Cloud sync** — after Clerk sign-in, library metadata syncs with Postgres; files live in Supabase Storage
- **AI assistant** — streaming chat with book/chapter context; excerpt-based context for long chapters (~2500 words); fast model for short queries
- **Themes** — light / dark via `next-themes`
- **Duplicate detection** — by content hash and identifier when uploading

---

## Tech stack

| Layer        | Technology                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Framework    | [Next.js 16](https://nextjs.org/) (App Router, Route Handlers)                                                  |
| UI           | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) |
| Auth         | [Clerk](https://clerk.com/)                                                                                     |
| Database     | [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/)                            |
| File storage | [Supabase Storage](https://supabase.com/storage)                                                                |
| Offline      | [Dexie](https://dexie.org/) (IndexedDB)                                                                         |
| i18n         | [next-intl](https://next-intl-docs.vercel.app/)                                                                 |
| AI           | [Vercel AI SDK](https://sdk.vercel.ai/) + `@ai-sdk/google` (Gemini)                                             |
| PDF          | [react-pdf](https://github.com/wojtekmaj/react-pdf) + pdfjs-dist                                                |
| EPUB         | [@lingo-reader/epub-parser](https://www.npmjs.com/package/@lingo-reader/epub-parser), cheerio                   |

Optional (local / advanced): **Playwright** for browser-based EPUB typography extraction (`BOOKIFIED_PLAYWRIGHT_TYPOGRAPHY`).

---

## Supported formats

| Format | Upload | Reader     | Notes                            |
| ------ | ------ | ---------- | -------------------------------- |
| EPUB   | Yes    | Reflowable | Full pipeline, custom typography |
| FB2    | Yes    | Reflowable | Including `.fb2.zip`             |
| PDF    | Yes    | Page-based | pdf.js viewer                    |
| TXT    | Yes    | Reflowable | Plain text                       |

---

## Prerequisites

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/) (recommended) or Node.js 20+
- [PostgreSQL](https://www.postgresql.org/) — e.g. Supabase Postgres
- [Supabase](https://supabase.com/) project with a **Storage** bucket
- [Clerk](https://clerk.com/) application
- [Google AI](https://aistudio.google.com/) API key (for the reading assistant)

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/l4ught3r/Bookified.git
cd Bookified
bun install
```

### 2. Environment variables

Create `.env` in the project root:

````env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Postgres (Supabase connection string, Drizzle)
DATABASE_URL=postgresql://...

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_SECRET_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_BUCKET_NAME=bookified

# Gemini (AI assistant)
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash
GEMINI_MODEL_FAST=gemini-3.1-flash-lite
# Optional: Gemini Live voice dialog (AI sidebar)
# GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
# User speech in chat is transcribed via GEMINI_MODEL_FAST after each utterance

### 3. Database

```bash
bun run db:push
bun run db:apply-rls
````

### 4. Run locally

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to `/en` or `/ru` based on locale detection.

---
