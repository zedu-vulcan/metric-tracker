# Metric Tracker

A marketing metrics dashboard built by several teams on one shared codebase. The project starts as a bare shell: Google sign-in, an authenticated dashboard layout with an empty **Overview** page, and the plumbing for API routes, the database and API docs. Each team builds its features on top of it.

**Live:** https://metrics.zedu.chat

> Using an AI coding agent? It must follow [`AGENTS.md`](AGENTS.md). Claude Code loads it through `CLAUDE.md`, and Codex, Cursor and others read `AGENTS.md` directly.

---

## Contents

- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Git workflow](#git-workflow)
- [Building pages (frontend)](#building-pages-frontend)
- [Building API endpoints (backend)](#building-api-endpoints-backend)
- [Database & migrations](#database--migrations)
- [Authentication](#authentication)
- [Deployment](#deployment)
- [SEO Analytics](#seo-analytics)
- [Troubleshooting](#troubleshooting)

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS v4 + shadcn/ui (Radix primitives, lucide icons) |
| Backend | Next.js Route Handlers (`src/app/api/**/route.ts`) |
| Validation | Zod, documented as OpenAPI via `@asteasolutions/zod-to-openapi` |
| ORM | Prisma 5 |
| Database | PostgreSQL (Neon) |
| Auth | NextAuth v4 with Google OAuth, database sessions |
| Deployment | Coolify (Docker) |
| CI | GitHub Actions: malware scan gate, then deploy |

---

## Getting started

### Prerequisites

- **Node.js 20+** (the Docker image uses Node 20)
- **npm**. Use npm only, so `package-lock.json` stays the single lockfile.
- Access to the team `.env` file. Ask the project lead.

### 1. Clone and install

```bash
git clone https://github.com/zedu-vulcan/metric-tracker.git
cd metric-tracker
npm install
```

### 2. Add the environment file

Put the `.env` file you were given in the project root, next to `package.json`. It already points at the **shared team database** and the Google OAuth app.

> `.env` is git-ignored. **Never commit it, paste it into issues or PRs, or share it outside the team.**

`.env.example` lists every variable the app needs:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (the shared Neon database) |
| `NEXTAUTH_SECRET` | Secret used to sign sessions |
| `NEXTAUTH_URL` | Public URL of the app. Use `http://localhost:3000` locally |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `GOOGLE_ANALYTICS_CLIENT_EMAIL` / `GOOGLE_ANALYTICS_PRIVATE_KEY` | Service account that reads Search Console and GA4 (see [SEO Analytics](#seo-analytics)) |
| `GSC_SITE_URL` | Search Console property, e.g. `sc-domain:zedu.chat` |
| `GA4_PROPERTY_ID` | GA4 property ID (numbers only) |
| `SEO_ANALYTICS_DEMO` | `true` shows labelled demo data on `/dashboard/seo` in development. Ignored in production |

If you add a new environment variable, add it to `.env.example` with a placeholder value and tell the project lead, so it can be added to the shared `.env` and to Coolify.

### 3. Start the dev server

```bash
npm run dev
```

`npm run dev` runs `prisma generate` first, so the Prisma client always matches the schema. Open http://localhost:3000 and sign in with Google to reach `/dashboard`.

You don't need to run migrations to get started: the shared database already has every migration that is on `main`.

### Useful local URLs

| URL | What it is |
|---|---|
| http://localhost:3000 | Sign-in page |
| http://localhost:3000/dashboard | Dashboard (requires sign-in) |
| http://localhost:3000/docs | Interactive API reference (Scalar) |
| http://localhost:3000/api/openapi | Raw OpenAPI 3.1 JSON |
| http://localhost:3000/api/health | Health check |

---

## Available scripts

| Script | What it does |
|---|---|
| `npm run dev` | `prisma generate`, then start the dev server |
| `npm run build` | `prisma migrate deploy` + `prisma generate` + `next build` (used by Docker/CI) |
| `npm run start` | `prisma generate`, then start the production server (uses `$PORT`, default 3000) |
| `npm run db:generate` | Regenerate the Prisma client after the schema changes |
| `npm run db:migrate` | Create **and apply** a migration from your schema changes (development) |
| `npm run db:deploy` | Apply pending migrations without prompting (production/CI) |
| `npm run lint` | `next lint`. ESLint is not configured yet, so the first run will prompt you to set it up |

> **Don't run `npm run build` locally against the shared database.** It runs `prisma migrate deploy` first. To check that your code compiles, use `npx tsc --noEmit` or `npx next build`.

---

## Project structure

```
prisma/
  schema.prisma            # All database models live here
  migrations/              # Generated SQL migrations — commit these, never edit applied ones
src/
  app/
    layout.tsx             # Root layout (fonts, global CSS)
    globals.css            # Tailwind + theme tokens (colors, radius, fonts)
    page.tsx               # Sign-in page
    not-found.tsx          # 404 page
    dashboard/
      layout.tsx           # Auth guard + sidebar shell for every /dashboard/* page
      page.tsx             # Overview page
      seo/page.tsx         # SEO Analytics (Search Console + GA4 charts)
    api/
      auth/[...nextauth]/  # NextAuth (don't change without discussing)
      health/              # GET /api/health
      seo/                 # GET /api/seo/search-performance, /api/seo/traffic-channels
      openapi/             # GET /api/openapi — generated OpenAPI document
    docs/route.ts          # /docs — Scalar API reference UI
  components/
    ui/                    # shadcn/ui components (generated, themed)
    seo/                   # SEO Analytics charts, date-range bar, data hook
    SidebarNav.tsx         # SidebarNavList / SidebarNavLink
    Wordmark.tsx
    AuthButtons.tsx
  lib/
    api.ts                 # requireAuth() helper for route handlers
    auth.ts                # NextAuth config
    prisma.ts              # Shared Prisma client — always import from here
    openapi.ts             # OpenAPI registry + document generator
    zod.ts                 # Zod with `.openapi()` enabled — import `z` from here
    utils.ts               # cn() class-name helper
    seo/                   # SEO types, date + format helpers, transforms
      server/              # Google auth, Search Console + GA4 clients, cache, demo data (server-only)
```

The path alias `@/` maps to `src/`, as in `import { prisma } from "@/lib/prisma"`.

---

## Git workflow

1. **Start from an up-to-date `main`:**
   ```bash
   git checkout main && git pull
   git checkout -b feat/<ticket>-short-description
   ```
   Branch prefixes: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`, for example `feat/vulcan-31-campaign-list`.
2. **Commit in small, focused steps** using conventional messages: `feat: add campaigns list endpoint`, `fix: handle empty budget`.
3. **Before you open a PR**, rebase on the latest `main` and make sure the code type-checks:
   ```bash
   git fetch origin && git rebase origin/main
   npx tsc --noEmit
   ```
4. **Open a PR into `main`.** Say what changed and how to test it, and **call out any migration** in the description. Get at least one review before merging.
5. The **Malware Scan (CI Gate)** workflow runs on every PR and must pass.

> ⚠️ **Merging into `main` deploys to production.** Pushes to `main` run the malware scan, then trigger a Coolify deploy that applies any new migrations to the production database. Only merge work that is ready to ship.

### Avoiding conflicts between teams

- Keep each feature in its own folders: `src/app/dashboard/<feature>/`, `src/app/api/<feature>/`, `src/lib/schemas/<feature>.ts`.
- Some files are shared by everyone: `prisma/schema.prisma`, `src/lib/openapi.ts`, `src/app/dashboard/layout.tsx` (the sidebar), `src/app/globals.css` and `src/components/ui/*`. Keep your changes to them small, and mention them in your PR.
- Don't change shared shadcn components in `src/components/ui/` for one feature. Compose them in your own component instead, or agree the change with the other teams.

---

## Building pages (frontend)

### Add a page

Every route under `src/app/dashboard/` automatically gets the sidebar and the sign-in check from `src/app/dashboard/layout.tsx`.

```tsx
// src/app/dashboard/campaigns/page.tsx  →  /dashboard/campaigns
export default function CampaignsPage() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center border-b bg-background/90 px-4 backdrop-blur-sm sm:px-[clamp(20px,4vw,48px)]">
      <h1 className="m-0 text-base leading-none font-bold tracking-[-0.03em] text-foreground">Campaigns</h1>
    </header>
  );
}
```

### Add it to the sidebar

Add a `SidebarNavLink` in `src/app/dashboard/layout.tsx`:

```tsx
import { LayoutGridIcon, MegaphoneIcon } from "lucide-react";

<SidebarNavList aria-label="Main navigation">
  <SidebarNavLink href="/dashboard" icon={<LayoutGridIcon aria-hidden="true" />}>Overview</SidebarNavLink>
  <SidebarNavLink href="/dashboard/campaigns" icon={<MegaphoneIcon aria-hidden="true" />}>Campaigns</SidebarNavLink>
</SidebarNavList>
```

`SidebarNavLink` sets `aria-current="page"` itself by comparing its `href` with `usePathname()` (`/dashboard` matches only itself; other links also match their sub-pages).

### Server vs client components

- Pages and layouts are **server components** by default. They can `await prisma...` or `getServerSession(authOptions)` directly, so most read-only pages don't need their own API route.
- Add `"use client"` at the top only for components that use state, effects, event handlers or browser APIs (forms, dialogs, menus). Client components call your API routes with `fetch("/api/...")`, then usually call `router.refresh()` to reload server data.

### UI components and styling

- **Use shadcn/ui first.** Check `src/components/ui/` for what's already installed. Add more with:
  ```bash
  npx shadcn@latest add tabs card chart
  ```
  Docs: https://ui.shadcn.com/docs/components
- **Style with Tailwind utilities and the theme tokens** defined in `src/app/globals.css`. Don't use raw hex values or new CSS files.

| Token (Tailwind class) | Use for |
|---|---|
| `bg-background`, `text-foreground` | Page surface and body text |
| `bg-card`, `bg-popover` | Raised white surfaces |
| `bg-primary`, `text-primary-foreground`, `bg-primary-deep` | Brand violet: primary actions and active state |
| `bg-accent`, `text-accent-foreground` | Light violet tint for selected and highlighted items |
| `text-muted-foreground`, `bg-muted` | Secondary text and quiet fills |
| `border-border`, `border-border-strong` | Hairlines and stronger dividers |
| `bg-sidebar`, `bg-sidebar-accent` | Sidebar surfaces |
| `success` / `warning` / `info` / `destructive` (+ `-muted`) | Status colors, for example `<Badge variant="success">` |
| `font-sans` (Manrope), `font-mono` (JetBrains Mono) | Use the mono font for numbers, IDs and metrics |

- Use `cn()` from `@/lib/utils` to combine conditional class names.
- Use icons from `lucide-react`.

---

## Building API endpoints (backend)

The backend is made of **Next.js Route Handlers**. There is no separate server. Each folder under `src/app/api/` that contains a `route.ts` becomes an endpoint, and each exported function (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`) handles that HTTP method.

```
src/app/api/campaigns/route.ts          →  GET, POST    /api/campaigns
src/app/api/campaigns/[id]/route.ts     →  GET, PATCH, DELETE  /api/campaigns/:id
```

Docs: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers

### Conventions

Every endpoint follows these rules:

1. **Authenticate first.** Call `requireAuth()` from `@/lib/api` and return its error when there's no session. The only exceptions are deliberately public endpoints like `/api/health`.
2. **Validate input with Zod.** Put request schemas in `src/lib/schemas/<feature>.ts`, import `z` from `@/lib/zod` (not from `"zod"`), and call `.safeParse()` on them.
3. **Use the shared Prisma client** from `@/lib/prisma`. Never create `new PrismaClient()` yourself.
4. **Return consistent JSON:**

   | Situation | Status | Body |
   |---|---|---|
   | Read / update OK | `200` | The resource or list |
   | Created | `201` | The created resource |
   | Deleted | `204` | No body |
   | Invalid input | `400` | `{ "error": "Validation failed", "details": { "field": ["message"] } }` |
   | Not signed in | `401` | `{ "error": "Unauthorized" }` (from `requireAuth`) |
   | Not found | `404` | `{ "error": "Not found" }` |

5. **Document the endpoint** in `src/lib/openapi.ts` so it shows up at `/docs`.
6. Add `export const dynamic = "force-dynamic";` to routes that read the session or the database, so Next.js never caches them at build time.

### Worked example: a `campaigns` endpoint

**1. Add the model**: see [Database & migrations](#database--migrations).

```prisma
// prisma/schema.prisma
model Campaign {
  id        String   @id @default(cuid())
  name      String
  budget    Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

```bash
npm run db:migrate -- --name add_campaign
```

**2. Define the request schema**

```ts
// src/lib/schemas/campaign.ts
import { z } from "@/lib/zod";

export const CampaignBodySchema = z.object({
  name: z.string().min(1, "Name is required").openapi({ example: "Spring launch" }),
  budget: z.number().int().nonnegative().optional().openapi({ example: 5000 }),
});
```

**3. Write the collection route**

```ts
// src/app/api/campaigns/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { CampaignBodySchema } from "@/lib/schemas/campaign";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const result = CampaignBodySchema.safeParse(await req.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const campaign = await prisma.campaign.create({ data: result.data });
  return NextResponse.json(campaign, { status: 201 });
}
```

**4. Write the single-item route.** In Next.js 14, `params` is a plain object, not a Promise.

```ts
// src/app/api/campaigns/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAuth();
  if (error) return error;

  const existing = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.campaign.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
```

**5. Document it** in `src/lib/openapi.ts`, below the `registry` definition:

```ts
import { z } from "@/lib/zod";
import { CampaignBodySchema } from "@/lib/schemas/campaign";

const CampaignSchema = registry.register(
  "Campaign",
  CampaignBodySchema.extend({
    id: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }).openapi("Campaign"),
);

registry.registerPath({
  method: "post",
  path: "/api/campaigns",
  tags: ["Campaigns"],
  summary: "Create a campaign",
  security: [{ sessionCookie: [] }],
  request: { body: { required: true, content: { "application/json": { schema: CampaignBodySchema } } } },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: CampaignSchema } } },
    400: { description: "Validation error" },
    401: { description: "Unauthorized" },
  },
});
```

Group each team's registrations under a `// ── <Feature> ──` comment to keep merge conflicts small.

**6. Try it.** Sign in at http://localhost:3000 in your browser, then open http://localhost:3000/docs. The session cookie is sent automatically, so you can call the endpoint from there. To call it from the terminal, copy the `next-auth.session-token` cookie from your browser's dev tools:

```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<your-token>" \
  -d '{"name":"Spring launch","budget":5000}'
```

---

## Database & migrations

All models live in `prisma/schema.prisma`. Today it contains only the NextAuth tables (`User`, `Account`, `Session`, `VerificationToken`). Leave those as they are unless the change is agreed with everyone.

> ⚠️ **Everyone shares one database.** A migration you run locally changes the database for **every** team straight away. Read this section before you touch the schema.

### Adding or changing a model

1. **Pull the latest `main` first**, so you have every migration other teams have already applied:
   ```bash
   git checkout main && git pull
   git checkout <your-branch> && git rebase main
   ```
2. **Edit `prisma/schema.prisma`.** Add your model, or change one your team owns.
3. **Create and apply the migration** with a descriptive snake_case name:
   ```bash
   npm run db:migrate -- --name add_campaign
   ```
   This writes `prisma/migrations/<timestamp>_add_campaign/migration.sql`, applies it to the database and regenerates the Prisma client.
   To review the SQL before it runs, create the file without applying it, then apply it:
   ```bash
   npm run db:migrate -- --name add_campaign --create-only   # writes the SQL only
   npm run db:migrate                                         # applies it
   ```
4. **Commit the schema and the migration folder together**, in the same PR as the code that uses them.
5. **Merge promptly.** Once your migration is applied to the shared database, other teams' branches will find a migration they don't have until it reaches `main`.

### Rules

- 🚫 **Never answer "yes" if `prisma migrate dev` asks to reset the database.** A reset **deletes all data for every team**. It usually means your branch is missing a migration someone else has applied: pull/rebase onto `main` and try again. If that doesn't fix it, ask in the team channel before doing anything else.
- 🚫 **Never run `prisma migrate reset` or `prisma db push`** against the shared database.
- 🚫 **Never edit or delete a migration that has already been applied** or merged. Write a new migration instead.
- ✅ **Prefer additive changes.** Add new models and new optional (or defaulted) fields. Renaming or dropping columns that another team uses needs agreement first.
- ✅ **After pulling changes that touch the schema**, run `npm run db:generate`, or restart `npm run dev`, so your Prisma client types match.

### How migrations reach production

You never run migrations against production yourself. When a PR is merged to `main`, the deploy applies every pending migration with `prisma migrate deploy` (in `npm run build` and in the Docker `CMD`).

### Inspecting data

```bash
npx prisma studio      # opens a browser UI for the database in .env — be careful, it's shared
```

---

## Authentication

Sign-in uses Google OAuth through NextAuth v4 (`src/lib/auth.ts`). Sessions are stored in the database.

- **In a server component or layout:**
  ```ts
  import { getServerSession } from "next-auth";
  import { authOptions } from "@/lib/auth";

  const session = await getServerSession(authOptions);
  session?.user?.email;
  ```
  Every page under `/dashboard` is already protected by `src/app/dashboard/layout.tsx`.
- **In a route handler:** call `requireAuth()`. It returns `{ session, error }`, and `session.user.id` holds the signed-in user's ID.
- **In a client component:** use `signIn` / `signOut` from `next-auth/react` (see `src/components/AuthButtons.tsx`).

---

## Deployment

The app ships as a Docker image (`Dockerfile`) and is deployed by Coolify.

1. A push to `main` runs the **Malware Scan (CI Gate)** workflow.
2. If the scan passes, the **Deploy (Coolify)** workflow calls the Coolify webhook.
3. Coolify builds the image (`npm run build`, which applies migrations) and starts it (`prisma migrate deploy && npm run start`).

Production environment variables are set in Coolify's variable editor. The deploy workflow needs these GitHub secrets:

| Secret | Required | Description |
|---|---|---|
| `COOLIFY_WEBHOOK_URL` | Yes | Webhook URL from the Coolify application's deploy settings |
| `COOLIFY_TOKEN` | No | Bearer token for authenticated webhooks |

### Google OAuth (only when setting up a new environment)

The team `.env` already has working credentials. For a new deployment URL:

1. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), open the OAuth 2.0 Client.
2. Add the authorized redirect URI `https://<domain>/api/auth/callback/google`.
3. Set `NEXTAUTH_URL` to `https://<domain>` in that environment.

## SEO Analytics

`/dashboard/seo` shows two charts for one shared date range (7 days, 28 days, 3 months or custom; presets end yesterday because neither Google product has a finished "today"):

| Chart | Source | What it measures |
|---|---|---|
| **Clicks vs. Impressions** | Search Console API, `searchAnalytics.query`, dimension `date`, search type `web` | Google Search clicks and impressions for the property. CTR = total clicks ÷ total impressions × 100 (shown as "—" when there are no impressions). Not website sessions or on-site clicks. |
| **Users Traffic by Channels** | GA4 Data API, `batchRunReports` | `activeUsers` (GA4's "Users") by `sessionDefaultChannelGroup` and `date`. The headline total is a separate site-wide query, so it is deduplicated; channel figures overlap because one person can arrive through several channels. |

Freshness: Search Console finalises a day 2–3 days later and GA4 within about 24–48 hours, so the charts are not real-time. Responses are cached on the server for 5 minutes; **Refresh** bypasses that cache. The page shows when the data was last fetched and the latest date each source has data for.

The browser only talks to `/api/seo/*`, which require a signed-in session. Google credentials stay on the server and are never sent to the client. No database tables are used.

### Connect the real data

1. **Google Cloud project** – in [APIs & Services → Library](https://console.cloud.google.com/apis/library), enable the **Google Search Console API** and the **Google Analytics Data API**.
2. **Service account** – in [IAM → Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts), create one (no Cloud roles needed), then **Keys → Add key → JSON**. Keep the file out of the repo.
3. **Search Console access** – in [Search Console](https://search.google.com/search-console) open the zedu.chat property → **Settings → Users and permissions → Add user**, enter the service account's email, permission **Restricted** (read-only is enough).
4. **GA4 access** – in Google Analytics → **Admin → Property access management → +**, add the service account's email with the **Viewer** role. The property ID is under **Admin → Property details**.
5. **Environment variables** – add these to the shared `.env` and to Coolify:

   | Variable | Value |
   |---|---|
   | `GOOGLE_ANALYTICS_CLIENT_EMAIL` | `client_email` from the JSON key |
   | `GOOGLE_ANALYTICS_PRIVATE_KEY` | `private_key` from the JSON key, on one line with literal `\n` line breaks, in double quotes |
   | `GSC_SITE_URL` | The property exactly as Search Console names it: `sc-domain:zedu.chat` for a domain property, or `https://zedu.chat/` (trailing slash) for a URL-prefix property |
   | `GA4_PROPERTY_ID` | The numeric property ID, e.g. `123456789` (not the `G-…` measurement ID) |

6. Restart the app and open `/dashboard/seo`. Each chart says what is still missing or which permission Google refused.

### Develop without credentials

Set `SEO_ANALYTICS_DEMO=true` in your local `.env`. Both charts then show seeded synthetic numbers, badged **"Demo data — not live analytics"**. The flag is ignored when `NODE_ENV=production`, so demo data can't reach the deployed dashboard.

### Errors you might see

| Message | Cause |
|---|---|
| "Connect Search Console / Google Analytics" | One or more variables above are unset. The chart lists which ones. |
| "Google rejected the service account credentials" | Wrong email or malformed private key (check the `\n` line breaks). |
| "The service account can't access this property" | The service account isn't a user on the Search Console property or GA4 property, the API isn't enabled, or `GSC_SITE_URL` / `GA4_PROPERTY_ID` doesn't match. |
| "Google API quota exceeded" | Too many requests. Wait a few minutes; the 5-minute cache normally prevents this. |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Property 'campaign' does not exist on type 'PrismaClient'` | The client is stale: run `npm run db:generate` or restart `npm run dev`. Restart the TypeScript server in your editor too. |
| `prisma migrate dev` says drift was detected and wants to reset | **Don't reset.** Pull/rebase onto `main` to get the missing migrations, then rerun. If it still happens, ask the team. |
| Redirected back to `/` after signing in | Check that `NEXTAUTH_URL` matches the URL you're using (`http://localhost:3000`) and that `NEXTAUTH_SECRET` is set. |
| Google error `redirect_uri_mismatch` | That URL isn't in the OAuth client's authorized redirect URIs. Ask the project lead. |
| `.openapi is not a function` | You imported `z` from `"zod"`. Import it from `@/lib/zod`. |
| Tailwind class has no effect | Check the spelling against the Tailwind v4 docs, and use theme tokens (`bg-primary`) rather than unknown names. Restart `npm run dev` after changing `globals.css`. |
