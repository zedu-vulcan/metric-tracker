# Metric Tracker design system

> **Source of truth:** the tokens live in `src/app/globals.css` and are exposed as Tailwind classes such as `bg-primary` and `text-muted-foreground`. This document explains *how* to use them. If anything here disagrees with `globals.css`, the CSS wins. Please update this file in the same PR.

## Visual world

**Research Desk** is a quiet, editorial operations system for an in-house marketing team. It treats information as something to inspect closely: warm near-white paper, graphite ink, fine 1px rules, and violet as the single active thread running through otherwise restrained information. The quality bar is Attio / PostHog: calm, dense, precise.

## Foundations

### Color

Use the Tailwind token, never the hex value.

| Role | Token (Tailwind) | Value | Use |
|---|---|---|---|
| Signal | `primary` | `#8E6AFA` | The selected, actionable or changing thing. Never decoration. |
| Signal (pressed) | `primary-deep` | `#7551E8` | Hover state for primary actions, and violet text on light tints |
| Signal tint | `accent` | `#F0ECFF` | Active and selected surfaces, count badges on the current item |
| Paper | `background` | `#FAFAF9` | Page background |
| Sidebar | `sidebar` | `#F3F1EE` | Navigation rail |
| Sheet | `card`, `popover` | `#FFFFFF` | Raised surfaces: panels, dialogs, menus |
| Ink | `foreground` | `#1A1917` | Primary text |
| Muted ink | `muted-foreground` | `#706E69` | Labels, metadata, secondary text |
| Quiet fill | `muted`, `secondary` | `#F4F3F0` | Neutral badges, subtle hover fills |
| Rule | `border`, `input` | `#E5E3DF` | Hairlines, input borders |
| Strong rule | `border-strong` | `#CAC8C3` | Hovered borders, emphasized dividers |
| Favorable | `success` / `success-muted` | `#16A34A` / `#DCFCE7` | Positive movement, live |
| Attention | `warning` / `warning-muted` | `#D97706` / `#FEF3C7` | Pending, needs a look |
| Informational | `info` / `info-muted` | `#2563EB` / `#DBEAFE` | In review, neutral notices |
| Harmful | `destructive` / `destructive-muted` | `#DC2626` / `#FEE2E2` | Errors, rejected, destructive actions only |

The product is **light-theme only**.

**Data series** (`series-1` … `series-8`, `series-other`) are a separate categorical palette for charts: blue, orange, aqua, yellow, magenta, green, violet, red, then a neutral gray for folded "Other" buckets. Use them in that fixed order, assign them per entity (a channel keeps its colour across date ranges), and never use status colors or `primary` for a series. Several are below 3:1 on white, so every chart that uses them also offers a table view or visible labels. Never use a second y-axis: give a metric with a different scale its own aligned panel.

### Type

- **Manrope** (`font-sans`) for all UI: weights 400–800. The base size is 14px with a 1.5 line height.
- **JetBrains Mono** (`font-mono`) for every number, metric, count, ID and date-like value. It keeps figures aligned and scannable.
- Headings are bold with tight tracking: page titles are `text-base font-bold tracking-[-0.03em]`, and section titles are `text-[13px] font-bold tracking-[-0.02em]`.
- Small labels (stat labels, table headers, sidebar sections) are uppercase micro-labels: `text-2xs font-bold uppercase tracking-[0.07em] text-muted-foreground`.
- Hero display text (sign-in page only) is Manrope ExtraBold at a fluid size with very tight tracking (`-0.05em`). There is no serif in the system.

### Structure

- **Radius:** 8px base (`rounded-lg`) for buttons and inputs, about 11px (`rounded-xl`) for dialogs, and fully rounded for badges and pills.
- **Rules:** 1px hairlines in `border`. Separate regions with rules and whitespace, not shadows. Stats strips and side panels are divided by hairlines rather than placed in separate cards.
- **Spacing:** generous page margins that contract on small screens (`px-[clamp(20px,4vw,36px)]`). Content is dense inside a region, with breathing room between regions.
- **Layout:** an asymmetrical editorial layout (main column plus a narrower side panel) rather than a grid of equal cards.

## Components

Build with shadcn/ui (`src/components/ui/`), already themed to these tokens.

- **Wordmark** (`Wordmark`): a compact violet square with three white rising bars, plus the product name. Use the mark alone in tight spaces.
- **Primary action** (`Button`, default variant): solid violet with white semibold text, a soft violet glow, a 1px lift on hover and a deeper violet on hover. Use **one** primary action per view.
- **Secondary action** (`Button variant="outline"`): transparent with a hairline border and muted text that turns to ink on hover. Use `ghost` for icon-only and low-emphasis actions.
- **Sheets and dialogs:** white panels with a hairline ring, about 11px radius, a single soft shadow, and a muted footer strip holding the actions. Avoid stacked or nested cards and decorative shadows.
- **Forms:** labels are 12px semibold. Inputs are 42px tall on paper and turn white with a violet border and soft violet ring on focus. Mark optional fields with a small uppercase "optional" hint, and show errors in `destructive` below the field.
- **Status badges** (`Badge`): a tinted pill with a small dot in the current color: `success` live, `warning` submitted or pending, `info` in review, `destructive` rejected or failed, `secondary` planned or neutral.
- **Tables:** uppercase micro-label headers, 13px rows separated by hairlines, numbers right-aligned in mono, and a faint violet tint (`bg-primary/4`) on row hover. Row actions appear on hover or focus.
- **Metric states:** neutral at rest, violet for focus or current selection, green for favorable movement, amber for attention, and red only for harmful states.
- **Navigation** (`SidebarNavLink`): dense 13px labels in muted ink on the sidebar. The current item gets violet text and a 2px violet inset rule on its left edge, not a heavy filled pill. Counts sit in small mono pills.

## Interaction

Keep transitions short and deliberate: roughly 100–160ms for hover and focus, and one orchestrated entrance per surface (for example the sign-in sheet's settle-in). Focus states are always visible: a violet ring around controls. Reduced-motion preferences are honored globally in `globals.css`.

## Responsive behavior

Reading priority comes before symmetry. Build mobile-first:

- Below `lg` (1024px), the sidebar collapses into a horizontally scrolling strip at the top. Section labels and the account block are hidden.
- Side panels stack below the main content, and page padding contracts.
- The stats strip goes from 4 columns to 2. Low-priority table columns (such as dates) hide below `sm`.
- Nothing scrolls horizontally except tables.
- Aim for touch targets of at least 44px on mobile-first surfaces (`size="xl"` buttons, full-width actions).
