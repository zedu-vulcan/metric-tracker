# Zedu Amp design system

> **Source of truth:** tokens live in `src/app/globals.css` and are exposed as Tailwind classes (`bg-primary`, `text-muted-foreground`, …). This document says *how* to use them and what each building block looks like. If the two disagree, the CSS wins; fix this file in the same PR.
>
> **Status:** the tokens below are live. Pages are being moved onto this spec one at a time. The Migration section at the end tracks which components exist and which are still to build.

## 1. Direction

**Bold, complete, compact.** Zedu Amp takes its form from the FinSet dashboard and its brand from Zedu:

- A **deep Zedu-violet sidebar** with a solid violet pill marking where you are.
- A **white workspace** where every block of information is its own rounded, hairline-bordered card. There's no grey canvas and no drop shadows. Cards are defined by their border, generous corner radius and bold titles.
- **Big, heavy figures** (the number is the hero of every card), with faded decimals and a tinted delta chip that says at once whether things got better.
- **Violet as the data colour.** Charts are drawn in Zedu violet and its soft tint. Status colours (green, amber, red, blue) appear only in chips and badges.
- **Charts follow Shopall's structure:** a label, a big value and a delta above the plot. Lines are smooth with ringed points and a violet gradient fill below. Bars sit on a pale track.

It should feel finished and confident, like a product rather than an admin panel. And it is **compact**: content stops at a readable width, gaps are 16px, and nothing floats in empty space.

What it is not: no grey canvas with floating cards, no editorial hairline layouts, no dark mode, no gradients except under line charts, and no decoration that doesn't carry data.

## 2. Foundations

### 2.1 Color

Use the token, never the hex.

| Role | Token | Value | Use |
|---|---|---|---|
| Workspace | `background` | `#FFFFFF` | Main area behind cards |
| Card | `card`, `popover` | `#FFFFFF` | Cards, dialogs, menus |
| Ink | `foreground` | `#16151D` | Titles, figures, body |
| Muted ink | `muted-foreground` | `#6B6880` | Labels, subtitles, "vs last month", axis labels |
| Faint ink | `faint-foreground` | `#C9C7D3` | **Decimals** of big figures and placeholder glyphs only. Never for meaningful text. |
| Hairline | `border` | `#E8E7EE` | Card borders, row dividers, outline pills |
| Strong hairline | `border-strong` | `#D2D0DC` | Hovered outline controls |
| Quiet fill | `muted`, `secondary` | `#F5F4F9` | Neutral badges, hover fills on white |
| Brand | `primary` | `#7D68F9` | Primary pill, active nav pill, chart series 1, progress fills, focus ring |
| Brand text | `primary-deep` | `#5B45E0` | Any violet *text*: links, table headings, accent-chip text |
| Brand tint | `accent` | `#F3EFFF` | Table header bar, icon chips, selected rows, tooltip-free highlights |
| Chart soft | `chart-2` | `#C1B7FF` | Second series (comparison period, "expense", history) |
| Chart track | `chart-track` | `#EDEAFF` | Behind bars and progress fills |
| Chart grid | `chart-grid` | `#ECEAF3` | Dashed horizontal gridlines |
| Extra series | `chart-3` / `chart-4` / `chart-5` | green / amber / blue | Only when a chart truly needs more than two series (donut slices) |
| Navigation | `sidebar` | `#24145F` | Deep Zedu violet rail |
| Nav text | `sidebar-foreground` / `sidebar-muted-foreground` | `#FFFFFF` / `#BDB3E8` | Active / resting |
| Nav active | `sidebar-primary` | `#7D68F9` | Active nav pill |
| Favorable | `success` / `success-muted` | `#0F7B47` / `#E4F8EA` | Good change, live, published |
| Attention | `warning` / `warning-muted` | `#9A5800` / `#FFF2DB` | Due, draft, needs changes |
| Informational | `info` / `info-muted` | `#1D5FD1` / `#E4EEFF` | In review, scheduled |
| Harmful | `destructive` / `destructive-muted` | `#C9302C` / `#FFEBEC` | Bad change, rejected, failed, delete |

**Contrast rules.** All status text passes 4.5:1 on white and on its own `-muted` tint. `primary` (`#7D68F9`) is a *fill*. White on it measures 4.0:1, which is below 4.5:1 for normal text. So text on violet fills is always **semibold, at least 13px**, and violet text on white always uses `primary-deep`. `faint-foreground` fails contrast by design and is reserved for decimals that add no information.

### 2.2 Typography

One family, **Manrope** (`font-sans`), used heavy. **JetBrains Mono** (`font-mono`) appears only for IDs and column-aligned codes.

| Style | Recipe | Where |
|---|---|---|
| Page title | `text-[26px] leading-tight font-extrabold tracking-[-0.035em]` | "Welcome back, Abraham!", "Directories" |
| Page subtitle | `text-sm text-muted-foreground` | One line under the title |
| Figure XL | `text-[30px] leading-none font-extrabold tracking-[-0.04em] tabular-nums` | KPI card value |
| Figure L | `text-[26px] leading-none font-extrabold tracking-[-0.035em] tabular-nums` | Chart-card headline value |
| Card title | `text-[17px] leading-tight font-bold tracking-[-0.02em]` | Every card header |
| Body | `text-sm` (14px) | Table cells, list rows |
| Label | `text-[13px] font-medium text-muted-foreground` | Under figures, legends |
| Micro | `text-xs font-semibold` (12px) | Chips, badges, axis labels, table headings (uppercase, `tracking-[0.04em]`) |

**Figures with decimals:** render the integer part in ink and the decimals in `text-faint-foreground`, for example `$15,700` plus `.00`. Whole-number counts show no decimals. Percentages keep one decimal in ink (`12.1%`).

### 2.3 Shape, space, depth

- **Radius:** cards `rounded-[22px]`, dialogs `rounded-3xl`, inner panels and list tiles `rounded-2xl`, inputs in forms `rounded-xl`, and everything you click in a toolbar is a **pill** (`rounded-full`): buttons, selects, chips, badges, nav items and the table header bar.
- **Borders, not shadows.** Cards are `border border-border bg-card` with **no shadow**. The only shadows in the product are on the primary pill (a soft violet glow), floating overlays (menus, dialogs, chart tooltips) and the active nav pill.
- **Spacing scale:** 4 / 8 / 12 / 16 / 20 / 24 px. Card padding is **20px** (`p-5`), the grid gap is **16px** (`gap-4`) and page padding is **24px** (`px-6`). Inside a card, the header-to-content gap is 16px.
- **Width:** page content is **full width** beside the sidebar, inset by the 24px page padding. Grids stretch to fill it; density comes from the 16px gaps and 20px card padding, not from a width cap.

## 3. Layout

### 3.1 App shell

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ ◉ Zedu Amp  ‹│  Welcome back, Abraham!                      (⌕) (🔔) [◯ Abraham ▾]│
│              │  Here's what moved this week                                 │
│ ▉ Overview   │                                                              │
│   Content    │  (📅)(This month ▾)            [Manage ▢] [＋ Add content]    │
│   Directories│                                                              │
│   SEO        │  ┌ KPI ─────┐┌ KPI ─────┐┌ KPI ─────┐┌ KPI ─────┐             │
│   Press      │  └──────────┘└──────────┘└──────────┘└──────────┘             │
│              │  ┌ Chart card (2/3) ──────────────┐┌ Side card (1/3) ┐        │
│              │  └────────────────────────────────┘└─────────────────┘        │
│              │  ┌ Table card (2/3) ──────────────┐┌ Side card (1/3) ┐        │
│ [AB name  ⇥] │  └────────────────────────────────┘└─────────────────┘        │
│              │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
     248px (84px collapsed)      content full width, px-6, gap-4
```

- **Sidebar (`lg` and up):** `AppSidebar`, `w-[248px]` (`w-[84px]` collapsed to an icon rail), `bg-sidebar`, sticky and full height.
  - **Top:** `Wordmark tone="inverse"` with a 26px round collapse button (`‹`) on the right edge.
  - **Middle:** Overview, a thin divider, then the channel pages. No section labels.
  - **Bottom:** empty. The account lives in the top bar (3.2). Add a Help item only once a help page exists.
- **Sidebar (below `lg`):** a sticky top bar (`h-14`) with the mark on the left and a horizontally scrolling row of nav pills.
- **Main:** `min-w-0 px-4 py-5 sm:px-6 sm:py-6`, with an inner `w-full flex flex-col gap-4`.

### 3.2 Top bar and page header (every page)

- **Top bar** (`TopBar`, rendered by the dashboard layout above every page): `h-16`, `border-b border-border`, with only the **profile button** at the right end. That's a 40px round avatar (the Google photo, or initials on `bg-primary`) that opens a `DropdownMenu` with the name, the email and Sign out. Add items to that menu (e.g. My agents) instead of adding more buttons to the bar.

Then the page header:

```
Title (26 / extrabold)                                     (⌕) (🔔3) [◯ Name  email ▾]
Subtitle (14 / muted)
```

- **Left:** the title and a one-line subtitle. On the Overview the title is the greeting, "Welcome back, {first name}!".
- **Right:** page actions only. The account is in the top bar, so there is no account pill here. Only show icon buttons that do something real; no decorative search or bell.
- Feature pages leave the right side empty; their actions go in the toolbar.

### 3.3 Toolbar (under the header)

```
(📅) (This month ▾) (All channels ▾)                 (▢ Secondary) (＋ Primary)
```

`flex flex-wrap items-center justify-between gap-3`.

- **Left:** filters as **pill selects** (`h-10 rounded-full border border-border px-4 text-sm font-medium`), optionally led by a round icon button for the date picker.
- **Right:** at most one outline pill and **one** primary pill.
- On mobile, filters scroll horizontally and the actions wrap below.

### 3.4 Grids

| Pattern | Classes | Use |
|---|---|---|
| KPI row | `grid grid-cols-2 gap-4 xl:grid-cols-4` | 4 KPIs. Use 3 with `md:grid-cols-3` when there are only 3. Never 5. |
| Main + side | `grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]` | Chart or table on the left, a donut, list or goals card on the right |
| Halves | `grid gap-4 lg:grid-cols-2` | Two charts of equal weight |
| Full | single card | Wide tables |

Every page is built as **toolbar → KPI row → one or two rows of main + side**. A row's cards stretch to equal height (`items-stretch`, cards `h-full`).

## 4. Components

Each entry says what it looks like and what it's called in code. *(new)* means it isn't built yet; see Migration.

### 4.1 KPI card — `KpiCard` *(new; replaces `StatCard`)*

```
┌──────────────────────────────┐
│ Total balance            (↗) │   title 17 bold · 40px round outline arrow button
│                              │
│ $15,700.00                   │   Figure XL, decimals faint
│ (↑ 12.1%)  vs last month     │   DeltaChip + 13px muted label
└──────────────────────────────┘
```

- **Card:** `rounded-[22px] border border-border bg-card p-5 flex flex-col gap-5`, about 140px tall.
- **Arrow button:** `size-10 rounded-full border border-border text-foreground hover:bg-accent hover:text-primary-deep`, with `ArrowUpRight` at 18px. It **links to the page behind the number**, and its `aria-label` names that page ("Open content"). With no destination, leave it out.
- **Props:** `title`, `value`, `decimals?`, `delta?: { value: number; direction: "up" | "down"; favorable: boolean }`, `comparison?: string` (default "vs last month"), `href?`.
- With no delta, show a muted context line instead (for example "23 created in the last 8 weeks"). Never leave a blank row.

### 4.2 Delta chip — `DeltaChip` *(new)*

`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums`

- **Arrow:** shows the **direction** (`ArrowUp` / `ArrowDown`, 12px).
- **Colour:** shows **whether that's good**. Favorable is `bg-success-muted text-success`; unfavorable is `bg-destructive-muted text-destructive`; flat is `bg-muted text-muted-foreground` with no arrow.
- Example: rising "Follow-ups due" gets an up arrow in red.

### 4.3 Card — `Card` *(exists; restyle)*

The container for everything that isn't a KPI.

- **Shell:** `rounded-[22px] border border-border bg-card p-5 flex flex-col gap-4`.
- **Header row:** `flex items-start justify-between gap-3`.
  - **Left:** title (17 bold) and an optional 13px muted description.
  - **Right:** one of (a) the 40px round arrow button, (b) legend dots plus 1 or 2 pill selects, or (c) a small outline pill like "See all ›".

### 4.4 Chart card, line — `LineChartCard` *(new; Shopall structure)*

```
┌ Total revenue ─────────────────────────── (Last 30 days ▾) ┐
│ $20,462.89                                                  │  Figure L
│ +20.1% from last month                                      │  13px success/destructive
│        ●                                         ●          │
│  ●   ╱   ╲       ●──●                        ╱               │  2px violet line, smooth
│   ╲ ╱     ╲     ╱    ╲          ●──●       ╱                 │  ringed points
│    ●       ╲   ╱      ●        ╱    ╲    ●                   │
│             ● ╱        ╲      ╱      ╲  ╱                    │
│░░░░░░░░░░░░░░●░░░░░░░░░░●──●░░░░░░░░░●░░░░░░░░░░░░░░░░░░░░░│  gradient fill
│ 1 Oct   5 Oct   9 Oct   13 Oct   17 Oct                      │  axis 12px muted
└─────────────────────────────────────────────────────────────┘
```

- **Line:** `stroke: var(--chart-1)`, 2px, `type="monotone"`.
- **Points:** 7px circles with a white fill and a 2px `chart-1` stroke. On hover the point grows to 10px with a 4px `chart-1/20` halo.
- **Area:** a vertical gradient from `chart-1` at 28% opacity to 0% at the baseline.
- **Grid:** horizontal only, dashed `chart-grid`, 4 lines, no vertical lines, no axis lines.
- **Axes:** 12px `muted-foreground`. The y-axis is optional and shows abbreviated values ("10K").
- **Comparison series (optional):** `chart-2`, 2px **dashed**, no fill, no points.
- **Tooltip:** a white floating pill (`rounded-full border border-border bg-popover px-3 py-1.5 shadow-md`) with the bold value and a muted date.
- **Plot height:** `h-56` in a side card, `h-64` in a main card.

### 4.5 Chart card, bars — `BarChartCard` *(new; FinSet bars on Shopall tracks)*

- **Single series** (counts per week or day): each bar sits on a **full-height `chart-track` pill**, with the value bar in `chart-2` and the **current period in `chart-1`**. Bars are `rounded-full` and 22 to 28px wide. Value labels go above the bars only when there are 8 or fewer.
- **Two series** (this vs last period, published vs drafted): grouped bars, `chart-1` and `chart-2`, 6px gap inside a group, rounded tops (`radius: [8, 8, 0, 0]`), no track. Legend dots go in the card header.
- **Grid and tooltip:** same as the line chart. On hover, the hovered group gets a pill tooltip and the other groups fade to 40%.

### 4.6 Donut card — `DonutCard` *(new; FinSet "Budget")*

- **Layout:** a legend list on the left (dot plus label, 14px, 10px row gap) and the donut on the right (`size-44`, 18px ring).
- **Slices:** series colours in order: `chart-1`, `chart-2`, `chart-3`, `chart-4`, then `foreground` at 70% and 40% for the rest. 3° gaps between slices, rounded ends.
- **Centre:** a muted 12px label and a Figure L total.
- Use it for share-of-whole only, at most 6 slices, otherwise use bars.

### 4.7 Progress list — `ProgressList` *(new; FinSet "Saving goals")*

- **Each row:** a label (14 semibold) on the left and the target (14 bold, `primary-deep`) on the right.
- **Bar:** a 26px-tall `rounded-full bg-chart-track` track with a `bg-primary` fill that is at least 44px wide, showing the percentage inside in white `text-xs font-semibold`.
- Use it for goals, quotas and checklists ("Directories submitted 12 / 20").

### 4.8 Table card — `DataTable` inside `Card` *(restyle of `Table`)*

```
┌ Recent content ───────────────────── (All types ▾) (See all ›) ┐
│ ╭ DATE      TITLE            TYPE        STATUS     VIEWS  ╮ │  header bar: rounded-full bg-accent
│ ╰──────────────────────────────────────────────────────────╯ │  12px semibold uppercase primary-deep
│   25 Jul    Launch recap     Article     (Published)  1,204   │  rows 52px, 14px
│   ───────────────────────────────────────────────────────    │  border-b border-border (not on last)
│   26 Jul    Cohort guide     Video       (Draft)        —     │
└───────────────────────────────────────────────────────────────┘
```

- **Opt in with `<Table variant="pill">`.** Tables without it keep the old look until their page is redesigned.
- **Header:** a **floating pill bar** (`rounded-full bg-accent`), *not* a full-bleed grey strip. Headings are 12px semibold uppercase `text-primary-deep` with `tracking-[0.04em]`, and cells use `px-4`.
- **Rows:** 56px tall, 14px text, `border-b border-border` except the last row, hover `bg-accent/45` (square, so the row rules stay straight).
- **Columns:** numbers right-aligned and `tabular-nums`. Dates are plain sans ("25 Jul 12:30"), not mono.
- **Row actions:** a ghost `icon-sm` round button with `MoreHorizontal`. With a mouse it appears on row hover or focus (`pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100`); on touch it's always visible.
- **Leading cell:** a 36px `rounded-xl bg-accent` icon chip (by type) before a semibold name and a muted second line. Give the cell's inner block a fixed width (`w-[150px] sm:w-[300px]`), because `max-w` or `truncate` on a `<td>` doesn't limit a column.
- **Card:** the table sits in a card titled with an `h2` (17px bold), with the count ("6 pieces", "2 of 6 pieces") right-aligned in the header. Loading shows 5 `Skeleton` rows in the real column layout; empty and no-match states use `Empty` inside the card with one action pill.
- **Pagination:** round 32px ghost buttons, right-aligned under the table.
- **Responsive:** the name and status columns always show. Hide the rest by priority (`sm`, `md`, `lg`, `xl`, `2xl`) so the table fits its card; horizontal scroll is the last resort. Cell padding shrinks to 10px below `sm`.

### 4.9 Buttons — `Button` *(exists; restyle sizes)*

All buttons are pills.

| Variant | Recipe |
|---|---|
| Primary | `bg-primary text-primary-foreground font-semibold` with a soft violet glow `shadow-[0_6px_16px_rgb(125_104_249/0.28)]`, hover `bg-primary-deep`. **One per view.** |
| Outline | `border border-border bg-card text-foreground font-medium`, hover `border-border-strong bg-muted` |
| Secondary | `bg-accent text-accent-foreground`, hover `bg-brand-wash-strong`. A soft violet alternative to outline. |
| Ghost | `text-muted-foreground`, hover `bg-muted text-foreground` |
| Destructive | `bg-destructive-muted text-destructive`, hover darker |

**Sizes:** `xs` h-7 / 12px; `sm` h-8 / px-3.5 / 13px; `default` **h-10 / px-5 / 14px**; `lg` h-11 / px-6; `xl` h-13 / 15px (sign-in only). Icon buttons are round: `icon-xs` 28px, `icon-sm` 32px, `icon` 40px, `icon-lg` 44px. Icons are 18px (16px at `sm`) and use `data-icon="inline-start"` before the label (`＋ Add content`). **Never override a button's shape, height or colour with `className`**; pick a variant and size.

### 4.10 Pill select & period picker — `PillSelect` *(new; wraps `NativeSelect`)*

- **Pill:** `h-10 rounded-full border border-border bg-card pl-4 pr-9 text-sm font-medium` with a 16px chevron. Size `sm` is h-8 / 13px for use inside card headers.
- **Period picker:** a round outline icon button (`CalendarDays`) next to a pill reading "This month". Both open the same menu.
- **Label + value:** a `PillSelect` shows its name in muted ink and the current choice in semibold ("Type **All**"). When the value differs from its default, the pill turns `bg-accent text-accent-foreground` with a violet border, so active filters read at a glance. A ghost "× Clear" pill appears after the filters while any are active.
- **Search pill:** `SearchPill`, `h-10 rounded-full` with a leading search icon and a round clear button once text is typed. It's `w-72` on desktop and full width on phones.

### 4.11 Badges & status — `Badge` *(exists)*

`h-6 rounded-full px-2.5 text-xs font-semibold` in tinted variants, with an optional 6px leading dot.

| Meaning | Variant |
|---|---|
| live / published / favorable | `success` |
| in review / scheduled | `info` |
| needs changes / draft / due | `warning` |
| rejected / failed | `destructive` |
| idea / not submitted / neutral | `secondary` |

### 4.12 Sidebar navigation — `SidebarNavLink` *(exists; restyle)*

- **Item:** `h-11 rounded-full px-4 gap-3 text-[15px] font-medium text-sidebar-muted-foreground` with a 20px icon. Hover is `bg-sidebar-accent text-sidebar-foreground`.
- **Active:** **a solid `bg-sidebar-primary` pill with white semibold text** and a soft shadow, exactly like FinSet's active item. Set it with `aria-current="page"`.
- **Count badge:** `ml-auto rounded-full bg-white/12 px-2 text-xs font-semibold`.
- **Groups:** related items sit under one parent (today: **Marketing** holds Content, Directories, SEO checker and Press & Media). On the full desktop sidebar the parent expands in place, with its children indented behind a hairline `border-sidebar-border` guide; it opens automatically on a child's page, and shows the active pill itself only when closed. On the mobile bar and the collapsed rail it opens a dropdown menu instead.

### 4.13 Forms & dialogs *(exist; restyle)*

- **Dialogs:** `rounded-3xl p-6` with a title in Card-title style. The footer holds an outline pill and the primary pill, right-aligned.
- **Fields:** a 13px semibold label above an `h-11 rounded-xl border-input bg-card` control (`Input`, `NativeSelect`, `Textarea`). Focus is a `border-primary` border plus a `ring-4 ring-primary/12` ring. Errors are 12px `text-destructive` below the field.
- **Free-form, stage-first forms:** don't mark fields required unless the record is meaningless without them. Lead with the record's stage or type as radio cards (`rounded-2xl` tiles: icon chip, label, one-line hint; checked = `border-primary bg-accent` with a filled `bg-primary` icon chip), then show only the fields that stage needs. Hidden fields keep their values when the stage changes. Focus the first text field on open. Defaults are honest (today's date, empty topics), never placeholder data like "Topic A". See `ContentFormDialog` for the reference implementation.

### 4.14 Empty, loading, error

- **Empty:** inside the card that would hold the data, never as a separate page. Use a 48px `bg-accent` round icon chip, a 15px bold title, one muted line and one action pill.
- **Loading:** `Skeleton` shapes matching the final layout (figure bars, a chart block, table rows) in `bg-muted`, with no spinners on cards.
- **Error:** an inline `Alert` at the top of the affected card with a "Try again" outline pill, not across the whole page.

## 5. Page templates

### 5.1 Overview

```
Header:  Welcome back, {name}!
Toolbar: (📅)(This month ▾)                              (＋ Add content)
Row 1:   KPI Content pieces · KPI Drafts & scheduled · KPI SEO score · KPI Open press
Row 2:   [BarChartCard "Content output" — published vs drafted, by week   ] [DonutCard "Content mix" by type]
Row 3:   [Table card "Recent content"                                     ] [ProgressList "Directory goals" + Coming up list]
```

### 5.2 Feature page (Content, Directories, Press & Media)

```
Header:  {Feature}  ·  one-line purpose
Toolbar: filter pills (status, type, owner, period)      (Export)(＋ Add …)
Row 1:   3–4 KpiCards for this feature
Row 2:   [Table card — the working list            ] [Side card: activity / checklist / chart]
```

### 5.3 Analysis page (SEO checker, SEO analytics)

```
Header:  {Feature}
Toolbar: input pill (URL) + primary pill, or period pills
Row 1:   [LineChartCard — main trend               ] [DonutCard or score ring card]
Row 2:   KPI row of sub-scores
Row 3:   [Table card — issues / pages              ]
```

## 6. Motion

Keep motion short and purposeful. Hover colour changes take 120ms. Chart series draw in once on mount (400ms ease-out, opacity plus path length), never again on re-render. Tooltips fade in 100ms. Dialogs scale from 96% to 100% in 150ms. Everything respects `prefers-reduced-motion`, which is handled globally.

## 7. Responsive

- **`lg` (1024px) and up:** the full sidebar.
- **Below `lg`:** the top bar with scrolling nav pills.
- **KPI row:** 4 columns at `xl`, 2 columns down to phones. KPI figures drop to 24px below `sm`.
- **Main + side rows** stack: main first, then side.
- **Toolbar:** filters scroll horizontally, and actions wrap to their own row with the primary pill full-width on phones.
- **Overflow:** only tables and chart plots may scroll horizontally, and always inside their card.

## 8. Accessibility

- Every icon-only button has an `aria-label` that names its destination or action.
- Charts get an `aria-label` summarising the trend, and their data is also reachable in text (tooltip values plus a visually hidden table or list).
- Delta direction is never conveyed by colour alone: the arrow plus a "+" or "−" sign are always present.
- Focus is a visible 3px violet ring (`ring-ring/50`) on everything, and `ring-sidebar-ring` on the sidebar.

## 9. Migration

| Building block | State |
|---|---|
| Tokens (`globals.css`) | ✅ Live |
| `Wordmark` / `BrandMark` | ✅ Exists |
| Sidebar shell (`AppSidebar`) + `SidebarNavLink` | ✅ Restyled to 4.12: 44px pills, solid violet active pill, collapsible icon rail (remembered per browser). The account moved to the top bar. No Help link until a help page exists |
| `PageHeader` / `PageContent` | ✅ Title + subtitle only (no eyebrow), 26px title, full width, 16px gaps. Still to add: the toolbar slot (3.3). `TopBar` with the profile menu is ✅ built |
| `Button` | ✅ Restyled to 4.9 (all variants and sizes) |
| `Table` | ✅ `variant="pill"` built to 4.8; used on Content. Other tables switch when their page is redesigned |
| `Skeleton` | ✅ Added (shadcn) |
| `Input`, `NativeSelect`, `Textarea`, `Label` | ✅ Restyled to 4.13 (44px, `rounded-xl`, violet focus ring, 13px labels). `Textarea` added (shadcn) |
| `Card` | ✅ Restyled to 4.3 (22px radius, 1px border, no shadow, 17px title) |
| `Badge`, `Dialog` | ⚠️ Mostly on spec; final pass to confirm 4.11 and 4.13 |
| `KpiCard`, `KpiGrid`, `DeltaChip` | ✅ Built in `src/components/KpiCard.tsx`, used on every page. `StatCard` is removed |
| `Toolbar`, `ToolbarGroup`, `SearchPill`, `PillSelect` | ✅ Built in `src/components/Toolbar.tsx`; used on Content. Period picker still to build |
| `LineChartCard`, `BarChartCard`, `DonutCard` | 🆕 To build on shadcn `chart` (Recharts). This adds the `recharts` dependency when the first chart lands. |
| `ProgressList` | 🆕 To build |
| Pages | ⏳ Moved one at a time. Content: ✅ done (cards, toolbar, table, stage-first add/edit dialog). Then Overview, Directories, Press & Media, SEO |
