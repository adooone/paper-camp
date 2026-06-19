#!/usr/bin/env node
import { join as l, dirname as J, extname as b, basename as x, resolve as k } from "node:path";
import { Command as E } from "commander";
import { k as O, e as T, c as P, t as C, a as H, l as A, h as D, j as $, P as R, i as U, A as I } from "../chunks/serializer.D8LSvRYD.js";
import { writeFile as j, readFile as w, mkdir as M, stat as L } from "node:fs/promises";
import { createServer as z } from "node:http";
import { fileURLToPath as F } from "node:url";
async function m(e) {
  try {
    return await w(e, "utf-8");
  } catch (a) {
    if (a.code === "ENOENT") return "";
    throw a;
  }
}
async function S(e) {
  return new Promise((a, t) => {
    let c = "";
    e.on("data", (r) => {
      c += r;
    }), e.on("end", () => a(c)), e.on("error", t);
  });
}
const u = (e, a) => l(e, "papercamp", a), B = [
  {
    path: "/api/package-name",
    handler: async (e) => {
      const a = await m(l(e, "package.json"));
      if (!a) return null;
      try {
        return JSON.parse(a).name ?? null;
      } catch {
        return null;
      }
    }
  },
  {
    path: "/api/plans",
    handler: async (e) => O(await m(u(e, "plans.md")))
  },
  {
    path: "/api/progress",
    handler: async (e) => ({
      entries: A(await m(u(e, "progress.md")))
    })
  },
  {
    path: "/api/decisions",
    handler: async (e) => D(await m(u(e, "decisions.md")))
  },
  {
    path: "/api/open-questions",
    handler: async (e) => $(await m(u(e, "open-questions.md")))
  },
  {
    path: "/api/ideas",
    handler: async (e) => ({
      content: await m(u(e, "ideas.md"))
    })
  },
  {
    path: "/api/config",
    handler: async (e) => {
      const a = await m(l(e, ".paper-camp", "config.json"));
      return a ? JSON.parse(a) : null;
    }
  }
];
function _(e) {
  return async (a, t, c) => {
    const r = (a.url ?? "").split("?")[0];
    if (a.method === "DELETE" && r === "/api/plans") {
      try {
        const s = new URL(a.url ?? "", `http://${a.headers.host ?? "localhost"}`).searchParams.get("title");
        if (!(s != null && s.trim())) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "title is required" }));
          return;
        }
        const i = u(e, "plans.md"), n = O(await m(i)), p = s.trim(), d = n.entries.filter((f) => f.title !== p);
        if (d.length === n.entries.length) {
          t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "plan not found" }));
          return;
        }
        await j(i, T(d)), t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (o) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: o.message }));
      }
      return;
    }
    if (a.method === "POST" && r === "/api/plans") {
      try {
        const o = await S(a), { title: s, content: i } = JSON.parse(o);
        if (!(s != null && s.trim())) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "title is required" }));
          return;
        }
        const n = P({
          title: s.trim(),
          status: "idea",
          created: C(),
          body: i == null ? void 0 : i.trim()
        });
        await H(u(e, "plans.md"), n), t.statusCode = 201, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (o) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: o.message }));
      }
      return;
    }
    if (a.method === "PATCH" && r === "/api/plans") {
      try {
        const s = new URL(a.url ?? "", `http://${a.headers.host ?? "localhost"}`).searchParams.get("title");
        if (!(s != null && s.trim())) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "title is required" }));
          return;
        }
        const i = await S(a), n = JSON.parse(i), p = u(e, "plans.md"), d = O(await m(p)), f = s.trim();
        let N = !1;
        const v = d.entries.map((g) => g.title === f ? (N = !0, {
          ...g,
          ...n.status !== void 0 && { status: n.status },
          ...n.phases !== void 0 && { phases: n.phases },
          updated: C()
        }) : n.status === "in-progress" && g.status === "in-progress" ? { ...g, status: "planned", updated: C() } : g);
        if (!N) {
          t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "plan not found" }));
          return;
        }
        await j(p, T(v)), t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (o) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: o.message }));
      }
      return;
    }
    if (a.method === "GET" && r === "/api/icon") {
      const o = l(e, ".paper-camp", "assets"), s = {
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp"
      };
      for (const [i, n] of Object.entries(s))
        try {
          const p = await w(l(o, `icon.${i}`));
          t.statusCode = 200, t.setHeader("Content-Type", n), t.setHeader("Cache-Control", "no-cache"), t.end(p);
          return;
        } catch {
        }
      t.statusCode = 404, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "no icon uploaded" }));
      return;
    }
    if (a.method === "POST" && r === "/api/icon") {
      try {
        const o = await S(a), { dataUri: s } = JSON.parse(o);
        if (!s) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "dataUri is required" }));
          return;
        }
        const i = s.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/);
        if (!i) {
          t.statusCode = 400, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: "invalid data URI" }));
          return;
        }
        const n = i[1], p = n === "image/svg+xml" ? "svg" : n.split("/")[1], d = Buffer.from(i[2], "base64"), f = l(e, ".paper-camp", "assets");
        await M(f, { recursive: !0 }), await j(l(f, `icon.${p}`), d), t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ ok: !0 }));
      } catch (o) {
        t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: o.message }));
      }
      return;
    }
    const y = B.find((o) => o.path === r);
    if (!y) {
      c();
      return;
    }
    try {
      const o = await y.handler(e);
      t.statusCode = 200, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify(o));
    } catch (o) {
      t.statusCode = 500, t.setHeader("Content-Type", "application/json"), t.end(JSON.stringify({ error: o.message }));
    }
  };
}
const G = {
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
function Q() {
  return l(J(F(import.meta.url)), "..", "app");
}
async function V({ root: e, port: a }) {
  const t = Q(), c = l(t, "index.html"), r = await w(c, "utf-8").catch(() => null);
  if (r === null)
    throw new Error(
      `Dashboard assets not found at ${t}. Run \`pnpm build\` (or reinstall the package) so dist/app exists.`
    );
  const y = _(e);
  async function o(i, n) {
    const p = decodeURIComponent((i.url ?? "/").split("?")[0]), d = l(t, p === "/" ? "index.html" : p);
    try {
      if ((await L(d)).isFile()) {
        n.statusCode = 200, n.setHeader("Content-Type", G[b(d)] ?? "application/octet-stream"), n.end(await w(d));
        return;
      }
    } catch {
    }
    n.statusCode = 200, n.setHeader("Content-Type", "text/html; charset=utf-8"), n.end(r);
  }
  const s = z((i, n) => {
    y(i, n, () => {
      o(i, n).catch((p) => {
        n.statusCode = 500, n.end(String(p));
      });
    });
  });
  await new Promise((i) => s.listen(a, i));
}
const h = new E();
h.name("paper-camp").description("Local-first, AI-native project companion.").version(R);
h.command("init [project-name]").description("Initialize Paper Camp in the current directory").option("-i, --intent <text>", "one-line description of what you are building").action(async (e, a) => {
  const t = process.cwd(), c = e ?? x(t);
  try {
    await U(t, { projectName: c, intent: a.intent }), console.log(`Initialized Paper Camp in ${t}`), console.log("  .paper-camp/config.json"), console.log("  papercamp/ideas.md, plans.md, progress.md, decisions.md, open-questions.md");
  } catch (r) {
    if (r instanceof I) {
      console.error(r.message), process.exitCode = 1;
      return;
    }
    throw r;
  }
});
h.command("dev").description("Start the local dashboard").option("-p, --port <number>", "port to listen on", "3333").action(async (e) => {
  const a = Number(e.port), t = process.cwd();
  try {
    await V({ root: t, port: a }), console.log(`Paper Camp dashboard running at http://localhost:${a}`);
  } catch (c) {
    console.error(c.message), process.exitCode = 1;
  }
});
h.command("add <type> [name]").description("Add a new entry (currently supports: plan)").action(async (e, a) => {
  if (e !== "plan") {
    console.error(`Unknown type "${e}". Supported types: plan`), process.exitCode = 1;
    return;
  }
  if (!a) {
    console.error("Usage: paper-camp add plan <name>"), process.exitCode = 1;
    return;
  }
  const t = k(process.cwd(), "papercamp", "plans.md"), c = P({ title: a, status: "idea", created: C() });
  await H(t, c), console.log(`Added plan "${a}" to papercamp/plans.md`);
});
h.parseAsync(process.argv);
//# sourceMappingURL=index.js.map
