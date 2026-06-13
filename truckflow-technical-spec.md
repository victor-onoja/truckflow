# TruckFlow — Technical Specification & Implementation Plan

**Version:** 1.0
**Phase:** V1 Demo (mobile-focused web app)
**Companion document:** TruckFlow PRD v1.0
**Purpose:** This document is the build blueprint. An agentic coding tool should be able to implement the full V1 demo from this spec without further product decisions.

-----

## 1. Resolved Business Rules (from PRD Open Questions)

These decisions OVERRIDE anything ambiguous in the PRD. Treat them as canonical.

### 1.1 Visit Types — not every truck does all 8 stages

The stage sequence is **always linear**, but trucks follow one of three visit types:

|Visit Type    |Stage Sequence               |Scenario                                                                                                                                                   |
|--------------|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
|`FULL_CYCLE`  |1 → 2 → 3 → 4 → 5 → 6 → 7 → 8|Truck offloads empties AND loads finished product                                                                                                          |
|`OFFLOAD_ONLY`|1 → 2 → 3 → 4 → 8            |Truck returns with empties but is NOT yet planned for loading. Skips Loading, Latching, **and Fueling**. Leaves plant and waits in truckyard until planned.|
|`LOAD_ONLY`   |1 → 2 → 5 → 6 → 7 → 8        |Truck previously offloaded, now returns to load. Goes straight from Queuing to Loading.                                                                    |

**Hard rules:**

- A truck must be loaded before it can be fueled. Fueling (stage 7) ONLY appears in sequences that include Loading (stage 5). Never allow fueling on an `OFFLOAD_ONLY` visit.
- Fueling is always done on-site — never optional within `FULL_CYCLE` or `LOAD_ONLY`.
- Visit type is selected at **Gate In** by the gate officer (3-option selector). Default: `FULL_CYCLE`.
- Stages cannot run in parallel. Stage N+1 (in the visit’s sequence) cannot start until stage N has ended.

### 1.2 Queuing (stage 2) — generalized derivation

Queuing duration = **(start time of the first post-queue stage in the visit’s sequence) − (Gate In time)**.

- `FULL_CYCLE` / `OFFLOAD_ONLY`: Unlatching start − Gate In
- `LOAD_ONLY`: Loading start − Gate In

Never stored as raw input. Always computed on read.

### 1.3 QR codes — keep both options open

No final decision on permanent-per-truck vs single-use-per-visit. **Implement the data model to support both** (`QRCode.type = PERMANENT | SINGLE_USE`), but V1 demo ships with **permanent per-truck QR codes** (simplest path; no printing infrastructure needed). Single-use generation is a stubbed admin action behind the same abstraction.

### 1.4 Concurrency scale — unknown, design conservatively

Peak simultaneous trucks not yet measured (traffic marshals throttle entry manually). For V1:

- Use **polling (10s interval)** for live queue updates. No WebSocket infrastructure.
- Keep the data-fetch layer behind a single hook (`useLiveQueue`) so a WebSocket/SSE swap in V2 touches one file.

### 1.5 Timestamp overrides — deferred

No override UI in V1. The `StageEvent` schema includes `is_override` and `overridden_by` fields so the audit model is future-proof, but no endpoint or screen exposes them yet.

### 1.6 External notifications on Gate Out

On Gate Out, notify **distribution team leaders and warehouse supervisors** (NOT drivers/dispatch).

- V1 demo: in-app notification feed + console-logged email stub via a `NotificationService` interface.
- The service interface must accept channel types (`IN_APP`, `EMAIL`, `SMS`) so real providers (e.g. SMTP, Termii/Twilio) plug in at V2 without touching call sites.
- New role added: `DISTRIBUTION_LEAD` (receives gate-out notifications, read-only dashboard access like Supervisor).

-----

## 2. Tech Stack

Chosen for: fast demo delivery, mobile-web-first, easy agentic implementation, clean migration path to production.

|Layer              |Choice                                                                       |Rationale                                                                       |
|-------------------|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------|
|Framework          |**Next.js 14+ (App Router) + TypeScript**                                    |Single repo for UI + API, server actions, easy deploy (Vercel) for demo         |
|Styling            |**Tailwind CSS**                                                             |Fast mobile-first iteration; design tokens below                                |
|Database           |**SQLite via Prisma** (demo) → Postgres-ready                                |Zero-config for demo; Prisma schema ports to Postgres by changing the datasource|
|ORM                |**Prisma**                                                                   |Type-safe, schema-as-source-of-truth                                            |
|Auth               |**Phone + 4-digit PIN → signed httpOnly session cookie** (use `jose` for JWT)|Matches PRD FR-06; no OAuth complexity for a yard demo                          |
|QR scanning        |**`html5-qrcode`** (or `@zxing/browser` if issues)                           |Browser camera scanning, works on Android Chrome + iOS Safari                   |
|QR generation      |**`qrcode`** npm package                                                     |Generate truck QR codes in admin panel                                          |
|Charts (supervisor)|**Recharts**                                                                 |Stage-duration bar charts                                                       |
|State/data fetching|**SWR** with 10s `refreshInterval` for live views                            |Polling per §1.4                                                                |
|Validation         |**Zod**                                                                      |Shared schemas between API routes and forms                                     |

**No native app, no PWA service worker, no offline mode in V1** (offline is V2 per PRD FR-15).

-----

## 3. Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Next.js App (single deployment)            │
│                                             │
│  /app (App Router pages — mobile-first UI)  │
│  /app/api/* (REST-ish route handlers)       │
│  /lib/stage-machine.ts  ← CORE LOGIC        │
│  /lib/notifications.ts  ← service interface │
│  /lib/auth.ts                               │
│  /prisma/schema.prisma                      │
└──────────────────┬──────────────────────────┘
                   │ Prisma
            ┌──────▼──────┐
            │   SQLite    │ (file: ./dev.db)
            └─────────────┘
```

**Core principle: all stage-transition logic lives in ONE module** (`lib/stage-machine.ts`). API routes are thin. The UI never decides what the next stage is — it asks the server.

-----

## 4. The Stage Machine (core logic — implement this first)

### 4.1 Stage definitions

```ts
// lib/stages.ts
export const STAGES = {
  GATE_IN:    { num: 1, name: 'Gate In',    capture: 'INSTANT' },
  QUEUING:    { num: 2, name: 'Queuing',    capture: 'DERIVED' },
  UNLATCHING: { num: 3, name: 'Unlatching', capture: 'START_END' },
  OFFLOADING: { num: 4, name: 'Offloading', capture: 'START_END' },
  LOADING:    { num: 5, name: 'Loading',    capture: 'START_END' },
  LATCHING:   { num: 6, name: 'Latching',   capture: 'START_END' },
  FUELING:    { num: 7, name: 'Fueling',    capture: 'START_END' },
  GATE_OUT:   { num: 8, name: 'Gate Out',   capture: 'INSTANT' },
} as const;

export const VISIT_SEQUENCES: Record<VisitType, StageKey[]> = {
  FULL_CYCLE:   ['GATE_IN','QUEUING','UNLATCHING','OFFLOADING','LOADING','LATCHING','FUELING','GATE_OUT'],
  OFFLOAD_ONLY: ['GATE_IN','QUEUING','UNLATCHING','OFFLOADING','GATE_OUT'],
  LOAD_ONLY:    ['GATE_IN','QUEUING','LOADING','LATCHING','FUELING','GATE_OUT'],
};
```

### 4.2 Transition rules (server-enforced)

1. `gateIn(truckId | qrCode, visitType, userId)` — creates Visit + StageEvent(GATE_IN, instant server timestamp). Truck enters QUEUING state implicitly. Rejects if truck already has an active (non-gated-out) visit.
1. `startStage(visitId, stageKey, userId)` — valid only if:
- `stageKey` is the next un-started START_END stage in the visit’s sequence
- previous START_END stage (if any) has an `end_at`
- QUEUING is never started manually — it auto-resolves when the first post-queue stage starts
1. `endStage(visitId, stageKey, userId)` — valid only if that stage has `start_at` and no `end_at`.
1. `gateOut(visitId, userId)` — valid only when every START_END stage in the sequence has ended. Records instant timestamp, computes `total_duration`, fires `NotificationService.notifyGateOut(visit)` to all active users with role `DISTRIBUTION_LEAD` or `SUPERVISOR` (warehouse supervisors).
1. **All timestamps are `new Date()` on the server.** Reject any client-supplied timestamps.
1. Every mutation records `triggered_by_user_id`.

### 4.3 Queuing derivation helper

```ts
export function queuingDuration(visit: VisitWithEvents): number | null {
  const gateIn = findEvent(visit, 'GATE_IN')?.start_at;
  const firstPostQueue = visit.visit_type === 'LOAD_ONLY' ? 'LOADING' : 'UNLATCHING';
  const start = findEvent(visit, firstPostQueue)?.start_at;
  return gateIn && start ? diffMinutes(gateIn, start) : null; // null = still queuing
}
```

-----

## 5. Database Schema (Prisma)

```prisma
// prisma/schema.prisma
datasource db { provider = "sqlite"; url = "file:./dev.db" }
generator client { provider = "prisma-client-js" }

enum Role { GATE_OFFICER YARD_OPERATOR FUELING_STAFF SUPERVISOR DISTRIBUTION_LEAD ADMIN }
enum VisitType { FULL_CYCLE OFFLOAD_ONLY LOAD_ONLY }
enum VisitStatus { ACTIVE COMPLETED }
enum QRType { PERMANENT SINGLE_USE }
enum NotifChannel { IN_APP EMAIL SMS }

model User {
  id        String  @id @default(cuid())
  phone     String  @unique
  pinHash   String
  fullName  String
  role      Role
  isActive  Boolean @default(true)
  events    StageEvent[]
  createdAt DateTime @default(now())
}

model Truck {
  id          String  @id @default(cuid())
  plateNumber String  @unique
  driverName  String
  isActive    Boolean @default(true)
  qrCodes     QRCode[]
  visits      Visit[]
}

model QRCode {
  id         String   @id @default(cuid())
  truckId    String
  truck      Truck    @relation(fields: [truckId], references: [id])
  codeString String   @unique          // payload encoded in the QR image
  type       QRType   @default(PERMANENT)
  isActive   Boolean  @default(true)
  issuedAt   DateTime @default(now())
  expiresAt  DateTime?
}

model Visit {
  id           String      @id @default(cuid())
  truckId      String
  truck        Truck       @relation(fields: [truckId], references: [id])
  visitType    VisitType
  status       VisitStatus @default(ACTIVE)
  gateInAt     DateTime
  gateOutAt    DateTime?
  totalMinutes Int?
  events       StageEvent[]
  createdAt    DateTime    @default(now())
}

model StageEvent {
  id              String   @id @default(cuid())
  visitId         String
  visit           Visit    @relation(fields: [visitId], references: [id])
  stageKey        String   // 'GATE_IN' | 'UNLATCHING' | ... (QUEUING never stored)
  stageNum        Int
  startAt         DateTime
  endAt           DateTime?        // null for INSTANT stages and in-progress stages
  durationMinutes Int?
  notes           String?
  triggeredById   String
  triggeredBy     User     @relation(fields: [triggeredById], references: [id])
  isOverride      Boolean  @default(false)   // schema-only in V1, no UI
  createdAt       DateTime @default(now())

  @@unique([visitId, stageKey])
}

model Notification {
  id        String       @id @default(cuid())
  userId    String
  channel   NotifChannel @default(IN_APP)
  title     String
  body      String
  visitId   String?
  readAt    DateTime?
  createdAt DateTime     @default(now())
}
```

-----

## 6. API Surface

All routes under `/app/api`. All return `{ ok: true, data }` or `{ ok: false, error }`. All protected by session middleware; role checks server-side.

|Method & Path                       |Roles                                 |Purpose                                                                                                                   |
|------------------------------------|--------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
|`POST /api/auth/login`              |public                                |`{ phone, pin }` → session cookie                                                                                         |
|`POST /api/auth/logout`             |any                                   |clear session                                                                                                             |
|`POST /api/gate-in`                 |GATE_OFFICER                          |`{ qrCode? , manualCode?, visitType }` → creates visit. Resolves truck via QRCode.codeString                              |
|`GET  /api/queue`                   |all staff                             |All ACTIVE visits, sorted by gateInAt asc, with computed: current stage, elapsed-in-stage, total elapsed, queuing duration|
|`GET  /api/visits/:id`              |all staff                             |Full visit detail with all events + derived queuing                                                                       |
|`POST /api/visits/:id/stage/start`  |YARD_OPERATOR (3–6), FUELING_STAFF (7)|`{ stageKey, notes? }` — server validates per §4.2                                                                        |
|`POST /api/visits/:id/stage/end`    |same as start                         |`{ stageKey, notes? }`                                                                                                    |
|`POST /api/visits/:id/gate-out`     |GATE_OFFICER                          |Completes visit, fires notifications                                                                                      |
|`GET  /api/history`                 |SUPERVISOR, DISTRIBUTION_LEAD, ADMIN  |Completed visits; filters: dateFrom, dateTo, truckId, visitType                                                           |
|`GET  /api/analytics/stage-averages`|SUPERVISOR, ADMIN                     |Avg duration per stage over date range, grouped by visitType                                                              |
|`GET  /api/notifications`           |any                                   |Current user’s in-app notifications                                                                                       |
|`POST /api/admin/trucks`            |ADMIN                                 |Register truck → auto-generates PERMANENT QRCode                                                                          |
|`GET  /api/admin/trucks/:id/qr`     |ADMIN                                 |PNG/SVG QR image for printing                                                                                             |
|`POST /api/admin/users`             |ADMIN                                 |Create staff user with role + PIN                                                                                         |

**Role-to-stage permission map (enforce in stage-machine, not just routes):**

- Stages 3,4,5,6 → `YARD_OPERATOR` (and `ADMIN`)
- Stage 7 → `FUELING_STAFF` (and `ADMIN`)
- Stages 1,8 → `GATE_OFFICER` (and `ADMIN`)

-----

## 7. Screens & Routes (mobile-first, 375px base)

|Route                 |Screen (PRD ref)|Roles                  |Notes                                                                                                                                                                                                                                                       |
|----------------------|----------------|-----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|`/login`              |—               |public                 |Phone + PIN pad                                                                                                                                                                                                                                             |
|`/gate-in`            |SCR-01          |Gate Officer           |Tabs: [Scan QR] / [Enter Code]. **Plus visit-type selector: Full Cycle / Offload Only / Load Only** (3 large radio cards, Full Cycle preselected). Success card shows truck, time, queue position                                                           |
|`/queue`              |SCR-02          |all staff              |Default landing after login. SWR 10s polling. Card: plate, driver, visit type chip, current stage pill, live elapsed timers, color status (green/amber/red vs thresholds)                                                                                   |
|`/visit/[id]`         |SCR-03          |Yard Op / Fueling      |Stage action view. Shows the visit’s OWN sequence (5, 6, or 8 stages) as a vertical progress rail. Big START (green) / END (red) buttons, live stopwatch, optional notes, confirm modal on END. Buttons only render for stages the logged-in role may act on|
|`/visit/[id]/gate-out`|SCR-04          |Gate Officer           |Enabled only when stage machine says visit is gate-out-ready. Summary card with every stage duration incl. derived queuing + total                                                                                                                          |
|`/dashboard`          |SCR-05          |Supervisor / Dist. Lead|Metric tiles (on-site now, completed today, avg turnaround, longest active), live table, history with filters, Recharts bar chart of avg stage durations, bottleneck highlight. Read-only                                                                   |
|`/notifications`      |new             |all                    |In-app feed; bell icon with unread count in header                                                                                                                                                                                                          |
|`/admin`              |new             |Admin                  |Truck registry + QR display/download, user management                                                                                                                                                                                                       |

**UI invariants:**

- Tap targets ≥ 48px, body text ≥ 16px, contrast ≥ 4.5:1 (outdoor use)
- Critical actions ≤ 2 taps from `/queue`
- Stage rail must visually skip stages not in the visit’s sequence (e.g. LOAD_ONLY shows: Gate In ✓ → Queuing → Loading → Latching → Fueling → Gate Out — Unlatching/Offloading simply absent, not greyed)
- Visit type chips: `FULL` (amber), `OFFLOAD` (blue), `LOAD` (green)

**Design direction:** industrial/utilitarian. Dark charcoal `#0f0e0c` headers, warm paper `#f5f0e8` surfaces, amber `#c8860a` accent, IBM Plex Sans + IBM Plex Mono for timestamps/IDs. High-contrast, no decorative gradients — this is a tool used in sunlight with gloves.

-----

## 8. Notification Service

```ts
// lib/notifications.ts
export interface NotificationProvider {
  send(n: { userId: string; channel: NotifChannel; title: string; body: string; visitId?: string }): Promise<void>;
}

// V1 providers:
// - InAppProvider: writes Notification row (real)
// - EmailStubProvider: console.log + Notification row with channel EMAIL (stub)

export async function notifyGateOut(visit: VisitWithTruck) {
  const recipients = await prisma.user.findMany({
    where: { role: { in: ['DISTRIBUTION_LEAD', 'SUPERVISOR'] }, isActive: true },
  });
  const body = `${visit.truck.plateNumber} (${visit.visitType}) gated out at ${fmt(visit.gateOutAt)}. Total: ${visit.totalMinutes} min.`;
  await Promise.all(recipients.flatMap(u => [
    inApp.send({ userId: u.id, channel: 'IN_APP', title: 'Truck Gate Out', body, visitId: visit.id }),
    emailStub.send({ userId: u.id, channel: 'EMAIL', title: 'Truck Gate Out', body, visitId: visit.id }),
  ]));
}
```

-----

## 9. Stage Duration Thresholds (PRD FR-10)

Hardcode in V1 as a config object (admin-editable in V2):

```ts
export const THRESHOLDS_MIN = {
  QUEUING: { amber: 30, red: 60 },
  UNLATCHING: { amber: 10, red: 20 },
  OFFLOADING: { amber: 45, red: 90 },
  LOADING: { amber: 45, red: 90 },
  LATCHING: { amber: 10, red: 20 },
  FUELING: { amber: 20, red: 40 },
};
```

-----

## 10. Seed Data (for demo)

`prisma/seed.ts` must create:

- 1 user per role (6 users). PINs: `1234`. Phones: `0801…0806` pattern. Names like “Gate Officer Demo”.
- 6 trucks with Nigerian-style plates (e.g. `KJA-482-XA`), each with a PERMANENT QRCode (codeString = `TF-{plate}`).
- 3 historical COMPLETED visits (one of each visit type) with realistic timestamps spread over the past 2 days — so the dashboard and analytics have data on first load.
- 1 ACTIVE visit currently in OFFLOADING — so the live queue isn’t empty at demo start.

-----

## 11. Build Plan (execute in this order)

Each milestone is independently verifiable. Do not skip ahead.

### Milestone 1 — Foundation

- Scaffold Next.js + TS + Tailwind + Prisma (SQLite)
- Implement full Prisma schema (§5), run migration, write + run seed
- Auth: login route, session cookie, middleware guard, role helper
- ✅ Verify: can log in as each seeded role; protected route redirects when logged out

### Milestone 2 — Stage Machine + API

- Implement `lib/stages.ts`, `lib/stage-machine.ts` with all transition rules (§4)
- Implement all API routes (§6) as thin wrappers
- Write unit tests for the stage machine covering: all 3 visit-type sequences, out-of-order rejection, double-start rejection, fueling-requires-loading, gate-out-readiness, queuing derivation for LOAD_ONLY vs others
- ✅ Verify: tests pass; manual curl walkthrough of a FULL_CYCLE visit end-to-end

### Milestone 3 — Gate In + Live Queue

- `/login`, `/gate-in` (QR scan via html5-qrcode + manual code + visit-type selector), `/queue` with SWR polling, live timers, threshold colors
- ✅ Verify: scan/enter a seeded code on a phone-sized viewport → truck appears in queue with running timer

### Milestone 4 — Stage Actions + Gate Out

- `/visit/[id]` action view with sequence-aware progress rail, START/END flow, stopwatch, notes, confirm modal
- `/visit/[id]/gate-out` with full summary card
- Notification service + `/notifications` feed
- ✅ Verify: walk an OFFLOAD_ONLY visit gate-in → gate-out; confirm fueling never appears; confirm distribution lead receives in-app notification

### Milestone 5 — Dashboard + Admin

- `/dashboard` metrics, history with filters, Recharts stage-average chart, bottleneck flag
- `/admin` truck registry + QR generation/download, user creation
- ✅ Verify: seeded historical visits render correct averages; new truck’s QR scans successfully at gate-in

### Milestone 6 — Polish pass

- Mobile QA at 375px on all screens, empty states, error toasts, loading skeletons
- Lighthouse mobile pass: queue board interactive < 2s on simulated 3G

-----

## 12. Acceptance Criteria (demo sign-off)

1. A truck can complete all three visit types end-to-end with correct stage sequences enforced.
1. Attempting any out-of-sequence action (e.g. END before START, fueling on OFFLOAD_ONLY, gate-out with an open stage) is rejected server-side with a clear error.
1. All timestamps originate server-side; queuing is always derived, never entered.
1. Every StageEvent records the acting user; supervisor views are read-only.
1. Gate Out fires notifications to all DISTRIBUTION_LEAD and SUPERVISOR users.
1. Live queue updates within 10s without page refresh; thresholds colorize correctly.
1. Dashboard shows correct per-stage averages split by visit type.
1. QR scan works on Android Chrome and iOS Safari; manual code is a full fallback.

-----

## 13. Explicitly Out of Scope (V1)

- Timestamp override UI (schema fields exist, no endpoints/screens)
- Real SMS/email delivery (stubbed behind NotificationProvider)
- Single-use QR generation flow (enum exists; not exposed)
- Offline mode / service worker
- WebSocket real-time (polling only; isolated in `useLiveQueue`)
- WhatsApp integration, native apps, NFC

-----

## 14. Open Items Carried Forward

|Item                      |Status                   |Action                                                |
|--------------------------|-------------------------|------------------------------------------------------|
|QR permanent vs single-use|Undecided                |Demo ships permanent; revisit after stakeholder review|
|Peak truck concurrency    |Being measured on-site   |Revisit polling vs push after numbers arrive          |
|Override permissions      |Deferred to testing phase|Design admin override flow in V2 spec                 |
|Email/SMS provider choice |Pending                  |Evaluate Termii (NG SMS) + SMTP in V2                 |