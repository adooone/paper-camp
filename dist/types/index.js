const e = [
  "idea",
  "planned",
  "in-progress",
  "review",
  "done",
  "dropped"
], o = ["feat", "fix", "chore", "docs", "refactor"], d = ["claude-code", "opencode"], c = {
  "claude-code": "Claude Code",
  opencode: "OpenCode"
}, n = {
  phase: "opencode",
  planDraft: "claude-code",
  ideaExtend: "claude-code"
};
export {
  d as AGENT_IDS,
  c as AGENT_LABELS,
  n as DEFAULT_AGENTS,
  o as PLAN_KINDS,
  e as PLAN_STATUSES
};
//# sourceMappingURL=index.js.map
