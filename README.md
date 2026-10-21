# Zedu Amp

The marketing dashboard for [Zedu](https://zedu.chat), built by several teams on one shared codebase (the repository is still called `metric-tracker`). It has Google sign-in, an authenticated dashboard shell with an **Overview** page, and feature areas for Content, Directories, the SEO checker and Press & Media, plus the plumbing for API routes, the database and API docs. The design system is described in [`DESIGN.md`](DESIGN.md).

**Live:** https://metrics.zedu.chat

> Using an AI coding agent? It must follow [`AGENTS.md`](AGENTS.md). Claude Code loads it through `CLAUDE.md`, and Codex, Cursor and others read `AGENTS.md` directly.

---

## Task revision workflow

The backend comments API supports two revision rounds per worker, then reopens the task for new bids. Human coordinators are configured with `REVIEW_COORDINATOR_USER_IDS`; peer-agent reviewers must have a different owner from the worker. See [revision usage, configuration, and tests](doc/task-revisions.md). The Goals UI remains a demo.

## Contents

- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Git workflow](#git-workflow)
- [Building pages (frontend)](#building-pages-frontend)
- [Building API endpoints (backend)](#building-api-endpoints-backend)
- [Database & migrations](#database--migrations)
- [Authentication](#authentication)
- [Deployment](#deployment)
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
| `npm test` | Run the unit tests and the goals/workstreams lifecycle integration suite (see **Testing** below) |

> **Don't run `npm run build` locally against the shared database.** It runs `prisma migrate deploy` first. To check that your code compiles, use `npx tsc --noEmit` or `npx next build`.

---

## Testing

`npm test` runs everything with the built-in Node test runner (`tsx --test`): the pure unit suites under `src/lib/**/__tests__/` plus the end-to-end lifecycle suite at [`src/__tests__/goals-lifecycle.e2e.test.ts`](src/__tests__/goals-lifecycle.e2e.test.ts) (Task 5.1 in `doc/GOALS_TASKLIST.md`).

The e2e suite is self-contained and safe to run:

- It starts its **own disposable PostgreSQL** ([embedded-postgres](https://www.npmjs.com/package/embedded-postgres), dev-only dependency) on a random local port and a `next dev` server on another random port. It never reads `.env` and never connects to the shared database.
- It provisions the database directly from the final `prisma/schema.prisma`, because the migration history currently cannot be replayed on a fresh database: both `20261020120000_add_agent_table` and `20261020163500_add_goals_workstreams_agents_comments` create the `Agent` table, so `prisma migrate deploy` fails partway with `relation "Agent" already exists`. This needs a separate team fix before fresh databases (including CI) can use `migrate deploy`.
- It walks the whole lifecycle over real HTTP — goal → idea → workstream → task → bid → offer → accept-offer → delivery → peer review → revision → approval — and covers the edge cases (self-review rejected, 2-revision limit unassigns the worker, 24h offer expiry, 2-active-task cap). A synthetic human session (database session row + cookie) acts as the Review Coordinator via `REVIEW_COORDINATOR_USER_IDS`.
- All fixture rows are prefixed per run and deleted in teardown; the database and servers are shut down afterwards.

To run the suite against your own disposable postgres instead (it must already have the schema applied), set `TEST_DATABASE_URL`.

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
      page.tsx             # Overview page (KPIs, weekly content chart, coming up, recent content)
      <feature>/page.tsx   # One folder per feature: content, directories, seo, media
    api/
      auth/[...nextauth]/  # NextAuth (don't change without discussing)
      health/              # GET /api/health
      openapi/             # GET /api/openapi — generated OpenAPI document
    docs/route.ts          # /docs — Scalar API reference UI
  components/
    ui/                    # shadcn/ui components (generated, themed)
    PageHeader.tsx         # PageHeader + PageContent: the frame every dashboard page uses
    KpiCard.tsx            # KpiCard + KpiGrid + DeltaChip: KPI cards
    Toolbar.tsx            # Toolbar, SearchPill, PillSelect: search and filter row
    AppSidebar.tsx         # Sidebar shell: brand, collapse toggle, nav, account block
    SidebarNav.tsx         # DashboardSidebarNav (the links) and SidebarNavLink
    Wordmark.tsx           # Zedu Amp wordmark and BrandMark
    AuthButtons.tsx
  lib/
    api.ts                 # requireAuth() helper for route handlers
    auth.ts                # NextAuth config
    prisma.ts              # Shared Prisma client — always import from here
    openapi.ts             # OpenAPI registry + document generator
    zod.ts                 # Zod with `.openapi()` enabled — import `z` from here
    utils.ts               # cn() class-name helper
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
import { PageContent, PageHeader } from "@/components/PageHeader";
import { KpiCard, KpiGrid } from "@/components/KpiCard";
import { Button } from "@/components/ui/button";

export default function CampaignsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Channels"
        title="Campaigns"
        description="Every paid and organic campaign in one place."
        actions={<Button>New campaign</Button>}
      />
      <PageContent>
        <KpiGrid>
          <KpiCard
            title="Active campaigns"
            value="4"
            delta={{ label: "+1", direction: "up", favorable: true }}
            comparison="vs last month"
            action={{ label: "Open campaigns", href: "/dashboard/campaigns" }}
          />
        </KpiGrid>
        {/* Cards, charts and tables go here */}
      </PageContent>
    </>
  );
}
```

### Add it to the sidebar

Add an entry to `src/components/SidebarNav.tsx`: `MARKETING_CHANNELS` for marketing pages (they appear under the expandable **Marketing** item), or `CHANNELS` for top-level items:

```tsx
{ href: "/dashboard/campaigns", label: "Campaigns", icon: MegaphoneIcon },
```

The nav compares each `href` with `usePathname()` and sets `aria-current="page"` on the current one, which renders the solid violet pill. When the sidebar is collapsed, the label becomes the icon's tooltip.

### Server vs client components

- Pages and layouts are **server components** by default. They can `await prisma...` or `getServerSession(authOptions)` directly, so most read-only pages don't need their own API route.
- Add `"use client"` at the top only for components that use state, effects, event handlers or browser APIs (forms, dialogs, menus). Client components call your API routes with `fetch("/api/...")`, then usually call `router.refresh()` to reload server data.

### UI components and styling

- **Use shadcn/ui first.** Check `src/components/ui/` for what's already installed. Add more with:
  ```bash
  npx shadcn@latest add tabs chart
  ```
  Docs: https://ui.shadcn.com/docs/components
- **Style with Tailwind utilities and the theme tokens** defined in `src/app/globals.css`. Don't use raw hex values or new CSS files.

| Token (Tailwind class) | Use for |
|---|---|
| `bg-background`, `text-foreground` | Lavender page canvas and body text |
| `bg-card`, `bg-popover` | White cards, dialogs and menus |
| `bg-primary`, `text-primary-foreground` | Zedu violet (`#7D68F9`) fills: primary buttons, current chart series |
| `text-primary-deep` | Violet **text** and links (the brand violet is too light for text) |
| `bg-accent`, `text-accent-foreground` | Light violet tint for icon chips, selection and hover |
| `text-muted-foreground`, `bg-muted` | Secondary text and quiet fills |
| `border-border`, `border-border-strong` | Card rings, rules and hovered inputs |
| `bg-sidebar`, `text-sidebar-foreground`, `text-sidebar-muted-foreground` | The deep violet sidebar |
| `bg-chart-1` … `bg-chart-5`, `bg-chart-track` | Chart series and the track behind bars |
| `success` / `warning` / `info` / `destructive` (+ `-muted`) | Status colors, for example `<Badge variant="success">` |
| `font-sans` (Manrope), `font-mono` (JetBrains Mono) | Manrope for UI and KPI figures, mono for IDs and column-aligned values |

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
