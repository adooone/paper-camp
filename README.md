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

## Pages

- **Plans** — Browse and manage plans from `papercamp/plans/`
- **Review** — Code review findings surfaced as actionable plan phases
- **Docs** — Decisions, open questions, progress timeline, and repo docs
- **Settings** — Project configuration

## License

MIT
