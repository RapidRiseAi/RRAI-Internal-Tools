# Rapid Rise OS — Command Deck Roadmap

A living plan for turning Rapid Rise OS into a single "command deck" where the team
runs the whole business — and where Claude lives *inside* the system rather than in
another tab.

## North star
One dark, HUD-style operating surface that shows **everything relevant** at a glance,
lets people **act without leaving** (message, approve, draft, launch work), and pulls
in the **outside signals** that matter (email, calendar, social, deploys, money).

## Working principles
- **Presentation-first, honest data.** Every number/chart comes from real data — no
  invented placeholders. If a widget needs data we don't have, it's flagged, not faked.
- **Additive backend.** New tables/actions only; never rename or change existing
  function/route/model signatures or what a control already does.
- **Sliced delivery.** Each item below ships as its own slice behind a checkpoint, with
  `typecheck` / `lint` / `build` green before push.
- **Reuse the kit.** Radial rings, glass cards, list panels, status pills, line/funnel
  charts, workload bars — one component vocabulary everywhere.

## Legend
**Status:** ✅ shipped · 🔜 approved/next · 🟢 buildable now (data exists) ·
🟡 needs setup (API keys/OAuth) · 🔴 needs new data/schema.
**Effort:** S (hours) · M (1–2 days) · L (multi-day).

> Honest note on integrations: surfacing email/social/deploys *in the app* means **the
> app** calls those APIs server-side with credentials you add. The Gmail / Canva /
> Supabase / Vibe Prospecting / GitHub MCP servers connected to the Claude session are a
> signal of intent and useful to Claude while building, but the running app needs its own
> tokens.

---

## Phase 0 — Shipped ✅
| Feature | Notes |
|---|---|
| Command-deck theme | Palette + Space Grotesk / JetBrains Mono / Inter tokens; legacy tokens kept |
| Restyled shell | Collapsible sidebar, active-route indicator, live clock, notification dropdown, user menu |
| Business Control Panel (`/dashboard`) | KPI rings, Revenue vs Expenses chart + range control, lead funnel, activity, deadlines |
| My Panel (`/my-panel`) | Per-user KPIs, weekly workload, to-do / in-progress, my projects, required actions, notifications |
| Messaging (`/messages`) | 1:1 DMs + team/role broadcast; notifications fan-out; unread badges |

---

## Phase 1 — Calendar & agenda widgets 🔜 (next slice, approved)
Most of this is buildable now from data already in the app (the `/calendar` page already
derives a unified schedule from tasks, project deadlines, invoices, retainers, expenses).

| Widget | Where | Status | Effort | Notes |
|---|---|---|---|---|
| **Today's Agenda** | My Panel + Control Panel | 🟢 | S | Time-ordered list of today's scheduled items for me / the org, reusing the calendar derivation. |
| **Week-at-a-glance** mini calendar | My Panel | 🟢 | S | 7-day strip with per-day counts; click-through to `/calendar`. |
| **"Up next" ribbon** | Top of My Panel | 🟢 | S | The single next event/task with a live countdown (mono HUD styling). |
| **Pull external Google Calendar events** | Agenda widgets | 🟡 | M | You already have Google OAuth for task→Calendar sync; add `calendar.readonly` to *read* events back so meetings show alongside tasks. |
| **Free/busy + workload guardrails** | My Panel | 🟢 | M | Flag days where scheduled task `duration_minutes` exceed a working-hours threshold. |

---

## Phase 2 — Mail (Gmail) 🟡
Extends the **existing** Google OAuth — just add `gmail.readonly` (and later `gmail.send`).

| Widget | Status | Effort | Notes |
|---|---|---|---|
| **My Emails** panel (unread / important) | 🟡 | M | On My Panel; threads with sender, snippet, time. |
| **Client comms timeline** | 🟡 | M | On a client/lead record: emails to/from that contact interleaved with notes & activity. |
| **Draft reply with Claude** | 🟡 | M | Pre-draft a response from the thread + record context (see Phase 4). |
| **Send from app** (`gmail.send`) | 🟡 | M | Reply/compose without leaving; logs to activity. |

---

## Phase 3 — Systems & deploys 🟡
A "Systems" panel of the infrastructure you run.

| Widget | Source | Status | Effort |
|---|---|---|---|
| **Deploy status** (last build, state, commit, preview URL) | Vercel API | 🟡 | S |
| **Domain / SSL / DNS health** | Cloudflare API | 🟡 | M |
| **Uptime / response time** | Cloudflare or an uptime probe | 🟡 | M |
| **Error/incident feed** | Vercel logs / Sentry (if added) | 🟡 | M |
| **Supabase health** (DB size, slow queries, advisors) | Supabase API | 🟡 | M |

---

## Phase 4 — Claude Mission Control 🟡 ("Claude lives in here")
Make Claude a first-class operator inside the system. Needs the Claude API and a GitHub
app token; runs execute server-side (Agent SDK / Claude Code) and stream status back.

| Capability | Status | Effort | Notes |
|---|---|---|---|
| **Launch a Claude run** against a repo | 🟡 | L | "Build a landing page for {client}", "fix this bug" → kicks a Claude Code/Agent run; row created in a `claude_runs` table. |
| **Run progress & logs inline** | 🟡 | L | Live status, step log, token/time usage, resulting PR link — progress bars reflect the agent. |
| **Task → Agent** | 🟡 | M | Convert a task into a Claude run; task status mirrors the run. |
| **Draft-with-Claude buttons** | 🟡 | M | On lead/client/project/quote: draft the follow-up email, SOP, proposal, or status update from that record's context. |
| **Ops copilot** | 🟡 | L | Ask questions over *your* data: "what's overdue across clients?", "summarize this client", "who's overloaded this week?" — read-only tool calls over the existing tables. |
| **Approvals for agent actions** | 🔴 | M | Human-in-the-loop gate before Claude sends an email / opens a PR / changes data. |

---

## Phase 5 — Social & marketing analytics 🟡
Feed the marketing deck (you already track `campaigns` and `content_items`) with real
numbers, and surface a content/outreach funnel.

| Connector | Surfaces |
|---|---|
| Meta / Instagram | Reach, engagement, leads per post → `content_items` performance |
| LinkedIn | Company page + post analytics |
| X / TikTok / YouTube | Views, follows, click-through |
| Unified "Social pulse" panel | Cross-platform KPI rings + a "top content" list |
| Outreach funnel | Already-tracked campaign metrics (contacted → replies → calls → quotes → deals) as a real funnel |

---

## Phase 6 — Finance truth 🟡
Replace derived finance numbers with booked truth.

| Connector | Surfaces |
|---|---|
| Stripe | Real payments/MRR/churn → finance deck + revenue chart |
| Xero / QuickBooks | Invoices, bills, P&L, cash position |
| Bank feed | Actual cash-in/out vs the expenses table |

---

## Phase 7 — Platform & cross-cutting
Quality-of-life and structural upgrades that lift the whole app.

| Feature | Status | Effort | Notes |
|---|---|---|---|
| **`targets` / `goals` table** | 🔴 | S | The big unlock: gives KPI rings real targets → honest "vs goal" rings and trend deltas everywhere. |
| **⌘K command palette** | 🟢 | M | Search across leads/clients/projects/tasks/quotes; jump anywhere. |
| **@mentions** (notes & messages) | 🟢 | M | Mention a teammate → notification. |
| **Approvals inbox** | 🟢 | M | Quotes/expenses/payroll awaiting sign-off in one queue. |
| **SLA timers on support tickets** | 🟢 | S | Time-to-first-response / resolution countdowns with breach flags. |
| **Time tracking** (clock on/off tasks) | 🔴 | M | Real workload vs estimate; feeds payroll & utilization. |
| **Real-time** (Supabase Realtime) | 🟡 | M | Live messages, notifications, presence without refresh. |
| **Presence** ("who's online") | 🟡 | S | Built on Realtime. |
| **Morning brief digest** | 🟢 | M | In-app/email summary: what's due, what changed, what needs you. |
| **Notification read-state + preferences** | 🟢 | S | Mark-read, per-type mute; ties the bell, messages, and mentions together. |
| **External client portal** | 🟡 | L | Reuse the deck for clients (project status, invoices, approvals) — needs client auth + RLS. |
| **Mobile PWA** | 🟢 | M | Installable, offline-aware shell. |
| **Audit trail** | 🟢 | M | Who changed what, surfaced per record. |

---

## New data we'd add (and what it unlocks)
| Addition | Unlocks |
|---|---|
| `messages` ✅ | Messaging (done) |
| `targets` / `goals` | Real "vs goal" KPI rings + honest trends across both panels |
| `claude_runs` | Mission Control run tracking & progress |
| `time_entries` | Time tracking, utilization, accurate workload |
| `integration_accounts` (encrypted tokens) | Per-workspace OAuth for Gmail/Vercel/Cloudflare/social/finance |
| `task.progress` column | Per-task progress bars (today only projects have a real %) |
| `notification.read_at` + types | Unified, clearable notifications |

---

## Suggested sequencing
1. **Calendar & agenda widgets** (Phase 1, mostly buildable now) ← next
2. **Targets table** (tiny, unlocks honest goal rings everywhere)
3. **Gmail** (high daily value; extends existing Google OAuth)
4. **Claude Mission Control** (the differentiator)
5. **Systems/deploys**, then **Social**, then **Finance truth**
6. **Cross-cutting** (palette, approvals, real-time) folded in continuously

Each is independent — we can reorder freely based on what creates the most leverage for you.
