# Attendo — University Attendance & Live Classroom Interaction Platform

A software-only replacement for paper attendance: students check in with a
teacher-issued code, then get verified by one or more unpredictable live
checkpoints during the lesson. No hardware, no biometrics, no GPS claims.

## Stack

Next.js 14 (App Router, TypeScript) · Prisma + PostgreSQL · JWT session
cookies (jose) · bcrypt · Tailwind · Anthropic API for checkpoint generation
and the attendance assistant.

Chosen for: one deployable app (frontend + API in the same Next.js process),
Postgres is boring and reliable, no separate auth vendor to pay for or
depend on, and it runs fine on a single small VPS for a first pilot — see
`THREAT_MODEL.md` for the reasoning behind the security-relevant choices.

## Setup

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

`AUTH_SECRET`: generate with `openssl rand -base64 48`. Without it the app
refuses to start signing sessions rather than fall back to something weak.

Seeded demo logins (all password `ChangeMe123!`, force a reset before any
real pilot):

| Role     | Email                          |
|----------|---------------------------------|
| Admin    | admin@aero.university.dz        |
| Teacher  | k.ferhat@aero.university.dz     |
| Engineer | y.meziane@aero.university.dz    |
| Student  | student1@aero.university.dz     |

## What is actually real here vs. what's scaffolded

This was built in one pass. Being straight about the boundary matters more
than a demo that looks finished:

**Real and working, if you run it:**
- Full Prisma schema for every entity in the spec (users, departments,
  programs, groups, courses, assignments, terms, sessions, attendance
  records, checkpoints + answers, integrity alerts, absence requests,
  notifications, audit logs, system events), with real relations,
  uniqueness constraints, and indexes.
- End-to-end critical path: teacher starts a session → cryptographically
  random join code (hashed at rest, never logged in plaintext) → student
  checks in within a configurable window → teacher publishes an AI-drafted
  or hand-written checkpoint → student answers within a server-enforced
  time window → teacher ends class → server computes final verification
  state per student → integrity engine scans for anomalies → audit log
  entries at every step.
- Server-side authorization on every route (role checks + ownership checks
  — a teacher can only touch their own assignments/sessions, an admin only
  their own department, a student only their own records). The client never
  decides what it's allowed to do.
- Anti-cheat heuristics that actually run against real data: synchronized
  check-in clusters, overlapping "live" sessions for one student, uniform
  checkpoint-answer latency across sessions. All three write an
  `AttendanceIntegrityAlert` with evidence — none of them touch the
  official record directly.
- AI agent with real role-scoped context building (a teacher's query only
  ever sees their own courses' data fetched server-side; the model never
  gets DB access itself) and an explicit untrusted-content boundary for
  teacher-supplied source material.
- Rate limiting on login and check-in attempts (in-memory — see caveat
  below).

**Deliberately not done, and why:**
- **No test suite, no `npm install`/build verification.** This sandbox has
  no network access, so dependencies were never installed and the code was
  never compiled or run. Read it like a careful first draft from a senior
  engineer, not like something with a green CI run behind it. Before you
  trust it: `npm install`, fix whatever TypeScript surfaces (there will be
  a few version-drift issues — Next 14 API route signatures and Prisma
  client typing are the likeliest spots), then run the seed and click
  through the four roles yourself.
- **In-memory rate limiting.** Fine for one Node process, silently useless
  the moment you run two instances behind a load balancer. Swap for
  Redis `INCR`/`EXPIRE` before scaling past a single server — flagged in
  `src/lib/rate-limit.ts`.
- **No forced password reset on account creation.** Admin-created accounts
  get a temp password shown once; nothing currently forces a change on
  first login. Real deployment needs that before go-live.
- **No live push channel.** Checkpoints and rosters are polled (4–8s
  intervals), not pushed. Works fine for a 30-person classroom; swap for
  Server-Sent Events or a WebSocket if you want sub-second roster updates
  at scale.
- **No CSV/PDF export endpoint yet**, though the report route returns
  everything needed to build one trivially (Phase 7 continuation).
- **No French/Arabic i18n layer** — UI copy is English-only right now,
  even though the spec asks for readiness. The string surface is small
  enough (dashboards, not marketing pages) that wiring next-intl in is a
  half-day, not an architecture change.
- **No CI, no deployment config, no Docker/Fly/Railway files.** Phase 11
  from the original spec is untouched.

## Independent product judgment (spec §30)

Sent as the lead-in to this build in chat, not duplicated here — worth
reading there since some of it changes what the MVP should even contain.

## Repo map

```
prisma/schema.prisma        full data model
prisma/seed.ts              demo data (Aerodynamics / L3-A)
src/lib/auth.ts              password hashing + JWT session cookie
src/lib/rbac.ts              role + department scoping helpers
src/lib/anti-cheat.ts        integrity engine (heuristic scanners)
src/lib/ai-agent.ts          role-scoped AI assistant + checkpoint generation
src/lib/audit.ts             audit log + system event writers
src/middleware.ts             coarse route gating (not the auth boundary)
src/app/api/**                all server routes, one responsibility each
src/app/{admin,teacher,student,engineer}/dashboard  the four role UIs
```
