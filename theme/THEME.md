# Broadcast Hub — Design System

Brand lineage: **NazzilVideo** (dark, teal/green, bilingual EN/AR). This is the applied design system for the WhatsApp Broadcast Hub. The **live source of truth is `src/app/globals.css`** — these files document it.

Files: `design-tokens.json` (machine-readable) · `theme.css` (portable variables) · `palette.svg` (swatches) · this doc.

---

## Identity
- **Wordmark:** two-tone — first word **orange (#fb7a1e)**, second **green (#46e08a)**, weight 800 (`.brand .b1` / `.b2`).
- **Mark:** rounded square, 2.5px **teal (#2dd4c4)** border, radius 7px, green play triangle.
- **Fonts:** Inter (Latin) + Cairo (Arabic), auto-switched on `html[lang="ar"]` / `[dir="rtl"]`.

## Surfaces & text
`--bg #0e1a24` · `--bg2 #0a131b` · `--card #14222e` · `--card2 #172a38` · `--line #22323f` · `--line2 #2c4150` · `--ink #eaf3f5` · `--muted #90a6b4`.

## Brand accents
`--teal #2dd4c4` (primary, links, focus) · `--green #46e08a` (success) · `--orange #fb7a1e` (highlight) · `--danger #ff6b6b`. Signature gradient `135°, teal→green` on primary buttons (text `#06231f`).

## Delivery status colors (new — app-specific)
| Status | Token | Hex |
|---|---|---|
| PENDING | `--st-pending` | #90a6b4 |
| SENT | `--st-sent` | #5ac8ff |
| DELIVERED | `--st-delivered` | #2dd4c4 |
| READ | `--st-read` | #46e08a |
| FAILED | `--st-failed` | #ff6b6b |
| SCHEDULED | `--st-scheduled` | #c9a227 |
| SENDING | `--st-sending` | #2dd4c4 |
| COMPLETED | `--st-completed` | #46e08a |

Rendered as outline pill badges: `.badge.badge--<STATUS>`.

## Components (in `globals.css`)
`.nav` · `.brand` · `.stat` · `.card` · `.field`/`.label`/`.input` · `.btn` (+ `--danger`/`--ghost`/`--sm`) · `.pill` (filter chips, `.is-active`) · `.table` · `.badge--*` · `.progress`/`.progress__bar`.

## Accessibility / 2026 UX
- Touch targets ≥ **44px** (inputs/pills) and ≥ **48px** (primary buttons).
- Teal focus ring on inputs; outline badges keep contrast on dark.
- 3-link primary nav (Dashboard · Contacts · Campaigns) + auth controls.
- RTL via logical properties; Arabic switches to Cairo automatically.
