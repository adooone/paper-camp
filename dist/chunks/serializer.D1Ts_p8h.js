import { mkdir as E, writeFile as m, access as O, readFile as j } from "node:fs/promises";
import { join as h, dirname as T } from "node:path";
import { z as a } from "zod";
import { AGENT_IDS as p } from "../types/index.js";
const G = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
function z(t) {
  return t.length >= 2 && (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'")) ? t.slice(1, -1) : t;
}
function S(t) {
  return t === "" || /[\s#"]/.test(t) ? `"${t.replace(/"/g, '\\"')}"` : t;
}
function v(t) {
  const e = t.trim();
  if (!e || e.startsWith("#")) return null;
  const n = e.match(G);
  return n ? { key: n[1], value: z(n[2]) } : null;
}
function ht(t) {
  const e = [];
  for (const n of t.split(`
`)) {
    const o = v(n);
    o && e.push(o);
  }
  return e;
}
function pt(t, e) {
  const n = new Map(e.map((i) => [i.key, i.value])), o = t.length > 0 ? t.split(`
`) : [], s = [];
  for (const i of o) {
    const r = v(i);
    if (!r) {
      s.push(i);
      continue;
    }
    n.has(r.key) && (s.push(`${r.key}=${S(n.get(r.key) ?? "")}`), n.delete(r.key));
  }
  for (const [i, r] of n)
    s.push(`${i}=${S(r)}`);
  for (; s.length > 0 && s[s.length - 1] === ""; ) s.pop();
  return s.length > 0 ? `${s.join(`
`)}
` : "";
}
const y = a.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date"), H = a.object({
  status: a.enum(["idea", "planned", "in-progress", "review", "done", "dropped"]),
  kind: a.enum(["feat", "fix", "chore", "docs", "refactor"]).optional(),
  id: a.string().optional(),
  idea: a.string().optional(),
  agent: a.enum(p).optional(),
  created: y,
  updated: y.optional(),
  tags: a.string().optional()
}), F = a.object({
  date: y,
  status: a.enum(["decided", "superseded"]),
  "superseded-by": a.string().optional()
}), q = a.object({
  status: a.enum(["open", "resolved"]),
  raised: y,
  "resolved-by": a.string().optional(),
  blocks: a.string().optional()
}), U = a.object({
  version: a.string(),
  projectName: a.string(),
  initializedAt: a.string(),
  nextId: a.object({
    feat: a.number(),
    fix: a.number(),
    chore: a.number(),
    docs: a.number(),
    refactor: a.number()
  }).optional(),
  defaultAgent: a.enum(p).optional(),
  defaultAgents: a.object({
    phase: a.enum(p),
    planDraft: a.enum(p),
    ideaExtend: a.enum(p)
  }).optional()
}), x = /^##\s+(.+?)\s*$/, W = /^\*\*([A-Za-z][A-Za-z-]*):\*\*\s*(.*)$/, Y = /^###\s+Phases\s*$/i, M = /^###\s+Log\s*$/i, Z = /^###\s+Clarifications\s*$/i, _ = /^#{2,3}\s+/, I = /^[-*]\s+\[([ xX])\]\s+(.*)$/, J = /^\[review\]\s+(.*)$/, K = /^-\s+(\d{4}-\d{2}-\d{2}):\s*(.*)$/;
function R(t, e, n) {
  const o = t.split(`
`), s = o.findIndex((c) => e.test(c));
  if (s === -1) return { body: t, entries: [] };
  let i = o.length;
  for (let c = s + 1; c < o.length; c++)
    if (_.test(o[c])) {
      i = c;
      break;
    }
  const r = n(o, s + 1, i);
  return { body: [...o.slice(0, s), ...o.slice(i)].join(`
`).trim(), entries: r };
}
function Q(t, e, n) {
  const o = [];
  let s = e;
  for (; s < n; ) {
    const i = t[s].match(I);
    if (i) {
      const r = i[1].toLowerCase() === "x", l = i[2].trim(), c = l.match(J), d = c ? c[1].trim() : l, g = c ? "review" : void 0, f = [];
      for (s++; s < n; ) {
        const u = t[s];
        if (u.trim() === "" || I.test(u) || _.test(u)) break;
        if (/^\s/.test(u))
          f.push(u.trimStart()), s++;
        else
          break;
      }
      o.push({
        done: r,
        text: d,
        description: f.length > 0 ? f.join(`
`) : void 0,
        source: g
      });
    } else
      s++;
  }
  return o;
}
function X(t) {
  const e = R(t, Y, Q);
  return { body: e.body, phases: e.entries };
}
function V(t, e, n) {
  const o = [];
  for (let s = e; s < n; s++) {
    const i = t[s].match(K);
    i && o.push({ date: i[1], text: i[2].trim() });
  }
  return o;
}
function P(t, e) {
  return R(t, e, V);
}
function tt(t) {
  const { body: e, entries: n } = P(t, M);
  return { body: e, log: n };
}
function et(t) {
  const { body: e, entries: n } = P(t, Z);
  return { body: e, clarifications: n };
}
function w(t) {
  const e = t.split(`
`), n = [];
  for (let s = 0; s < e.length; s++)
    x.test(e[s]) && n.push(s);
  const o = [];
  for (let s = 0; s < n.length; s++) {
    const i = n[s], r = s + 1 < n.length ? n[s + 1] : e.length, l = e[i].match(x)[1], c = e.slice(i + 1, r);
    let d = 0;
    for (; d < c.length && c[d].trim() === ""; ) d++;
    const g = {};
    for (; d < c.length; ) {
      const b = c[d].match(W);
      if (!b) break;
      g[b[1].toLowerCase()] = b[2].trim(), d++;
    }
    for (; d < c.length && c[d].trim() === ""; ) d++;
    const f = c.slice(d).join(`
`).trim();
    let { body: u, phases: D } = X(f);
    const { body: N, log: B } = tt(u);
    u = N;
    const { body: C, clarifications: L } = et(u);
    u = C, o.push({ title: l, fields: g, body: u, phases: D, log: B, clarifications: L });
  }
  return o;
}
function mt(t) {
  const e = [], n = [];
  for (const o of w(t)) {
    const s = H.safeParse(o.fields);
    if (!s.success) {
      n.push({
        title: o.title,
        message: s.error.issues.map((r) => r.message).join("; ")
      });
      continue;
    }
    const i = s.data;
    e.push({
      title: o.title,
      status: i.status,
      kind: i.kind,
      id: i.id,
      idea: i.idea,
      agent: i.agent,
      created: i.created,
      updated: i.updated,
      tags: i.tags ? i.tags.split(",").map((r) => r.trim()).filter(Boolean) : [],
      body: o.body,
      phases: o.phases,
      log: o.log,
      clarifications: o.clarifications
    });
  }
  return { entries: e, warnings: n };
}
function gt(t) {
  const e = [], n = [];
  for (const o of w(t)) {
    const s = F.safeParse(o.fields);
    if (!s.success) {
      n.push({
        title: o.title,
        message: s.error.issues.map((r) => r.message).join("; ")
      });
      continue;
    }
    const i = s.data;
    e.push({
      title: o.title,
      date: i.date,
      status: i.status,
      supersededBy: i["superseded-by"],
      body: o.body
    });
  }
  return { entries: e, warnings: n };
}
function yt(t) {
  const e = [], n = [];
  for (const o of w(t)) {
    const s = q.safeParse(o.fields);
    if (!s.success) {
      n.push({
        title: o.title,
        message: s.error.issues.map((r) => r.message).join("; ")
      });
      continue;
    }
    const i = s.data;
    e.push({
      title: o.title,
      status: i.status,
      raised: i.raised,
      resolvedBy: i["resolved-by"],
      blocks: i.blocks,
      body: o.body
    });
  }
  return { entries: e, warnings: n };
}
const st = /^(IDEA-\d+):\s*/, nt = /\n---+\n/;
function bt(t) {
  return t.split(nt).filter(Boolean).map((n) => {
    var c;
    const o = n.match(/^#{1,3}\s+(.+)/m), s = o ? o[1].trim() : ((c = n.trim().split(`
`)[0]) == null ? void 0 : c.trim()) ?? "Untitled", i = s.match(st), r = (i == null ? void 0 : i[1]) ?? null, l = r ? s.slice(i[0].length) : s;
    return { id: r, title: l, body: n.trim() };
  });
}
function $t(t, e) {
  return t.map((n) => {
    if (!n.id)
      return { ...n, status: "planned" };
    const o = e.filter((i) => i.idea === n.id);
    if (o.length === 0)
      return { ...n, status: "planned" };
    const s = o.every((i) => i.status === "done" || i.status === "dropped");
    return { ...n, status: s ? "done" : "planned" };
  });
}
function Et(t, e, n) {
  const o = new Set(t.map((i) => i.title)), s = [];
  for (const i of t)
    i.supersededBy && !o.has(i.supersededBy) && s.push({
      kind: "dangling-superseded-by",
      section: "decisions",
      title: i.title,
      message: `Superseded-by "${i.supersededBy}" doesn't match any decision`
    });
  for (const i of e)
    if (i.resolvedBy && !o.has(i.resolvedBy) && s.push({
      kind: "dangling-resolved-by",
      section: "open-questions",
      title: i.title,
      message: `Resolved-by "${i.resolvedBy}" doesn't match any decision`
    }), i.status === "open" && i.blocks) {
      const r = n.find((l) => l.id === i.blocks);
      r && (r.status === "in-progress" || r.status === "review") && s.push({
        kind: "blocked-plan-active",
        section: "open-questions",
        title: i.title,
        planId: r.id,
        message: `Still open but blocks "${r.title}" (${r.id}), already ${r.status}`
      });
    }
  return s;
}
const k = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/, it = /^[-*]\s+(.*)$/;
function wt(t) {
  const e = t.split(`
`), n = [];
  for (let s = 0; s < e.length; s++)
    k.test(e[s]) && n.push(s);
  const o = [];
  for (let s = 0; s < n.length; s++) {
    const i = n[s], r = s + 1 < n.length ? n[s + 1] : e.length, l = e[i].match(k)[1], c = e.slice(i + 1, r).map((d) => d.match(it)).filter((d) => d !== null).map((d) => d[1].trim());
    o.push({ date: l, items: c });
  }
  return o;
}
const ot = "0.1.0";
class rt extends Error {
  constructor(e) {
    super(`Paper Camp is already initialized in ${e} (.paper-camp/config.json exists).`);
  }
}
async function $(t) {
  try {
    return await O(t), !0;
  } catch {
    return !1;
  }
}
const at = ["plans.md", "progress.md", "decisions.md", "open-questions.md"];
async function St(t, e) {
  const n = h(t, ".paper-camp"), o = h(n, "config.json"), s = h(t, "papercamp");
  if (await $(o))
    throw new rt(t);
  const i = {
    version: ot,
    projectName: e.projectName,
    initializedAt: (/* @__PURE__ */ new Date()).toISOString(),
    nextId: { feat: 1, fix: 1, chore: 1, docs: 1, refactor: 1 }
  };
  U.parse(i), await E(n, { recursive: !0 }), await m(o, `${JSON.stringify(i, null, 2)}
`, "utf-8"), await E(s, { recursive: !0 });
  const r = h(s, "ideas.md");
  if (!await $(r)) {
    const l = e.intent ? `# ${e.projectName}

${e.intent}
` : `# ${e.projectName}

What are you building, and why?
`;
    await m(r, l, "utf-8");
  }
  for (const l of at) {
    const c = h(s, l);
    await $(c) || await m(c, "", "utf-8");
  }
}
function xt() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
let A = Promise.resolve();
async function It(t, e) {
  const n = A.then(async () => {
    let o = null;
    try {
      o = JSON.parse(await j(t, "utf-8"));
    } catch {
      return;
    }
    if (!(o != null && o.nextId)) return;
    const s = o.nextId[e] ?? 1, i = `${e.toUpperCase()}-${s}`;
    return o.nextId[e] = s + 1, await m(t, `${JSON.stringify(o, null, 2)}
`), i;
  });
  return A = n.catch(() => {
  }), n;
}
function ct(t) {
  const e = [`## ${t.title}`, "", `**Status:** ${t.status}`];
  if (t.kind && e.push(`**Kind:** ${t.kind}`), t.id && e.push(`**Id:** ${t.id}`), t.idea && e.push(`**Idea:** ${t.idea}`), t.agent && e.push(`**Agent:** ${t.agent}`), e.push(`**Created:** ${t.created}`), t.updated && e.push(`**Updated:** ${t.updated}`), t.tags && t.tags.length > 0 && e.push(`**Tags:** ${t.tags.join(", ")}`), e.push(""), t.body && e.push(t.body, ""), t.clarifications && t.clarifications.length > 0) {
    e.push("### Clarifications");
    for (const n of t.clarifications)
      e.push(`- ${n.date}: ${n.text}`);
    e.push("");
  }
  if (t.phases && t.phases.length > 0) {
    e.push("### Phases");
    for (const n of t.phases) {
      const o = n.source === "review" ? `[review] ${n.text}` : n.text;
      if (e.push(`- [${n.done ? "x" : " "}] ${o}`), n.description)
        for (const s of n.description.split(`
`))
          e.push(`      ${s}`);
    }
  }
  if (t.log && t.log.length > 0) {
    e.push("", "### Log");
    for (const n of t.log)
      e.push(`- ${n.date}: ${n.text}`);
  }
  return e.join(`
`).trimEnd();
}
function kt(t) {
  const e = [`## ${t.title}`, "", `**Date:** ${t.date}`, `**Status:** ${t.status}`];
  return t.supersededBy && e.push(`**Superseded-by:** ${t.supersededBy}`), e.push(""), t.body && e.push(t.body), e.join(`
`).trimEnd();
}
function At(t) {
  const e = [
    `## ${t.title}`,
    "",
    `**Status:** ${t.status}`,
    `**Raised:** ${t.raised}`
  ];
  return t.resolvedBy && e.push(`**Resolved-by:** ${t.resolvedBy}`), t.blocks && e.push(`**Blocks:** ${t.blocks}`), e.push(""), t.body && e.push(t.body), e.join(`
`).trimEnd();
}
function jt(t, e) {
  return [`## ${t}`, ...e.map((n) => `- ${n}`)].join(`
`);
}
function vt(t) {
  return t.length === 0 ? "" : `${t.map((e) => ct(e)).join(`

`)}
`;
}
async function _t(t, e) {
  await E(T(t), { recursive: !0 });
  let n = "";
  try {
    n = await j(t, "utf-8");
  } catch (i) {
    if (i.code !== "ENOENT") throw i;
  }
  const o = n.trimEnd(), s = o.length > 0 ? `${o}

${e}
` : `${e}
`;
  await m(t, s, "utf-8");
}
export {
  rt as A,
  ot as P,
  _t as a,
  pt as b,
  It as c,
  F as d,
  $t as e,
  Et as f,
  kt as g,
  At as h,
  ct as i,
  vt as j,
  jt as k,
  St as l,
  gt as m,
  ht as n,
  q as o,
  U as p,
  bt as q,
  yt as r,
  mt as s,
  wt as t,
  w as u,
  H as v,
  xt as w
};
//# sourceMappingURL=serializer.D1Ts_p8h.js.map
