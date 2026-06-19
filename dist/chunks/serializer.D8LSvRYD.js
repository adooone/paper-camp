import { mkdir as g, writeFile as f, access as P, readFile as x } from "node:fs/promises";
import { join as u, dirname as N } from "node:path";
import { z as c } from "zod";
const p = c.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date"), R = c.object({
  status: c.enum(["idea", "planned", "in-progress", "done", "dropped"]),
  created: p,
  updated: p.optional(),
  tags: c.string().optional()
}), A = c.object({
  date: p,
  status: c.enum(["decided", "superseded"]),
  "superseded-by": c.string().optional()
}), B = c.object({
  status: c.enum(["open", "resolved"]),
  raised: p,
  "resolved-by": c.string().optional()
}), D = c.object({
  version: c.string(),
  projectName: c.string(),
  initializedAt: c.string()
}), $ = /^##\s+(.+?)\s*$/, I = /^\*\*([A-Za-z][A-Za-z-]*):\*\*\s*(.*)$/, _ = /^###\s+Phases\s*$/i, v = /^#{2,3}\s+/, O = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
function C(e) {
  const s = e.split(`
`), n = s.findIndex((i) => _.test(i));
  if (n === -1)
    return { body: e, phases: [] };
  let a = s.length;
  for (let i = n + 1; i < s.length; i++)
    if (v.test(s[i])) {
      a = i;
      break;
    }
  const t = [];
  for (const i of s.slice(n + 1, a)) {
    const l = i.match(O);
    l && t.push({ done: l[1].toLowerCase() === "x", text: l[2].trim() });
  }
  return { body: [...s.slice(0, n), ...s.slice(a)].join(`
`).trim(), phases: t };
}
function y(e) {
  const s = e.split(`
`), n = [];
  for (let t = 0; t < s.length; t++)
    $.test(s[t]) && n.push(t);
  const a = [];
  for (let t = 0; t < n.length; t++) {
    const o = n[t], i = t + 1 < n.length ? n[t + 1] : s.length, l = s[o].match($)[1], d = s.slice(o + 1, i);
    let r = 0;
    for (; r < d.length && d[r].trim() === ""; ) r++;
    const E = {};
    for (; r < d.length; ) {
      const h = d[r].match(I);
      if (!h) break;
      E[h[1].toLowerCase()] = h[2].trim(), r++;
    }
    for (; r < d.length && d[r].trim() === ""; ) r++;
    const b = d.slice(r).join(`
`).trim(), { body: j, phases: S } = C(b);
    a.push({ title: l, fields: E, body: j, phases: S });
  }
  return a;
}
function M(e) {
  const s = [], n = [];
  for (const a of y(e)) {
    const t = R.safeParse(a.fields);
    if (!t.success) {
      n.push({
        title: a.title,
        message: t.error.issues.map((i) => i.message).join("; ")
      });
      continue;
    }
    const o = t.data;
    s.push({
      title: a.title,
      status: o.status,
      created: o.created,
      updated: o.updated,
      tags: o.tags ? o.tags.split(",").map((i) => i.trim()).filter(Boolean) : [],
      body: a.body,
      phases: a.phases
    });
  }
  return { entries: s, warnings: n };
}
function Q(e) {
  const s = [], n = [];
  for (const a of y(e)) {
    const t = A.safeParse(a.fields);
    if (!t.success) {
      n.push({
        title: a.title,
        message: t.error.issues.map((i) => i.message).join("; ")
      });
      continue;
    }
    const o = t.data;
    s.push({
      title: a.title,
      date: o.date,
      status: o.status,
      supersededBy: o["superseded-by"],
      body: a.body
    });
  }
  return { entries: s, warnings: n };
}
function U(e) {
  const s = [], n = [];
  for (const a of y(e)) {
    const t = B.safeParse(a.fields);
    if (!t.success) {
      n.push({
        title: a.title,
        message: t.error.issues.map((i) => i.message).join("; ")
      });
      continue;
    }
    const o = t.data;
    s.push({
      title: a.title,
      status: o.status,
      raised: o.raised,
      resolvedBy: o["resolved-by"],
      body: a.body
    });
  }
  return { entries: s, warnings: n };
}
const w = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/, z = /^[-*]\s+(.*)$/;
function K(e) {
  const s = e.split(`
`), n = [];
  for (let t = 0; t < s.length; t++)
    w.test(s[t]) && n.push(t);
  const a = [];
  for (let t = 0; t < n.length; t++) {
    const o = n[t], i = t + 1 < n.length ? n[t + 1] : s.length, l = s[o].match(w)[1], d = s.slice(o + 1, i).map((r) => r.match(z)).filter((r) => r !== null).map((r) => r[1].trim());
    a.push({ date: l, items: d });
  }
  return a;
}
const F = "0.1.0";
class L extends Error {
  constructor(s) {
    super(`Paper Camp is already initialized in ${s} (.paper-camp/config.json exists).`);
  }
}
async function m(e) {
  try {
    return await P(e), !0;
  } catch {
    return !1;
  }
}
const H = ["plans.md", "progress.md", "decisions.md", "open-questions.md"];
async function X(e, s) {
  const n = u(e, ".paper-camp"), a = u(n, "config.json"), t = u(e, "papercamp");
  if (await m(a))
    throw new L(e);
  const o = {
    version: F,
    projectName: s.projectName,
    initializedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  D.parse(o), await g(n, { recursive: !0 }), await f(a, `${JSON.stringify(o, null, 2)}
`, "utf-8"), await g(t, { recursive: !0 });
  const i = u(t, "ideas.md");
  if (!await m(i)) {
    const l = s.intent ? `# ${s.projectName}

${s.intent}
` : `# ${s.projectName}

What are you building, and why?
`;
    await f(i, l, "utf-8");
  }
  for (const l of H) {
    const d = u(t, l);
    await m(d) || await f(d, "", "utf-8");
  }
}
function Z() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function k(e) {
  const s = [
    `## ${e.title}`,
    "",
    `**Status:** ${e.status}`,
    `**Created:** ${e.created}`
  ];
  if (e.updated && s.push(`**Updated:** ${e.updated}`), e.tags && e.tags.length > 0 && s.push(`**Tags:** ${e.tags.join(", ")}`), s.push(""), e.body && s.push(e.body, ""), e.phases && e.phases.length > 0) {
    s.push("### Phases");
    for (const n of e.phases)
      s.push(`- [${n.done ? "x" : " "}] ${n.text}`);
  }
  return s.join(`
`).trimEnd();
}
function q(e) {
  const s = [`## ${e.title}`, "", `**Date:** ${e.date}`, `**Status:** ${e.status}`];
  return e.supersededBy && s.push(`**Superseded-by:** ${e.supersededBy}`), s.push(""), e.body && s.push(e.body), s.join(`
`).trimEnd();
}
function J(e) {
  const s = [
    `## ${e.title}`,
    "",
    `**Status:** ${e.status}`,
    `**Raised:** ${e.raised}`
  ];
  return e.resolvedBy && s.push(`**Resolved-by:** ${e.resolvedBy}`), s.push(""), e.body && s.push(e.body), s.join(`
`).trimEnd();
}
function V(e, s) {
  return [`## ${e}`, ...s.map((n) => `- ${n}`)].join(`
`);
}
function W(e) {
  return e.length === 0 ? "" : `${e.map((s) => k(s)).join(`

`)}
`;
}
async function ss(e, s) {
  await g(N(e), { recursive: !0 });
  let n = "";
  try {
    n = await x(e, "utf-8");
  } catch (o) {
    if (o.code !== "ENOENT") throw o;
  }
  const a = n.trimEnd(), t = a.length > 0 ? `${a}

${s}
` : `${s}
`;
  await f(e, t, "utf-8");
}
export {
  L as A,
  F as P,
  ss as a,
  J as b,
  k as c,
  A as d,
  W as e,
  q as f,
  V as g,
  Q as h,
  X as i,
  U as j,
  M as k,
  K as l,
  y as m,
  R as n,
  B as o,
  D as p,
  Z as t
};
//# sourceMappingURL=serializer.D8LSvRYD.js.map
