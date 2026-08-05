---
id: IDEA-129
title: Isolate the StatusBar — store-free core, ready for a second mount
type: refactor
status: done
created: 2026-08-05
updated: 2026-08-05
tags:
  - app
  - integration
subject: In-app dev toolbar
---

Prerequisite for the in-app dev toolbar ([[IDEA-128]]): the desk's StatusBar (`src/app/components/shell/status-bar.tsx`) is welded to the desk — paper-ui components, `useAppStore` selectors, desk-local styling. To mount it inside a target application it needs a clean seam: a presentation core that doesn't know about the desk, fed by a thin client over the server API.

Isolation is worth doing even before the toolbar ships: it makes the StatusBar testable on its own and forces the "what data does ambient status actually need" question into one typed interface.

## StatusBar dependency inventory

Everything `status-bar.tsx` touches today, and where it lands once the core is extracted.

**paper-ui imports** — presentational, no store coupling → all move into the core:
- `Button`, `Spinner`, `Stamp`, `Tooltip`, `getTextureStyles` — rendering only, core keeps using them.
- `useToast` — requires a `ToastProvider` in the tree, which an embedded (shadow-DOM) mount can't assume exists. Stays desk-side: the core never calls it directly, callers surface toasts from action-callback results.

**Desk-local imports, non-store** → decided per item:
- `CommitIcon`, `MergeIcon`, `PullIcon`, `PushIcon` (`../icons`) — plain SVGs, no desk coupling → move into the core.
- `useNavigate` (`@tanstack/react-router`) — desk's router → becomes a prop (`onOpenSetup: () => void`), core stays router-agnostic.
- `useBranchSync` (`src/app/hooks/use-branch-sync.tsx`) — wraps `useAppStore` (`activeGitAction`, `loadGitStatus`, `loadPlans`, `loadIdeas`), git-api calls, and paper-ui `Button`/`useToast` for conflict-resolution toasts → stays desk-side entirely. The core receives its output shape (`pushing`, `syncing`, `pulling`, `gitActionBusy`, `handlePush`, `handleSync`, `handlePull`) as props; the desk mount keeps wiring the real hook, the thin client (phase 3) will supply an equivalent for the second mount.

**`useAppStore` selectors read directly in `status-bar.tsx`** → all become props, none survive into the core:
- `agentStatus` (used only to derive `agentActive` + the running task's status label) → props `agentActive: boolean`, `activeTaskStatus?: AgentTaskState['status']`.
- `gitStatus` (used only for `.length`) → prop `changedFileCount: number`.
- `gitBranch` → prop `gitBranch: string | null`.
- `gitAhead` → prop `gitAhead: number`.
- `gitBranchHygiene` → prop `gitBranchHygiene: BranchHygieneStatus | null` (drives the Sync tooltip/disabled state).
- `quickCommit` → prop `onQuickCommit: () => Promise<QuickCommitResult>`; the core renders/disables the button and awaits the call, the caller (desk store today, thin client later) owns the API work and any toast.
- `commitInFlight` → prop `commitInFlight: boolean`.
- `selectCapabilityGapCount` (→ `capabilities`) → prop `capabilityGapCount: number`.
- `selectAgentNotSignedIn` (→ `agentAuthStatus`) → prop `agentNotSignedIn: boolean`.

**API calls involved (all indirect, via the store/`useBranchSync`)** — none called by the core itself; all stay behind the injected callbacks/props:
- `fetchGitStatus`, `pushChanges`, `syncToMain`, `pullFromOrigin`, `resolveConflict` (`git-api`, via `useBranchSync`).
- `suggestCommitMessage`, `commitChanges` (`git-api`, via `quickCommit`).
- `loadPlans`, `loadIdeas` (store actions, via `useBranchSync`'s post-sync/pull refresh — desk-side bookkeeping unrelated to the bar's own display).

Net shape of the extracted core: a presentation component taking the thirteen data props above plus four action callbacks (`onSync`, `onPush`, `onPull`, `onQuickCommit`) and one navigation callback (`onOpenSetup`) — zero imports from `@/app/stores` or `@/app/hooks`.

### Phases
- [x] Inventory the StatusBar's dependencies
      List every paper-ui import, `useAppStore` selector, and API call it leans on; decide per item whether it moves into the core, becomes a prop, or stays desk-side.
- [x] Extract a store-free StatusBar core
      Presentation component taking data + action callbacks as a typed interface — no `useAppStore`, no desk imports.
- [x] Build the thin status client over the server API
      The segments' data (agent status, git state, setup gaps) fetched/streamed from the existing endpoints, usable outside the desk process.
- [x] Re-mount the desk shell on the extracted core
      Desk wires the core to the store exactly as today — behaviour and visual parity, no regressions.
- [x] Make the core embeddable
      Shadow-DOM-safe styling (no reliance on the desk's global CSS) and a package boundary the vite plugin ([[IDEA-128]]) can import.
- [x] Type-check and test the seam
      Cover the core with props-level tests; `tsc` and lint clean.
