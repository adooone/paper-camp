# Batch run API

The contract `paper-camp-mobile` (IDEA-321, `needs: paper-camp/IDEA-321`) builds its queue
screens against. Every route is served by a mounted project's own API — `/api/batch/*` — except
`POST /api/machine/batch`, served at the daemon root for a run spanning several projects.

## Per-project routes

**`GET /api/batch/preview`**
The run order (`run-order.md`) with a readiness verdict per idea, so the sheet can show which
rows are ready to tick.

```ts
{
  order: Array<{
    id: string
    title: string
    readiness: { ready: true } | { ready: false; reason: BatchReadinessReason; message: string }
    phaseCount: number           // unchecked phases + Fixes, manual steps excluded
    costEstimateUsd: number | null
  }>
  readyCount: number
  backlog: Array<{ id: string; title: string; hasPhases: boolean }>  // derived status `idea`, oldest first
  costEstimate: { perPhaseUsd: number | null }
  capacity: CapacityRecord | null   // ~/.config/paper-camp/capacity.json (src/core/capacity.ts)
  git: { level: 'clean' | 'behind' | 'diverged' | 'dirty'; behind: number; diverged: boolean; dirty: boolean }
}
```

`BatchReadinessReason` is `'needs' | 'manual-only' | 'open-question' | 'stale-base' | 'no-agent'`
(`src/core/batch-readiness.ts`) — the `message` is the one line to show next to a greyed row.

`backlog` lists ideas that aren't in the queue yet. One with `hasPhases: false` needs a plan:
draft it with `POST /api/agent/launch-draft-all` (`{ ids }`). One with `hasPhases: true` has a
stored `status: idea` the derivation couldn't promote, so `PATCH /api/entities?id=…` with
`{ status: 'planned' }` puts it in the queue.

**`GET /api/batch/status`**
The live batch, if one is running, paused or interrupted on this project.

```ts
{
  batch: BatchRunState | null
  task: AgentTaskState | null      // the batch-run task itself
  ideaTask: AgentTaskState | null  // the currently running idea's run-all task, if any
}
```

**`POST /api/batch/start`** — `{ ids: string[], rules?: Partial<BatchRunRules> }`
Starts a batch over the given ids, in run order. `202 { ok: true }`, or `409 { error }` if a
batch (or any other exclusive task) is already running on this project.

**`POST /api/batch/control`** — `{ action: 'stop' | 'stop-after-phase' | 'stop-after-idea' | 'skip' }`
Steers the running batch. `202 { ok: true }`, or `409 { error }` if none is running.

**`POST /api/batch/resume`** — no body.
Resumes a `paused` or `interrupted` batch. `202 { ok: true }`, or `409 { error }`.

**`POST /api/batch/end`** — no body.
Drops a `paused` or `interrupted` batch's state for good, without running it further — the
*End batch* action. `200 { ok: true }`, or `409 { error }`.

### `BatchRunRules` (`src/core/batch-run.ts`)

```ts
{
  pickupUnblocked: boolean        // add a newly-unblocked idea mid-run; default true
  ceiling?: number                // 5h utilisation %; defaults to the night setting
  floor?: number                  // 7d utilisation %; defaults to the night setting
  onCeiling: 'wait' | 'stop'      // default 'wait'
  stopAtMs?: number               // stop before the next idea once past this epoch ms
  maxIdeas?: number
  maxCostUsd?: number
  branchPerIdea?: boolean         // cut idea/IDEA-N per idea instead of committing to main
}
```

### `BatchRunState` (`src/core/batch-run.ts`) — the task shape

```ts
{
  taskId: string
  startedAt: string               // ISO
  updatedAt: string                // ISO
  rules: BatchRunRules
  toleratedRed: CheckName[]       // the checks baseline taken at batch start
  initialIds: string[]            // ids ticked when the batch was started, in run order
  items: BatchRunItem[]
  ideasRun: number
  costUsd: number
  status: 'running' | 'paused' | 'done' | 'interrupted'
  pause?: BatchRunPauseReason
}

// BatchRunItem
{
  id: string
  title: string
  outcome: 'queued' | 'running' | 'review' | 'needs-you' | 'needs-human'
          | 'failed-clean' | 'failed-dirty' | 'red-checks' | 'auth' | 'conflict'
          | 'skipped' | 'stopped'
  reason?: string
  taskId?: string                 // the idea's own run-all task id, once started
}

// BatchRunPauseReason
  | { kind: 'capacity-ceiling'; resetsAt?: number }
  | { kind: 'capacity-floor' }
  | { kind: 'failed-dirty'; id: string }
  | { kind: 'red-checks'; id: string }
  | { kind: 'auth'; id: string }
  | { kind: 'conflict'; id: string; conflictPrompt: string }
```

A `paused` batch has no live task for `/api/batch/control`'s stop/skip actions to target — use
`/api/batch/resume` or `/api/batch/end` instead. An `interrupted` one is the same: a daemon
restart mid-batch, offering only *Resume* or *End*.

## Machine-wide route

**`POST /api/machine/batch`** — served at the daemon root, not under `/p/<slug>`.

```ts
// request
{ slugs: string[], rules?: Partial<BatchRunRules> }

// response
{ ok: boolean, error?: string }
```

Runs every listed project's own ready queue — every idea `batchReadiness` already marks
`ready`, in that project's run order, with no per-run ticks — one project at a time. A project
that fails to mount, or has nothing ready, is skipped; the rest still run. A project whose batch
pauses (needs a human) doesn't block the others — the machine moves on to the next slug, and the
paused project's queue waits for *Resume* from either client.

This route is mutating, so unlike the read-only `/api/machine/projects` and `/api/machine/night`,
it is pairing-gated the same way a mounted project's own routes are (`isForbiddenRequest`) —
send the `x-pairing-token` header with the token this machine handed back the first time a
project on it was opened (`POST /api/pair`), not the token of whatever project is open on the
calling device right now.

## Notifications and push

A batch pausing or finishing appends to `papercamp/.local/notifications.log` and — if the
setting is on — fans out a push the same way any other notification does
(`src/app/server/notification-log.ts`, `src/core/push-send.ts`). Two kinds exist only for a
batch, both on by default (`src/types/index.ts`):

- `'batch-paused'` — `entityId` is the batch task's id, `entityTitle` is `'Run queue'`, `text`
  is the one-line pause reason (e.g. `"IDEA-298 needs you signed back in"`).
- `'batch-finished'` — same `entityId`/`entityTitle`, `text` is the queue-complete summary line
  (e.g. `"queue complete — 3 idea(s) run"`).

The push payload (`PushPayload`, `src/core/push-send.ts`) is `{ id, kind, entityId, entityTitle,
text }` — register a device for it with `POST /api/push/subscribe` and fetch the VAPID public
key from `GET /api/push/public-key`, both already documented by their own route handlers
(`src/app/server/routes/push.ts`).

## What the mobile UI is expected to build on this

- **Ideas tab:** `GET /api/batch/preview` for the *Run queue (N)* button and the sheet's rows;
  `POST /api/batch/start` on confirm.
- **Live card and sheet:** `GET /api/batch/status` (poll, same cadence as `/api/agent/status`),
  the four stop controls through `/api/batch/control`, recovery actions through
  `/api/batch/resume`/`/api/batch/end` plus the existing resolve-conflict and sign-in flows for
  `conflict`/`auth` pauses.
- **Projects tab:** `POST /api/machine/batch` for *Run all queues*, ordering the `slugs` array
  as the user ordered the projects.
- **Push:** the two kinds above drive the *Queue paused*/*Queue finished* notifications; tapping
  one opens the live sheet (pause) or the Activity/Log entry (finish).
