# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, and others) working in this repository. Follow them exactly. `README.md` has the full human guide. This file is the short list of rules and the follow-ups you must do yourself.

## Project context

- **Amp** (repo: `metric-tracker`) is a multi-tenant marketing workspace: teams create projects, set goals, and their AI agents propose, do and review the work. It started as Zedu's marketing dashboard. Several teams build features in parallel on one codebase.
- Stack: Next.js 14 App Router, TypeScript (strict), Tailwind CSS v4, shadcn/ui (Radix, `radix-nova` style, lucide icons), Prisma 5 on PostgreSQL (Neon), NextAuth v4 (Google OAuth, database sessions), Zod + `@asteasolutions/zod-to-openapi`.
- The backend is **Next.js Route Handlers only** (`src/app/api/**/route.ts`). There is no separate server.
- **All developers share one database** (configured in `.env`). Merging to `main` **auto-deploys to production** and applies migrations there.

## Hard rules (never break these)

1. **Never run anything that resets or wipes the database**: `prisma migrate reset`, `prisma db push`, `--force-reset`, or answering "yes" when `prisma migrate dev` offers to reset. If Prisma reports drift or asks to reset, **stop and tell the user**. The usual fix is to pull/rebase onto `main` to get missing migrations.
2. **Never edit or delete a migration** in `prisma/migrations/` that already exists. Fix mistakes with a new migration.
3. **Ask the user before applying a migration to the shared database.** It changes the data for every team immediately. Generate the SQL with `--create-only`, show it, then apply it once they confirm (see the schema-change checklist).
4. **Get explicit confirmation before any destructive schema change**: dropping or renaming a model, column or enum value, or changing a column type or nullability on existing data. Say plainly what data would be lost.
5. **Never read, print, commit or modify `.env`**, and never put secrets in code, logs, docs or commit messages. Add new variables to `.env.example` with placeholder values only.
6. **Never run `npm run build` locally.** It runs `prisma migrate deploy` against the shared database. Use `npx tsc --noEmit` or `npx next build` to verify.
7. **Never push to `main`, merge PRs, force-push, or commit** unless the user asks. Work on a feature branch.
8. **Use npm only.** Don't create `yarn.lock` or `pnpm-lock.yaml`. Don't add dependencies without a clear need, and mention every new dependency to the user.
9. **Don't change shared foundations for a single feature** without saying so: `src/app/api/auth/**`, `src/lib/auth.ts`, `src/lib/prisma.ts`, the NextAuth models (`User`, `Account`, `Session`, `VerificationToken`), `src/app/globals.css` tokens, and `src/components/ui/*`.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (runs `prisma generate` first) |
| Type-check | `npx tsc --noEmit` |
| Compile check (no migrations) | `npx next build` |
| Regenerate Prisma client | `npm run db:generate` |
| Create a migration without applying it | `npm run db:migrate -- --name <snake_case_name> --create-only` |
| Apply pending migrations (dev) | `npm run db:migrate` |
| Add a shadcn component | `npx shadcn@latest add <name>` |

ESLint isn't configured. Don't run `npm run lint`, because it starts an interactive setup.

## Required follow-ups

Do these yourself, without being asked, whenever the change applies. If you can't do one (for example, because the user hasn't confirmed a migration), say so explicitly in your final message.

### After adding or changing a Prisma model, field, enum or relation

1. Edit only `prisma/schema.prisma`. Prefer additive changes: new models, and optional or defaulted fields.
2. Create the migration without applying it: `npm run db:migrate -- --name <descriptive_snake_case>`, adding `--create-only`.
3. Read the generated `prisma/migrations/<timestamp>_<name>/migration.sql` and show the user a summary, highlighting anything destructive.
4. After the user confirms, apply it with `npm run db:migrate`.
5. **Always run `npm run db:generate`** afterwards, so the Prisma client types match the schema. Do this even when you only created the migration or only edited the schema.
6. Run `npx tsc --noEmit` and fix any errors.
7. Remind the user to commit `prisma/schema.prisma` **and** the new migration folder together, and to mention the migration in the PR.

### After pulling or rebasing changes that touch `prisma/schema.prisma`

- Run `npm run db:generate`.

### After adding or changing an API endpoint

- Follow the backend conventions below.
- Register or update its schemas and path in `src/lib/openapi.ts` so it shows up at `/docs`.
- Run `npx tsc --noEmit`.

### After adding a dashboard page

- Put it at `src/app/p/[slug]/<feature>/page.tsx`. Start it with `PageHeader` and wrap the body in `PageContent` (both from `@/components/PageHeader`). Server components that read data call `getProjectPage(params.slug)` from `@/lib/project-page` and filter by `project.id`.
- Add it to the `CHANNELS` list in `src/components/SidebarNav.tsx` (`{ href, label, icon }`, with `href` relative to the project, e.g. `/campaigns`). The nav sets `aria-current="page"` for you.

### After adding an environment variable

- Add it to `.env.example` with a placeholder, read it with `process.env.NAME`, and tell the user it must be added to the shared `.env` and to Coolify.

### After adding a shadcn component

- Add it with the CLI, then **read the generated file** and check that its imports and composition are correct. Don't hand-write a copy of a shadcn component.

### Before you finish any task

- `npx tsc --noEmit` passes. If you changed routing, config or styling broadly, `npx next build` passes too.
- Update `README.md` if you changed setup steps, scripts, conventions or project structure.
- In your summary, list any migration created or applied, new dependencies, new environment variables, and any follow-up you couldn't do.

## Backend conventions

Every route handler in `src/app/api/<feature>/.../route.ts`:

1. Starts with `const { projectId, error } = await requireProjectAccess(request); if (error) return error;` (from `@/lib/projects`; add `{ allowAgents: false }` for people-only routes, `{ minimumRole: "admin" }` for management) and filters every query by `projectId`, looking records up with `findFirst({ where: { id, projectId } })`. Only routes outside a project (`/api/projects*`) use `requireAuth()` from `@/lib/api`, and deliberately public routes such as `/api/health` use neither.
2. Validates the request body and query with Zod `.safeParse()`. Schemas live in `src/lib/schemas/<feature>.ts`, and **`z` is imported from `@/lib/zod`, never from `"zod"`** (the `@/lib/zod` version adds `.openapi()`).
3. Uses the shared client: `import { prisma } from "@/lib/prisma"`. Never write `new PrismaClient()`.
4. Exports `export const dynamic = "force-dynamic";` when it reads the session or the database.
5. Returns this response shape:
   - `200` with the resource or list, `201` with the created resource, `204` with no body after a delete.
   - `400` with `{ error: "Validation failed", details: result.error.flatten().fieldErrors }`.
   - `401` from `requireAuth`, and `404` with `{ error: "Not found" }`. Look the record up before updating or deleting it.
6. Takes route params as a plain object, the Next.js 14 way: `{ params }: { params: { id: string } }`. Don't `await params`.
7. Is documented in `src/lib/openapi.ts` under a `// ── <Feature> ──` comment.

For read-only dashboard data, prefer querying Prisma directly in a server component over adding an API route. Client components call API routes with `fetch`, then call `router.refresh()`.

## Frontend & design rules

The design reference is `DESIGN.md` (principles) together with `src/app/globals.css` (the actual tokens). **If the two disagree, `globals.css` wins.** The look is FinSet-style: a deep Zedu-violet sidebar with a solid violet active pill, a white workspace of rounded hairline-bordered cards (no shadows), heavy KPI figures with delta chips, and Shopall-structured violet charts. Pages are migrating onto it one at a time; check the Migration table in `DESIGN.md` before building, and use the spec there for any component marked new.

### Components

- **Use shadcn/ui components first** (`src/components/ui/`). Only build custom markup when no component fits. Check what's installed before importing, and add missing components with the CLI.
- **Forms:** `FieldGroup` > `Field` > `FieldLabel` + control + `FieldError`. For invalid fields, set `data-invalid` on `Field` and `aria-invalid` on the control.
- **Dialogs** always have a `DialogTitle` (use `sr-only` to hide it visually) and use `DialogFooter` for actions. Loading buttons combine `Spinner` with `data-icon="inline-start"` and `disabled`.
- Use `Card` for panels, `Alert` for callouts and errors, `Empty` for empty states, `Badge` for statuses, `Skeleton` for loading, `Separator` for dividers, `DropdownMenu` for menus, and `Table` for tabular data.
- Use the shared page pieces: `PageHeader` + `PageContent` for every dashboard page, `KpiCard` + `KpiGrid` for KPI rows, and `Toolbar` + `SearchPill` + `PillSelect` for search and filters. Don't hand-roll page headers or stat tiles.
- Status mapping: favorable/live/published → `success`, in review/scheduled → `info`, needs attention/draft/due → `warning`, harmful/rejected/failed → `destructive`, neutral/idea → `secondary`.

### Styling

- **Tailwind utilities only.** No new CSS files, CSS modules, inline `style` for theming, or styled-components. Global CSS changes belong in `src/app/globals.css`, and only for tokens or base styles.
- **Use semantic tokens, never raw colors:** `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-deep`, `bg-accent`, `border-border`, `border-border-strong`, `bg-sidebar`, `text-sidebar-muted-foreground`, `bg-chart-1` … `bg-chart-5`, `bg-chart-track`, and `success` / `warning` / `info` / `destructive` (plus their `-muted` variants). No `bg-blue-500` or `#hex` in components. If you need a new color, add a token to `globals.css` and tell the user.
- The app is **light-theme only**. Don't add `dark:` overrides.
- Use `className` on shadcn components for layout (spacing, width, grid placement), not to recolor them. Prefer the built-in variants (`variant="outline"`, `size="sm"`).
- Use `flex`/`grid` with `gap-*`, never `space-x-*`/`space-y-*`. Use `size-*` when width equals height, `truncate` for ellipsis, and `cn()` from `@/lib/utils` for conditional classes.
- Don't set z-index manually on overlays (Dialog, Popover and DropdownMenu handle their own).

### Visual language

- **Violet marks action and place.** Use `primary` for the primary action (one per view), the current nav item, focus and the current chart series. Keep everything else neutral.
- **`primary` is a fill, `primary-deep` is for text.** White on `primary` and `primary` text on white are below 4.5:1, so violet text and links always use `text-primary-deep`.
- Typography: Manrope (`font-sans`) for UI. Page titles are extrabold with tight tracking (`PageHeader` handles this). KPI figures are big extrabold Manrope with `tabular-nums` (`StatCard` handles this). Use JetBrains Mono (`font-mono`) for IDs and column-aligned dates and values. Small uppercase labels use `text-2xs font-bold uppercase tracking-[0.07em] text-muted-foreground`.
- Structure: white `rounded-[22px]` cards with `border border-border` on the white workspace, 20px padding, 16px gaps, content full width with 24px page padding. Don't nest cards or add shadows to cards; only the primary pill, the active nav pill and floating overlays carry shadows.
- Shape: buttons, badges, tabs and nav items are pills. Inputs and selects are `rounded-lg`.
- Navigation uses `SidebarNavLink` on the deep violet sidebar. The current item is a solid violet (`sidebar-primary`) pill with white semibold text.
- Icons come from `lucide-react`. Inside a `Button`, use `data-icon="inline-start" | "inline-end"` with no size classes. Decorative icons get `aria-hidden="true"`.
- Keep motion short and functional. Reduced motion is already handled globally, so don't add animations that ignore it.
- **Responsive:** design mobile-first. Secondary panels stack below the main content on small screens, page padding contracts, and nothing scrolls horizontally except tables.
- **Accessibility:** use semantic HTML, label every control, keep focus states visible, and give icon-only buttons an `aria-label`.

## Code conventions

- TypeScript strict: no `any`, no `@ts-ignore`. Import through the `@/` alias (it maps to `src/`).
- Components are server components by default. Add `"use client"` only for state, effects, event handlers or browser APIs.
- Keep each team's code in its own folders: `src/app/p/[slug]/<feature>/`, `src/app/api/<feature>/`, `src/lib/schemas/<feature>.ts`, `src/components/<feature>/`. Keep edits to shared files minimal.
- Match the style of the code around you: PascalCase component files, named exports for components, and comments only where they add information.
- Don't leave dead code, unused files, `console.log` calls or commented-out blocks behind.

## Git

- Branch names: `feat/<ticket>-short-name`, `fix/...`, `chore/...`, `refactor/...`, `docs/...`.
- Commit messages use the Conventional Commits format (`feat: ...`, `fix: ...`). Only commit when the user asks.
- PRs target `main`. The description says what changed, how to test it, and **any migration** it includes.
