# Paper Camp

A local-first, AI-native project companion that lives where your work lives.

Most project management tools are built around teams, dashboards, and the assumption that your work needs to be somewhere on the internet. Paper Camp rejects that. It lives in your repository, versioned alongside your code, invisible to everything except you and your AI assistant.

The core idea is simple: every project deserves a memory. Not a kanban board, not a ticket system — a structured, honest record of where you started, where you are, and where you're going. A place where ideas don't get lost in chat history. A place your AI can read in seconds and immediately understand the current state of your intent.

## The folder is the database

A `papercamp/` directory sits at the root of your project. It contains markdown files with a defined structure — ideas, plans, progress, decisions, open questions. No external services, no sync, no accounts. Every change is a git commit. The history of your project is the history of those files.

## AI as a first-class collaborator

Paper Camp is designed around the way humans actually work with AI assistants. At the start of every session, you point your assistant to `papercamp/` and it knows everything — what was built, what was decided, what's next. No re-explaining. No lost context. The structured files are not documentation written after the fact; they are the living source of truth that both you and the AI maintain together.

## Quick Start

```bash
# Start the dev server
bun run dev
```

Open `http://localhost:3333` to access the dashboard.

## Reachable from anywhere

`paper-camp dev` only answers requests from the machine it runs on, or another
device on the same LAN/tailnet. To reach it from the hosted client on a
different machine over the open internet, run:

```bash
paper-camp dev --share
```

This opens an account-less `cloudflared` quick tunnel and prints a
registration link with its `https://…trycloudflare.com` address baked in —
open that link in the hosted client and it's paired. The address changes every
restart; that's the trade for needing no setup and no account.

### Already on Tailscale?

If every machine involved is already on your tailnet, `tailscale serve` gives
you a stable address and a real certificate with no third party in the path —
worth it if you have Tailscale, but more setup than `--share`:

1. Enable HTTPS certificates for your tailnet once, in the
   [Tailscale admin console](https://login.tailscale.com/admin/dns) under
   **DNS → HTTPS Certificates**.
2. From the machine running `paper-camp dev`, serve it over HTTPS at a stable
   MagicDNS address:
   ```bash
   sudo tailscale serve --bg --https=443 / http://localhost:3333
   ```
   The first run needs `sudo` so Tailscale can provision the certificate.
3. Open `https://<your-machine>.<your-tailnet>.ts.net/` — directly, or pasted
   into the hosted client — from any device on the tailnet. Stop sharing with
   `tailscale serve reset`.

## Pages

- **Plans** — Browse and manage plans from `papercamp/plans/`
- **Review** — Code review findings surfaced as actionable plan phases
- **Docs** — Decisions, open questions, progress timeline, and repo docs
- **Settings** — Project configuration

## MCP server

Any [Model Context Protocol](https://modelcontextprotocol.io) client can read and write your
`papercamp/` project via `paper-camp mcp`. See [docs/MCP.md](docs/MCP.md) for the client config
snippet and the full tool list.

## License

MIT
