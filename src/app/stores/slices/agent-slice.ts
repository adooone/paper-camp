import { fetchAgentAuthStatus } from '@/app/services/system';
import type {
  AgentAuthStatus,
  AgentTaskState,
  CheckName,
  LoginRelayState,
  PlanEntry,
} from '@/types/index';
import {
  cancelLoginRelay as cancelLoginRelayApi,
  fetchAgentStatus,
  fetchLoginRelayStatus,
  fetchReconcileQueue,
  launchAgent as launchAgentApi,
  launchBatchDraft as launchBatchDraftApi,
  launchBatchReconcile as launchBatchReconcileApi,
  launchFixReview as launchFixReviewApi,
  launchIdeaExtend as launchIdeaExtendApi,
  launchPlanAudit as launchPlanAuditApi,
  launchPlanDraft as launchPlanDraftApi,
  launchPlanReconcile as launchPlanReconcileApi,
  launchRunAll as launchRunAllApi,
  launchSuggestIdeas as launchSuggestIdeasApi,
  startLoginRelay as startLoginRelayApi,
  stopAgent as stopAgentApi,
} from '../../services/agent-api';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice, withAgentPoll } from './slice-helpers';

export interface ReconcilePreview {
  planId: string;
  before: { body: string; phases: PlanEntry['phases'] };
}

// A queued preview carries its own id: two reconciles can run against the same
// entity, and keying removal on planId alone would dismiss both at once.
export interface QueuedReconcile extends ReconcilePreview {
  previewId: string;
}

let previewCounter = 0;
const nextPreviewId = () => `preview-${++previewCounter}`;

export type AgentSlice = {
  // null until loaded or when the agent has no auth-status probe; loggedIn:null means unknown.
  agentAuthStatus: AgentAuthStatus | null;
  loadAgentAuthStatus: () => Promise<void>;

  agentStatus: AgentTaskState[];
  loadAgentStatus: () => Promise<void>;
  launchAgent: (planId: string, phaseIndex: number) => Promise<void>;
  launchPlanAudit: (planId: string, prompt: string) => Promise<void>;
  launchPlanReconcile: (
    planId: string,
    prompt: string,
    before: ReconcilePreview['before'],
  ) => Promise<void>;
  launchPlanDraft: (ideaId: string, prompt: string) => Promise<void>;
  launchIdeaExtend: (ideaId: string, prompt: string) => Promise<void>;
  launchBatchReconcile: () => Promise<void>;
  launchBatchDraft: (ids: string[]) => Promise<void>;
  launchSuggestIdeas: (prompt: string) => Promise<void>;
  launchRunAll: (planId: string) => Promise<void>;
  launchFixReview: (planId: string) => Promise<void>;
  stopAgent: (taskId?: string) => Promise<void>;

  // null when no relay has been started this session, or once it's cancelled/consumed.
  loginRelay: LoginRelayState | null;
  startLoginRelay: () => Promise<void>;
  loadLoginRelayStatus: () => Promise<void>;
  cancelLoginRelay: () => Promise<void>;

  // At store level (not the button) so loadAgentStatus still handles completion if the
  // user navigates away mid-run.
  pendingReconcile: ReconcilePreview | null;
  reconcileQueue: QueuedReconcile[];
  removeFromReconcileQueue: (previewId: string) => void;
  // Guards loadAgentStatus against re-appending the same batch sweep on every poll.
  batchReconcileConsumed: boolean;
};

export function createAgentSlice(set: SetState, get: GetState): AgentSlice {
  return {
    agentAuthStatus: null,
    loadAgentAuthStatus: loadSlice(
      set,
      fetchAgentAuthStatus,
      (data) => ({ agentAuthStatus: data }),
      () => ({ agentAuthStatus: null }),
    ),

    agentStatus: [],
    loadAgentStatus: async () => {
      try {
        const data = await fetchAgentStatus();
        const prev = get().agentStatus;
        set({ agentStatus: data });

        const completedRun = data.find((t) => {
          if (t.status !== 'done') return false;
          if (t.taskKind !== 'run-all' && t.taskKind !== 'phase') return false;
          const before = prev.find((p) => p.id === t.id);
          if (!before || before.status === 'done' || before.status === 'error') return false;
          if (t.taskKind === 'phase') {
            const plan = get().plans?.entries.find((p) => p.id === t.planId);
            if (!plan || t.phaseIndex !== plan.phases.length - 1) return false;
          }
          return true;
        });
        if (completedRun) {
          const { runCheck } = get();
          for (const name of ['lint', 'format', 'test', 'consistency'] as CheckName[]) {
            runCheck(name);
          }
        }

        const pending = get().pendingReconcile;
        const reconcileTask = pending
          ? data.find((t) => t.taskKind === 'reconcile' && t.planId === pending.planId)
          : undefined;
        if (pending && reconcileTask) {
          if (reconcileTask.status === 'done') {
            // loadPlans first: if it throws, pendingReconcile stays set and retries.
            await get().loadPlans();
            set((s) => ({
              reconcileQueue: [...s.reconcileQueue, { ...pending, previewId: nextPreviewId() }],
              pendingReconcile: null,
            }));
          } else if (reconcileTask.status === 'error') {
            set({ pendingReconcile: null });
          }
        }

        const batchTask = data.find(
          (t) => t.taskKind === 'batch-reconcile' || t.taskKind === 'batch-draft',
        );
        const batchTerminal =
          batchTask?.taskKind === 'batch-draft'
            ? batchTask.status === 'done' || batchTask.status === 'error'
            : batchTask?.status === 'done';
        if (batchTask && batchTerminal && !get().batchReconcileConsumed) {
          if (batchTask.taskKind === 'batch-reconcile') {
            const results = await fetchReconcileQueue();
            if (results && results.length > 0) {
              await get().loadPlans();
              set((s) => ({
                reconcileQueue: [
                  ...s.reconcileQueue,
                  ...results.map((r) => ({
                    planId: r.planId,
                    before: r.before,
                    previewId: nextPreviewId(),
                  })),
                ],
              }));
            }
          } else {
            await get().loadPlans();
          }
          // Set only after the fetch+append succeeds, so a throw here leaves it false and retries.
          set({ batchReconcileConsumed: true });
        }
      } catch {}
    },
    launchAgent: withAgentPoll(get, launchAgentApi),
    launchPlanAudit: withAgentPoll(get, launchPlanAuditApi),
    launchPlanReconcile: async (planId, prompt, before) => {
      // Refuse rather than overwrite: clearing an existing pendingReconcile on a second
      // launch would strip its diff safety net, and a same-plan relaunch is reachable
      // (navigate away mid-reconcile and back resets ReconcileButton's local flag).
      const existing = get().pendingReconcile;
      if (existing) {
        throw new Error(
          existing.planId === planId
            ? 'A reconcile is already in progress for this plan'
            : 'A reconcile is already in progress for another plan',
        );
      }
      // An unreviewed preview for this entity blocks a relaunch: a second preview's
      // `before` is the state *after* the first rewrite, so discarding them out of
      // order would reinstate a rewrite the user already rejected.
      if (get().reconcileQueue.some((item) => item.planId === planId)) {
        throw new Error('Review the pending reconcile for this plan first');
      }
      set({ pendingReconcile: { planId, before } });
      try {
        await launchPlanReconcileApi(planId, prompt);
      } catch (err) {
        set({ pendingReconcile: null });
        throw err;
      }
      await get().loadAgentStatus();
    },
    launchPlanDraft: withAgentPoll(get, launchPlanDraftApi),
    launchIdeaExtend: withAgentPoll(get, launchIdeaExtendApi),
    launchBatchReconcile: withAgentPoll(get, async () => {
      // Reset here, not by polling for a non-'done' status — a fast poll can miss it.
      set({ batchReconcileConsumed: false });
      await launchBatchReconcileApi();
    }),
    launchBatchDraft: withAgentPoll(get, async (ids: string[]) => {
      // Reset here, not by polling for a non-'done' status — a fast poll can miss it.
      set({ batchReconcileConsumed: false });
      await launchBatchDraftApi(ids);
    }),
    launchSuggestIdeas: withAgentPoll(get, launchSuggestIdeasApi),
    launchRunAll: withAgentPoll(get, launchRunAllApi),
    launchFixReview: withAgentPoll(get, launchFixReviewApi),
    stopAgent: async (taskId) => {
      try {
        await stopAgentApi(taskId);
      } finally {
        await get().loadAgentStatus();
      }
    },

    loginRelay: null,
    startLoginRelay: async () => {
      try {
        const state = await startLoginRelayApi();
        set({ loginRelay: state });
      } catch (err) {
        set({
          loginRelay: { phase: 'error', authorizeUrl: null, error: (err as Error).message },
        });
      }
    },
    loadLoginRelayStatus: loadSlice(set, fetchLoginRelayStatus, (data) => ({ loginRelay: data })),
    cancelLoginRelay: async () => {
      try {
        await cancelLoginRelayApi();
      } finally {
        set({ loginRelay: null });
      }
    },

    pendingReconcile: null,
    reconcileQueue: [],
    removeFromReconcileQueue: (previewId) =>
      set((s) => ({
        reconcileQueue: s.reconcileQueue.filter((item) => item.previewId !== previewId),
      })),
    batchReconcileConsumed: false,
  };
}
