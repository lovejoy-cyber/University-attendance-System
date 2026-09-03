# Threat Model

## What we're actually defending against

Not a nation-state adversary. The realistic threat is: a student asks a
friend already in class to "check in for me," or shares a screenshot of a
join code in a group chat. That's it. Software cannot prove physical
presence — this system is designed to make casual proxy attendance
annoying enough that it stops being worth doing, and to make a teacher's
review fast when something looks wrong. It never claims certainty it
doesn't have.

## Why not one code (spec §11)

A single code, valid for the whole class, is one screenshot away from
being in every group chat in the cohort. Two structural choices fix the
easy version of this without hardware:

1. **The code must be redeemed by an authenticated, enrolled student
   account**, not just typed anywhere. Knowing the code is necessary, not
   sufficient — you also need valid credentials for someone actually in
   that group. A shared code lets N people attempt check-in, but each
   attempt is tied to a real account and logged.
2. **Unpredictable live checkpoints after check-in.** The join code only
   gets you to `NOT_VERIFIED`. Reaching `VERIFIED_PRESENT` requires
   answering at least one checkpoint that appears at a time the student
   couldn't have known in advance, inside a short window. A phone left with
   a friend after check-in still misses the checkpoint (or the friend has
   to keep answering on someone else's behalf all lesson, which is a much
   higher-effort, higher-risk cheat than sharing a code once).

Neither is airtight against a determined, coordinated pair of students
sitting together. Nothing software-only is. The integrity engine's
synchronized-submission and latency-fingerprinting scanners exist
specifically to catch the residue that pattern leaves over multiple
sessions — a single instance is invisible, a repeated pattern is not.

## Authentication & session handling

- Passwords: bcrypt, cost factor 12. Never compared with `===`,
  always through `bcrypt.compare`.
- Sessions: signed JWT (`jose`, HS256) in an `httpOnly`, `sameSite=lax`,
  `secure` (prod) cookie. 8-hour expiry — a teaching day, not indefinite.
  `AUTH_SECRET` is required to be 32+ bytes or the app refuses to start
  signing tokens.
- Login errors are identical whether the email doesn't exist or the
  password is wrong, to avoid leaking account existence.
- Login and check-in are both rate-limited per-actor (see README caveat on
  the in-memory limiter needing to become Redis at scale).

## Authorization

Every route re-derives the session from the cookie server-side and checks
role + ownership before touching data — see `src/lib/rbac.ts` and the
per-route checks (`requireRole`, explicit `teacherId === session.sub`,
`departmentId` scoping for admins). `src/middleware.ts` is a UX
convenience (redirect to the right dashboard), explicitly documented in
its own comments as *not* the authorization boundary, because edge
middleware is the wrong place to trust as a sole gate.

IDOR is the specific failure mode this guards against: a session ID or
checkpoint ID in a URL is not itself a credential. Every handler checks
that the caller is actually the teacher of that session, actually enrolled
in that group, or actually in the department they're querying, before
returning or mutating anything.

## Data minimization / privacy (spec §21)

- `checkinIp` / `checkinUserAgent` are stored as integrity-engine signal,
  never surfaced to anyone as "proof of location," and never described as
  such anywhere in the UI copy.
- No camera, microphone, or GPS access anywhere in the codebase — the spec
  explicitly forbids these and nothing in this build touches those browser
  APIs.
- Join codes are hashed at rest (bcrypt) exactly like passwords; the
  plaintext exists only in the single API response back to the teacher who
  started the session.

## AI-specific risks

- **Prompt injection via uploaded course material**: `ai-agent.ts` wraps
  any teacher-supplied text in `<untrusted_course_material>` tags with an
  explicit system-prompt instruction to treat it as reference content
  only, never as instructions — the same pattern used for the checkpoint
  generator. This reduces risk but injection defenses are not perfect;
  treat this as one layer, not a guarantee, and don't let checkpoint
  content auto-publish without a human glancing at it (which is already
  enforced: AI output is always `DRAFT` until a teacher calls `/publish`).
- **Data exfiltration via the assistant**: the model is never given
  database access or a free-text-to-SQL path. It only ever sees a JSON
  blob that the server already filtered to the caller's role before the
  API call. Worst case, the model answers badly from data it was
  legitimately allowed to see — it cannot reach into another department's
  table because it never had a query capability to begin with.
- **AI never writes to attendance records.** `generateCheckpointDraft`
  returns a `DRAFT` checkpoint object; nothing in the codebase lets an AI
  response directly flip an `AttendanceRecord.state` or resolve an
  integrity alert. Only `/api/sessions/[id]/end` (deterministic code) and
  `/api/alerts` (human review action) touch that field.

## Known gaps to close before a real pilot

- Forced password rotation on first login for admin-created accounts.
- Redis-backed rate limiting before running more than one app instance.
- CSRF: `sameSite=lax` cookies cover the common case; add an explicit
  double-submit or origin-check for state-changing routes if you ever put
  this behind a reverse proxy that strips `sameSite` or if you add any
  cross-origin embed.
- Structured logging / alerting on `SystemEvent` CRITICAL rows — right now
  they just sit in the table for the engineer dashboard to poll.
