#!/usr/bin/env node
import { join as O, dirname as ct, extname as dt, basename as pt, resolve as Y } from "node:path";
import { Command as ut } from "commander";
import { t as nt, r as z, m as Q, s as k, q as M, j as Z, c as at, i as it, w as B, a as ot, n as V, b as lt, f as ft, P as gt, l as mt, A as yt } from "../chunks/serializer.D1Ts_p8h.js";
import { DEFAULT_AGENTS as X, PLAN_KINDS as F, AGENT_IDS as U } from "../types/index.js";
import { readFile as $, writeFile as I, mkdir as ht, stat as st } from "node:fs/promises";
import { createServer as Ct } from "node:http";
import { fileURLToPath as wt } from "node:url";
import { watch as G, readFileSync as St } from "node:fs";
import { spawn as K, spawnSync as L } from "node:child_process";
import { createInterface as Tt } from "node:readline";
const E = (n, c) => O(n, "papercamp", c), _ = (n) => $(n, "utf-8").catch(() => "");
async function q(n) {
  const [c, o, s, u] = await Promise.all([
    _(E(n, "plans.md")),
    _(E(n, "decisions.md")),
    _(E(n, "open-questions.md")),
    _(E(n, "progress.md"))
  ]);
  return {
    plans: k(c).entries,
    decisions: Q(o).entries,
    openQuestions: z(s).entries,
    progress: nt(u)
  };
}
function Nt(n, c) {
  const o = [], s = (/* @__PURE__ */ new Date()).toISOString(), u = new Map(n.plans.map((e) => [e.title, e])), y = new Map(c.plans.map((e) => [e.title, e]));
  for (const [e, d] of y) {
    const f = u.get(e);
    if (!f)
      o.push({ message: `New plan added: ${e}`, timestamp: s });
    else if (f.status !== d.status)
      o.push({ message: `Plan "${e}" marked ${d.status}`, timestamp: s });
    else
      for (let p = 0; p < d.phases.length; p++) {
        const l = f.phases[p], m = d.phases[p];
        l && l.done !== m.done && o.push({
          message: m.done ? `Phase ${p + 1}/${d.phases.length} checked off in "${e}"` : `Phase ${p + 1}/${d.phases.length} unchecked in "${e}"`,
          timestamp: s
        });
      }
  }
  for (const [e] of u)
    y.has(e) || o.push({ message: `Plan removed: ${e}`, timestamp: s });
  const r = new Map(n.decisions.map((e) => [e.title, e])), t = new Map(c.decisions.map((e) => [e.title, e]));
  for (const [e] of t)
    r.has(e) || o.push({ message: `New decision: ${e}`, timestamp: s });
  const b = new Map(n.openQuestions.map((e) => [e.title, e])), C = new Map(c.openQuestions.map((e) => [e.title, e]));
  for (const [e] of C)
    b.has(e) || o.push({ message: `New open question: ${e}`, timestamp: s });
  const S = new Map(n.progress.map((e) => [e.date, e])), i = new Map(c.progress.map((e) => [e.date, e]));
  for (const [e] of i)
    S.has(e) || o.push({ message: `Progress logged: ${e}`, timestamp: s });
  return o;
}
function Ot(n) {
  const c = /* @__PURE__ */ new Set();
  let o = null, s = null;
  const u = ["plans.md", "decisions.md", "open-questions.md", "progress.md"];
  async function y() {
    try {
      const r = await q(n);
      if (o) {
        const t = Nt(o, r);
        for (const b of t) {
          const C = `data: ${JSON.stringify(b)}

`;
          for (const S of c)
            try {
              S.write(C);
            } catch {
              c.delete(S);
            }
        }
      }
      o = r;
    } catch {
    }
  }
  for (const r of u) {
    const t = E(n, r);
    try {
      G(t, () => {
        s && clearTimeout(s), s = setTimeout(y, 300);
      });
    } catch {
    }
  }
  return q(n).then((r) => {
    o = r;
  }), {
    subscribe(r) {
      c.add(r);
      const t = JSON.stringify({
        message: "Watching for changes…",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      r.write(`data: ${t}

`), r.on("close", () => c.delete(r));
    }
  };
}
function jt(n) {
  return ["-p", n, "--output-format", "stream-json", "--verbose", "--permission-mode", "auto"];
}
function bt(n) {
  let c;
  try {
    c = JSON.parse(n);
  } catch {
    return null;
  }
  switch (c.type) {
    case "system":
      return c.subtype === "init" ? { text: "Agent session started" } : c.subtype === "post_turn_summary" && typeof c.status_detail == "string" ? { text: c.status_detail } : null;
    case "rate_limit_event":
      return null;
    case "assistant": {
      const o = c.message, s = (o == null ? void 0 : o.content) ?? [];
      for (const u of s) {
        const y = u;
        if (y.type === "tool_use")
          return { text: `Running ${y.name ?? "a tool"}…` };
        if (y.type === "text" && typeof y.text == "string" && y.text.trim())
          return { text: y.text.trim() };
      }
      return null;
    }
    case "user": {
      const o = c.message, s = o == null ? void 0 : o.content, u = Array.isArray(s) ? s[0] : void 0;
      return u != null && u.is_error ? { text: `Error: ${typeof u.content == "string" ? u.content : "Tool call failed"}`, error: !0 } : { text: "Tool finished" };
    }
    case "result": {
      const o = !!c.is_error;
      return { text: (typeof c.result == "string" ? c.result.trim() : "") || (o ? "Agent run failed" : "Agent run finished"), done: !0, error: o };
    }
    default:
      return { text: "Agent is working…" };
  }
}
function Jt(n) {
  return ["run", n, "--format", "json"];
}
const vt = {
  bash: "Running command",
  read: "Reading file",
  edit: "Editing file",
  write: "Writing file",
  glob: "Searching files",
  grep: "Searching code",
  websearch: "Searching web",
  webfetch: "Fetching URL",
  question: "Asking for input"
};
function Ht(n) {
  let c;
  try {
    c = JSON.parse(n);
  } catch {
    return null;
  }
  const o = c.type, s = c.part;
  if (!o || !s) return null;
  switch (o) {
    case "step_start":
      return null;
    case "text": {
      const u = s.text;
      return u != null && u.trim() ? { text: u.trim() } : null;
    }
    case "tool_use": {
      const u = s.tool, y = s.state ? s.state.input : void 0, r = y ? y.description : void 0, t = u ? vt[u] : "Running tool", b = typeof r == "string" && r.trim() ? `: ${r.trim()}` : "";
      return u ? { text: `${t}${b}…` } : null;
    }
    case "step_finish": {
      const u = s.reason, y = u === "tool-calls" ? null : u === "stop" ? "Done" : "Step finished";
      return y ? { text: y } : null;
    }
    default:
      return null;
  }
}
const tt = "claude-code", P = {
  "claude-code": {
    command: "claude",
    buildArgs: jt,
    parseLine: bt
  },
  opencode: {
    command: "opencode",
    buildArgs: Jt,
    parseLine: Ht
  }
}, xt = {
  phase: "phase",
  audit: "phase",
  draft: "planDraft",
  extend: "ideaExtend"
};
function kt(n) {
  const { agentId: c, defaultAgents: o, taskKind: s } = n;
  if (c && c in P) return { id: c, adapter: P[c] };
  if (s && o) {
    const u = xt[s], y = o[u];
    if (y && y in P) return { id: y, adapter: P[y] };
  }
  return { id: tt, adapter: P[tt] };
}
const $t = 50;
function It(n) {
  try {
    const c = St(O(n, ".paper-camp", "config.json"), "utf-8"), o = JSON.parse(c);
    return o.defaultAgents ? o.defaultAgents : o.defaultAgent ? {
      phase: o.defaultAgent,
      planDraft: o.defaultAgent,
      ideaExtend: o.defaultAgent
    } : X;
  } catch {
    return X;
  }
}
function Pt(n, c, o) {
  return `You're working on phase ${o + 1} ("${c.text}") of the plan "${n.title}" (${n.id ?? "no id"}) in papercamp/plans.md.

${c.description ?? ""}

Plan context: ${n.body}

Do only this phase. When done, check it off in plans.md (- [ ] -> - [x]) and append what you did to progress.md. If this was the last unchecked phase, set the plan's Status to \`review\`, not \`done\`, per this repo's AGENTS.md.`;
}
function At(n, c = () => {
}) {
  const o = /* @__PURE__ */ new Set();
  let s = null;
  function u(a) {
    const g = `data: ${JSON.stringify({ message: a, timestamp: (/* @__PURE__ */ new Date()).toISOString(), type: "agent" })}

`;
    for (const w of o)
      try {
        w.write(g);
      } catch {
        o.delete(w);
      }
  }
  function y(a, g) {
    a.lines.push(g), a.lines.length > $t && a.lines.shift(), u(g);
  }
  function r(a, g) {
    a.status = g, u(`agent: ${g}`);
  }
  async function t(a) {
    var g, w;
    try {
      if (a.taskKind === "extend") {
        const x = await $(O(n, "papercamp", "ideas.md"), "utf-8"), W = M(x).find((rt) => rt.id === a.ideaId);
        return !W || a.ideaBodyBaseline === void 0 ? null : W.body !== a.ideaBodyBaseline;
      }
      const T = await $(O(n, "papercamp", "plans.md"), "utf-8"), { entries: j } = k(T);
      if (a.ideaId !== void 0)
        return j.some((x) => x.idea === a.ideaId);
      const v = j.find((x) => x.id === a.planId) ?? j.find((x) => x.title === a.planTitle);
      return v ? a.phaseIndex !== void 0 ? ((g = v.phases[a.phaseIndex]) == null ? void 0 : g.done) ?? null : a.planBaseline ? v.phases.length > a.planBaseline.phases || (((w = v.log) == null ? void 0 : w.length) ?? 0) > a.planBaseline.log : null : null;
    } catch {
      return null;
    }
  }
  function b(a, g) {
    r(a, g ? "error" : "done"), !g && t(a).then((w) => {
      if (s === a && w === !1) {
        const T = a.taskKind === "extend" ? `Warning: agent finished but the idea body for ${a.ideaId} did not change — verify manually` : a.ideaId !== void 0 ? `Warning: agent finished but no plan linking idea: ${a.ideaId} appeared in plans.md — verify manually` : a.phaseIndex !== void 0 ? "Warning: agent finished but did not check off this phase in plans.md — verify manually" : "Warning: agent finished but appended nothing to Phases or Log — verify manually";
        y(a, T);
      }
    });
  }
  function C(a) {
    if (!a.proc.stdout) return;
    Tt({ input: a.proc.stdout }).on("line", (w) => {
      if (s !== a || !w.trim()) return;
      const T = a.adapter.parseLine(w);
      T && (y(a, T.text), T.done && b(a, !!T.error));
    }), a.proc.on("close", (w) => {
      s === a && (a.status === "starting" || a.status === "running" ? b(a, w !== 0) : a.status === "stopping" && r(a, "done"));
    }), a.proc.on("error", (w) => {
      s === a && (y(a, `Failed to spawn agent: ${w.message}`), r(a, "error"));
    });
  }
  function S(a, g) {
    return K(a.command, g, {
      cwd: n,
      stdio: ["ignore", "pipe", "pipe"]
    });
  }
  function i() {
    return s !== null && s.status !== "done" && s.status !== "error";
  }
  function e(a, g, w) {
    if (i())
      return { ok: !1, error: "An agent task is already running" };
    const T = It(n), { id: j, adapter: v } = kt({
      agentId: a.agentOverride,
      defaultAgents: T,
      taskKind: w.taskKind
    }), x = S(v, v.buildArgs(g)), R = {
      planTitle: a.planTitle,
      planId: a.planId,
      status: "starting",
      agentId: j,
      adapter: v,
      proc: x,
      lines: [],
      ...w
    };
    return s = R, C(R), r(R, "running"), { ok: !0 };
  }
  function d(a, g) {
    if (i())
      return { ok: !1, error: "An agent task is already running" };
    const w = a.phases[g];
    if (!w)
      return { ok: !1, error: "Phase not found" };
    c(a);
    const T = Pt(a, w, g);
    return e({ planTitle: a.title, planId: a.id, agentOverride: a.agent }, T, {
      taskKind: "phase",
      phaseIndex: g
    });
  }
  function f(a, g) {
    var w;
    return e({ planTitle: a.title, planId: a.id, agentOverride: a.agent }, g, {
      taskKind: "audit",
      planBaseline: { phases: a.phases.length, log: ((w = a.log) == null ? void 0 : w.length) ?? 0 }
    });
  }
  function p(a, g) {
    return a.id ? e({ planTitle: `Draft plan for ${a.id}` }, g, {
      taskKind: "draft",
      ideaId: a.id
    }) : { ok: !1, error: "Idea has no id to link a drafted plan back to" };
  }
  function l(a, g) {
    return a.id ? e({ planTitle: `Extend ${a.id}` }, g, {
      taskKind: "extend",
      ideaId: a.id,
      ideaBodyBaseline: a.body
    }) : { ok: !1, error: "Idea has no id to extend" };
  }
  function m() {
    if (!s)
      return { ok: !1, error: "No agent task running" };
    const a = s;
    return r(a, "stopping"), a.proc.killed || a.proc.kill("SIGTERM"), setTimeout(() => {
      s === a && a.status === "stopping" && a.proc.kill("SIGKILL");
    }, 5e3), { ok: !0 };
  }
  function h() {
    return s ? {
      status: s.status,
      taskKind: s.taskKind,
      planTitle: s.planTitle,
      planId: s.planId,
      phaseIndex: s.phaseIndex,
      ideaId: s.ideaId,
      agentId: s.agentId,
      lines: [...s.lines]
    } : null;
  }
  return {
    start: d,
    startForPlan: f,
    startForIdea: p,
    startForIdeaExtend: l,
    stop: m,
    getStatus: h,
    subscribe(a) {
      o.add(a), a.on("close", () => o.delete(a));
    },
    killCurrent() {
      s != null && s.proc && !s.proc.killed && s.proc.kill();
    }
  };
}
function Et(n) {
  const c = /* @__PURE__ */ new Set();
  function o(p) {
    const l = `data: ${JSON.stringify(p)}

`;
    for (const m of c)
      try {
        m.write(l);
      } catch {
        c.delete(m);
      }
  }
  function s(p) {
    const l = [];
    for (const m of p.split(`
`)) {
      if (!m.trim()) continue;
      const h = m[0] ?? " ", a = m[1] ?? " ", g = m.slice(3), w = g.split(" -> ").pop() ?? g;
      l.push({
        path: w,
        status: `${h}${a}`,
        staged: h !== " " && h !== "?"
      });
    }
    return l;
  }
  function u(p) {
    return new Promise((l, m) => {
      var w, T;
      const h = K("git", p, {
        cwd: n,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let a = "", g = "";
      (w = h.stdout) == null || w.on("data", (j) => {
        a += j.toString();
      }), (T = h.stderr) == null || T.on("data", (j) => {
        g += j.toString();
      }), h.on("close", (j) => {
        j === 0 ? l(a) : m(new Error(g || `git ${p[0]} exited with code ${j}`));
      }), h.on("error", m);
    });
  }
  function y() {
    return u(["status", "--porcelain=v1"]).then(s);
  }
  async function r(p, l, m) {
    p.length > 0 && await u(["add", "--", ...p]);
    const h = ["commit", "-m", l];
    m && h.push("-m", m), await u(h);
  }
  function t(p) {
    if (!p.kind || !p.id) return;
    const l = p.kind.toLowerCase(), m = p.id.toLowerCase(), h = p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), a = `${l}/${m}-${h}`, g = L("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: n });
    if (g.status !== 0)
      throw new Error(
        g.stderr.toString().trim() || "Unable to read current git branch"
      );
    if (g.stdout.toString().trim() === a) return;
    const T = L("git", ["checkout", "-b", a, "main"], { cwd: n });
    if (T.status !== 0) {
      const j = L("git", ["checkout", a], { cwd: n });
      if (j.status !== 0)
        throw new Error(
          j.stderr.toString().trim() || T.stderr.toString().trim() || `Unable to check out ${a}`
        );
    }
  }
  async function b() {
    try {
      await y(), o({
        message: "Working tree status updated",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch {
    }
  }
  const C = O(n, ".git");
  let S = null;
  try {
    G(C, { recursive: !0 }, (p, l) => {
      l === "index" && (S && clearTimeout(S), S = setTimeout(b, 500));
    });
  } catch {
  }
  const i = O(n, "src");
  let e = null;
  try {
    G(i, { recursive: !0 }, () => {
      e && clearTimeout(e), e = setTimeout(b, 500);
    });
  } catch {
  }
  function d() {
    return L("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: n }).stdout.toString().trim();
  }
  function f() {
    const l = d().match(/^[a-z]+\/([a-z]+-\d+)-/);
    return l ? l[1].toUpperCase() : null;
  }
  return {
    async getStatus() {
      return y();
    },
    getCurrentBranch: d,
    commit: r,
    ensureBranch: t,
    getFeatureBranchPlanId: f,
    subscribe(p) {
      c.add(p), p.on("close", () => c.delete(p));
    }
  };
}
const Dt = {
  lint: "npx biome lint .",
  format: "npx biome format .",
  test: "npx vitest run"
};
function Rt(n) {
  const c = /* @__PURE__ */ new Set(), o = {
    lint: { status: "stale", lastRun: null, output: "" },
    format: { status: "stale", lastRun: null, output: "" },
    test: { status: "stale", lastRun: null, output: "" }
  }, s = /* @__PURE__ */ new Set(), u = /* @__PURE__ */ new Set();
  function y(i) {
    const e = `data: ${JSON.stringify(i)}

`;
    for (const d of c)
      try {
        d.write(e);
      } catch {
        c.delete(d);
      }
  }
  function r(i, e, d) {
    o[i] = { status: e, lastRun: (/* @__PURE__ */ new Date()).toISOString(), output: d }, y({
      message: `${i}: ${e}`,
      timestamp: o[i].lastRun
    }), e !== "running" && u.has(i) && (u.delete(i), t(i));
  }
  function t(i) {
    var l, m;
    if (s.has(i)) {
      u.add(i);
      return;
    }
    s.add(i), r(i, "running", "");
    const e = Dt[i], d = K(e, {
      cwd: n,
      stdio: ["ignore", "pipe", "pipe"],
      shell: !0
    });
    let f = "", p = "";
    (l = d.stdout) == null || l.on("data", (h) => {
      f += h.toString();
    }), (m = d.stderr) == null || m.on("data", (h) => {
      p += h.toString();
    }), d.on("close", (h) => {
      s.delete(i);
      const a = f + p;
      h === 0 ? r(i, "pass", a) : r(i, "fail", a);
    }), d.on("error", (h) => {
      s.delete(i), r(i, "fail", `Failed to spawn process: ${h.message}`);
    });
  }
  function b() {
    if (s.has("lint") || s.has("format")) return;
    r("lint", "running", "Applying automatic fixes…"), r("format", "running", "Applying automatic fixes…");
    const i = K("npx biome check . --write", {
      cwd: n,
      stdio: ["ignore", "pipe", "pipe"],
      shell: !0
    });
    i.on("close", () => {
      t("lint"), t("format");
    }), i.on("error", (e) => {
      const d = `Failed to spawn fix process: ${e.message}`;
      r("lint", "fail", d), r("format", "fail", d);
    });
  }
  const C = O(n, "src");
  let S = null;
  try {
    G(C, { recursive: !0 }, () => {
      S && clearTimeout(S), S = setTimeout(() => {
        t("lint"), t("format");
      }, 1e3);
    });
  } catch {
  }
  return {
    getStatus() {
      return {
        lint: { ...o.lint },
        format: { ...o.format },
        test: { ...o.test }
      };
    },
    runCheck: t,
    runQualityFix: b,
    subscribe(i) {
      c.add(i);
      for (const e of ["lint", "format", "test"]) {
        const d = o[e];
        d.status !== "stale" && i.write(
          `data: ${JSON.stringify({ message: `${e}: ${d.status}`, timestamp: d.lastRun })}

`
        );
      }
      i.on("close", () => c.delete(i));
    }
  };
}
async function N(n) {
  try {
    return await $(n, "utf-8");
  } catch (c) {
    if (c.code === "ENOENT") return "";
    throw c;
  }
}
async function et(n) {
  try {
    return await st(n), !0;
  } catch {
    return !1;
  }
}
async function H(n) {
  return new Promise((c, o) => {
    let s = "";
    n.on("data", (u) => {
      s += u;
    }), n.on("end", () => c(s)), n.on("error", o);
  });
}
const J = (n, c) => O(n, "papercamp", c), Lt = [
  "biome.json",
  "tsconfig.json",
  "tailwind.config.ts",
  "vite.config.ts",
  "vite.app.config.ts",
  "postcss.config.js",
  "package.json"
];
async function A(n, c, o) {
  const s = c.getFeatureBranchPlanId();
  if (!s || o && s === o) return null;
  const u = await N(J(n, "plans.md"));
  if (!u) return null;
  const { entries: y } = k(u), r = y.find((t) => t.id === s);
  return !r || r.status === "done" || r.status === "dropped" ? null : `Finish \`${s}\` — ${r.title} — before starting another plan`;
}
const _t = [
  {
    path: "/api/package-name",
    handler: async (n) => {
      const c = await N(O(n, "package.json"));
      if (!c) return null;
      try {
        return JSON.parse(c).name ?? null;
      } catch {
        return null;
      }
    }
  },
  {
    path: "/api/plans",
    handler: async (n) => k(await N(J(n, "plans.md")))
  },
  {
    path: "/api/progress",
    handler: async (n) => ({
      entries: nt(await N(J(n, "progress.md")))
    })
  },
  {
    path: "/api/decisions",
    handler: async (n) => Q(await N(J(n, "decisions.md")))
  },
  {
    path: "/api/open-questions",
    handler: async (n) => z(await N(J(n, "open-questions.md")))
  },
  {
    path: "/api/ideas",
    handler: async (n) => ({
      content: await N(J(n, "ideas.md"))
    })
  },
  {
    path: "/api/consistency",
    handler: async (n) => {
      const [c, o, s] = await Promise.all([
        N(J(n, "decisions.md")),
        N(J(n, "open-questions.md")),
        N(J(n, "plans.md"))
      ]), u = Q(c), y = z(o), r = k(s);
      return ft(u.entries, y.entries, r.entries);
    }
  },
  {
    path: "/api/config",
    handler: async (n) => {
      const c = await N(O(n, ".paper-camp", "config.json"));
      return c ? JSON.parse(c) : null;
    }
  },
  {
    path: "/api/docs",
    handler: async (n) => {
      const c = ["MAIN.md", "README.md", "CHANGELOG.md", "LICENSE"], o = [];
      for (const s of c) {
        const u = await N(O(n, s));
        u && o.push({ name: s, content: u });
      }
      return { files: o };
    }
  },
  {
    path: "/api/configs",
    handler: async (n) => {
      const c = [
        "biome.json",
        "tsconfig.json",
        "tailwind.config.ts",
        "vite.config.ts",
        "vite.app.config.ts",
        "postcss.config.js",
        "package.json"
      ], o = [];
      for (const s of c)
        await N(O(n, s)) && o.push(s);
      return { files: o };
    }
  }
];
function Mt(n) {
  const c = Ot(n), o = Et(n), s = Rt(n), u = At(n, (r) => o.ensureBranch(r)), y = async (r, t, b) => {
    const C = (r.url ?? "").split("?")[0];
    if (r.method === "DELETE" && C === "/api/plans") {
      try {
        const e = new URL(r.url ?? "", `http://${r.headers.host ?? "localhost"}`).searchParams.get("title");
        if (!(e != null && e.trim())) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "title is required" }));
          return;
        }
        const d = J(n, "plans.md"), f = k(await N(d)), p = e.trim(), l = f.entries.filter((m) => m.title !== p);
        if (l.length === f.entries.length) {
          t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "plan not found" }));
          return;
        }
        await I(d, Z(l)), t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "POST" && C === "/api/plans") {
      try {
        const i = await H(r), { title: e, content: d, kind: f } = JSON.parse(i);
        if (!(e != null && e.trim())) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "title is required" }));
          return;
        }
        const p = f && F.includes(f) ? f : "feat", l = O(n, ".paper-camp", "config.json"), m = await at(l, p), h = it({
          title: e.trim(),
          status: "idea",
          kind: p,
          id: m,
          created: B(),
          body: d == null ? void 0 : d.trim()
        });
        await ot(J(n, "plans.md"), h), t.statusCode = 201, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0, id: m }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "PATCH" && C === "/api/plans") {
      try {
        const e = new URL(r.url ?? "", `http://${r.headers.host ?? "localhost"}`).searchParams.get("title");
        if (!(e != null && e.trim())) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "title is required" }));
          return;
        }
        const d = await H(r), f = JSON.parse(d);
        if (f.agent && !U.includes(f.agent)) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "agent must be a known agent id" }));
          return;
        }
        const p = J(n, "plans.md"), l = k(await N(p)), m = e.trim();
        let h = !1;
        const a = l.entries.map((g) => g.title === m ? (h = !0, {
          ...g,
          ...f.status !== void 0 && { status: f.status },
          ...f.phases !== void 0 && { phases: f.phases },
          ...f.log !== void 0 && { log: f.log },
          ...f.agent !== void 0 && { agent: f.agent ?? void 0 },
          updated: B()
        }) : f.status === "in-progress" && g.status === "in-progress" ? { ...g, status: "planned", updated: B() } : g);
        if (!h) {
          t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "plan not found" }));
          return;
        }
        if (f.status === "done") {
          const g = l.entries.find((T) => T.title === m), w = await A(n, o, g == null ? void 0 : g.id);
          if (w) {
            t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: w }));
            return;
          }
        }
        if (await I(p, Z(a)), f.status === "done") {
          const g = a.find((w) => w.title === m);
          if (g)
            try {
              o.ensureBranch(g);
            } catch {
            }
        }
        t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "POST" && C === "/api/ideas") {
      try {
        const i = await H(r), { title: e, content: d } = JSON.parse(i);
        if (!(e != null && e.trim())) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "title is required" }));
          return;
        }
        const f = J(n, "ideas.md"), p = await N(f), h = `IDEA-${M(p).reduce((T, j) => {
          if (j.id) {
            const v = Number.parseInt(j.id.replace("IDEA-", ""), 10);
            return Number.isNaN(v) ? T : Math.max(T, v);
          }
          return T;
        }, 0) + 1}`, a = `### ${h}: ${e.trim()}

${(d == null ? void 0 : d.trim()) ?? ""}`, g = p.trimEnd(), w = g.length === 0 ? "" : `

---

`;
        await I(f, `${g}${w}${a}
`), t.statusCode = 201, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0, id: h }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "GET" && C === "/api/icon") {
      const i = O(n, ".paper-camp", "assets"), e = {
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp"
      };
      for (const [d, f] of Object.entries(e))
        try {
          const p = await $(O(i, `icon.${d}`));
          t.statusCode = 200, t.setHeader("Content-Type", f), t.setHeader("Cache-Control", "no-cache"), t.end(p);
          return;
        } catch {
        }
      t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "no icon uploaded" }));
      return;
    }
    if (r.method === "POST" && C === "/api/icon") {
      try {
        const i = await H(r), { dataUri: e } = JSON.parse(i);
        if (!e) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "dataUri is required" }));
          return;
        }
        const d = e.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/);
        if (!d) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "invalid data URI" }));
          return;
        }
        const f = d[1], p = f === "image/svg+xml" ? "svg" : f.split("/")[1], l = Buffer.from(d[2], "base64"), m = O(n, ".paper-camp", "assets");
        await ht(m, { recursive: !0 }), await I(O(m, `icon.${p}`), l), t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "GET" && C === "/api/git/status") {
      try {
        const i = await o.getStatus(), e = o.getCurrentBranch();
        t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ branch: e, entries: i }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "POST" && C === "/api/git/commit") {
      try {
        const i = await H(r), { files: e, title: d, message: f } = JSON.parse(i);
        if (!(d != null && d.trim())) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "title is required" }));
          return;
        }
        await o.commit(e ?? [], d.trim(), f == null ? void 0 : f.trim()), t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "GET" && C === "/api/status") {
      t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify(s.getStatus()));
      return;
    }
    if (r.method === "POST" && C === "/api/status/check") {
      const e = new URL(r.url ?? "", `http://${r.headers.host ?? "localhost"}`).searchParams.get("name");
      if (e !== "lint" && e !== "format" && e !== "test") {
        t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "name must be lint, format, or test" }));
        return;
      }
      s.runCheck(e), t.statusCode = 202, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      return;
    }
    if (r.method === "POST" && C === "/api/status/fix") {
      s.runQualityFix(), t.statusCode = 202, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      return;
    }
    if (r.method === "GET" && C === "/api/activity/stream") {
      t.statusCode = 200, t.setHeader("Content-Type", "text/event-stream"), t.setHeader("Cache-Control", "no-cache"), t.setHeader("Connection", "keep-alive"), t.flushHeaders(), c.subscribe(t), o.subscribe(t), s.subscribe(t), u.subscribe(t);
      return;
    }
    if (r.method === "GET" && C === "/api/agent/status") {
      t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify(u.getStatus()));
      return;
    }
    if (r.method === "POST" && C === "/api/agent/launch") {
      try {
        const i = await H(r), { planId: e, phaseIndex: d } = JSON.parse(i);
        if (!e || typeof d != "number") {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "planId and phaseIndex are required" }));
          return;
        }
        const p = k(await N(J(n, "plans.md"))).entries.find((h) => h.id === e);
        if (!p) {
          t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "plan not found" }));
          return;
        }
        const l = await A(n, o, p.id);
        if (l) {
          t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: l }));
          return;
        }
        const m = await u.start(p, d);
        if (!m.ok) {
          t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: m.error }));
          return;
        }
        t.statusCode = 202, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "POST" && C === "/api/agent/launch-audit") {
      try {
        const i = await H(r), { planId: e, prompt: d } = JSON.parse(i);
        if (!e || !d) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "planId and prompt are required" }));
          return;
        }
        const p = k(await N(J(n, "plans.md"))).entries.find((h) => h.id === e);
        if (!p) {
          t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "plan not found" }));
          return;
        }
        const l = await A(n, o, p.id);
        if (l) {
          t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: l }));
          return;
        }
        const m = u.startForPlan(p, d);
        if (!m.ok) {
          t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: m.error }));
          return;
        }
        t.statusCode = 202, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "POST" && C === "/api/agent/launch-draft") {
      try {
        const i = await H(r), { ideaId: e, prompt: d } = JSON.parse(i);
        if (!e || !d) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "ideaId and prompt are required" }));
          return;
        }
        const p = M(await N(J(n, "ideas.md"))).find((h) => h.id === e);
        if (!p) {
          t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "idea not found" }));
          return;
        }
        const l = await A(n, o);
        if (l) {
          t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: l }));
          return;
        }
        const m = u.startForIdea(p, d);
        if (!m.ok) {
          t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: m.error }));
          return;
        }
        t.statusCode = 202, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "POST" && C === "/api/agent/launch-extend") {
      try {
        const i = await H(r), { ideaId: e, prompt: d } = JSON.parse(i);
        if (!e || !d) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "ideaId and prompt are required" }));
          return;
        }
        const p = M(await N(J(n, "ideas.md"))).find((h) => h.id === e);
        if (!p) {
          t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "idea not found" }));
          return;
        }
        const l = await A(n, o);
        if (l) {
          t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: l }));
          return;
        }
        const m = u.startForIdeaExtend(p, d);
        if (!m.ok) {
          t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: m.error }));
          return;
        }
        t.statusCode = 202, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "POST" && C === "/api/agent/stop") {
      const i = u.stop();
      if (!i.ok) {
        t.statusCode = 409, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.error }));
        return;
      }
      t.statusCode = 202, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      return;
    }
    if (r.method === "POST" && C === "/api/config") {
      try {
        const i = O(n, ".paper-camp", "config.json"), e = await N(i);
        if (!e) {
          t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "config not found" }));
          return;
        }
        const d = await H(r), { port: f, projectName: p, defaultAgent: l, defaultAgents: m } = JSON.parse(d);
        if (f !== void 0 && (!Number.isInteger(f) || f <= 0)) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "port must be a positive integer" }));
          return;
        }
        if (p !== void 0 && p.trim().length === 0) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "projectName must not be empty" }));
          return;
        }
        if (l !== void 0 && !U.includes(l)) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "defaultAgent must be a known agent id" }));
          return;
        }
        if (m !== void 0) {
          for (const v of ["phase", "planDraft", "ideaExtend"])
            if (!U.includes(m[v])) {
              t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: `defaultAgents.${v} must be a known agent id` }));
              return;
            }
        }
        const h = JSON.parse(e), a = m ?? (l !== void 0 ? { phase: l, planDraft: l, ideaExtend: l } : void 0), g = h, { defaultAgent: w, ...T } = g, j = {
          ...T,
          ...f !== void 0 && { port: f },
          ...p !== void 0 && { projectName: p.trim() },
          ...a && { defaultAgents: a }
        };
        await I(i, JSON.stringify(j, null, 2)), t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "GET" && C === "/api/env") {
      try {
        const i = O(n, ".env"), e = O(n, ".env.example"), [d, f] = await Promise.all([
          et(i),
          et(e)
        ]), p = d ? V(await N(i)) : [], l = f ? V(await N(e)).map((a) => a.key) : [], m = new Set(p.map((a) => a.key)), h = l.filter((a) => !m.has(a));
        t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ exists: d, exampleExists: f, entries: p, missingKeys: h }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "POST" && C === "/api/env") {
      try {
        const i = await H(r), { entries: e } = JSON.parse(i);
        if (!Array.isArray(e)) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "entries is required" }));
          return;
        }
        const d = /* @__PURE__ */ new Set();
        for (const l of e) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(l.key)) {
            t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: `invalid key: ${l.key}` }));
            return;
          }
          if (d.has(l.key)) {
            t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: `duplicate key: ${l.key}` }));
            return;
          }
          d.add(l.key);
        }
        const f = O(n, ".env"), p = await N(f);
        await I(f, lt(p, e)), t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (i) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
      }
      return;
    }
    if (r.method === "GET" && C === "/api/configs") {
      const e = new URL(r.url ?? "", `http://${r.headers.host ?? "localhost"}`).searchParams.get("name");
      if (e)
        try {
          if (!Lt.includes(e)) {
            t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "invalid config file name" }));
            return;
          }
          const d = await N(O(n, e));
          if (!d) {
            t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "config file not found" }));
            return;
          }
          t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ name: e, content: d }));
          return;
        } catch (d) {
          t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: d.message }));
          return;
        }
    }
    const S = _t.find((i) => i.path === C);
    if (!S) {
      b();
      return;
    }
    try {
      const i = await S.handler(n);
      t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify(i));
    } catch (i) {
      t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: i.message }));
    }
  };
  return y.agent = u, y;
}
const Bt = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};
function Ft() {
  return O(ct(wt(import.meta.url)), "..", "app");
}
async function Gt({ root: n, port: c }) {
  const o = Ft(), s = O(o, "index.html"), u = await $(s, "utf-8").catch(() => null);
  if (u === null)
    throw new Error(
      `Dashboard assets not found at ${o}. Run \`pnpm build\` (or reinstall the package) so dist/app exists.`
    );
  const y = Mt(n);
  async function r(C, S) {
    const i = decodeURIComponent((C.url ?? "/").split("?")[0]), e = O(o, i === "/" ? "index.html" : i);
    try {
      if ((await st(e)).isFile()) {
        S.statusCode = 200, S.setHeader("Content-Type", Bt[dt(e)] ?? "application/octet-stream"), S.end(await $(e));
        return;
      }
    } catch {
    }
    S.statusCode = 200, S.setHeader("Content-Type", "text/html; charset=utf-8"), S.end(u);
  }
  const t = Ct((C, S) => {
    y(C, S, () => {
      r(C, S).catch((i) => {
        S.statusCode = 500, S.end(String(i));
      });
    });
  }), b = () => {
    y.agent.killCurrent(), process.exit(0);
  };
  process.on("SIGINT", b), process.on("SIGTERM", b), await new Promise((C) => t.listen(c, C));
}
const D = new ut();
D.name("paper-camp").description("Local-first, AI-native project companion.").version(gt);
D.command("init [project-name]").description("Initialize Paper Camp in the current directory").option("-i, --intent <text>", "one-line description of what you are building").action(async (n, c) => {
  const o = process.cwd(), s = n ?? pt(o);
  try {
    await mt(o, { projectName: s, intent: c.intent }), console.log(`Initialized Paper Camp in ${o}`), console.log("  .paper-camp/config.json"), console.log("  papercamp/ideas.md, plans.md, progress.md, decisions.md, open-questions.md");
  } catch (u) {
    if (u instanceof yt) {
      console.error(u.message), process.exitCode = 1;
      return;
    }
    throw u;
  }
});
D.command("dev").description("Start the local dashboard").option("-p, --port <number>", "port to listen on", "3333").action(async (n) => {
  const c = Number(n.port), o = process.cwd();
  try {
    await Gt({ root: o, port: c }), console.log(`Paper Camp dashboard running at http://localhost:${c}`);
  } catch (s) {
    console.error(s.message), process.exitCode = 1;
  }
});
D.command("add <type> [name]").description("Add a new entry (currently supports: plan)").option("-k, --kind <kind>", `plan kind (${F.join("|")})`, "feat").action(async (n, c, o) => {
  if (n !== "plan") {
    console.error(`Unknown type "${n}". Supported types: plan`), process.exitCode = 1;
    return;
  }
  if (!c) {
    console.error("Usage: paper-camp add plan <name> [--kind feat|fix|chore|docs|refactor]"), process.exitCode = 1;
    return;
  }
  if (!F.includes(o.kind)) {
    console.error(`Unknown kind "${o.kind}". Supported kinds: ${F.join(", ")}`), process.exitCode = 1;
    return;
  }
  const s = o.kind, u = Y(process.cwd(), ".paper-camp", "config.json"), y = await at(u, s), r = Y(process.cwd(), "papercamp", "plans.md"), t = it({
    title: c,
    status: "idea",
    kind: s,
    id: y,
    created: B()
  });
  await ot(r, t), console.log(`Added plan "${c}"${y ? ` (${y})` : ""} to papercamp/plans.md`);
});
D.parseAsync(process.argv);
//# sourceMappingURL=index.js.map
