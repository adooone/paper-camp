---
id: IDEA-122
title: MCP as the primary write path
type: feat
status: idea
created: 2026-08-04
tags:
  - format
  - mcp
  - agents
subject: The format as the product
---

Files stay the storage; the MCP becomes the guarded gateway. Raw file edits by agents produce structural corruption (see the split-Phases incident in [[IDEA-121]]) because every agent re-implements the grammar from examples. The MCP server already exists and already enforces guards (id allocation, branch conflicts) — extend it to cover the full write surface (add/edit idea, check phase, append log/thread note, promote/archive) and update the skill to steer agents to MCP tools first, raw files as fallback only.

This is Horizon 4's **format as the product** from the write side: Paper Camp the app is one client of the format, and the MCP is the client every *other* agent uses safely.
