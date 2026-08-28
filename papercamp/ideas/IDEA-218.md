---
id: IDEA-218
title: GitHub sign-in via device flow
type: feat
status: in-progress
created: 2026-08-28
updated: 2026-08-28
tags:
  - app
  - server
subject: Multi-project
order: 1
---

The hub's Connect GitHub card makes the user mint and paste a fine-grained
token because a browser page cannot do GitHub OAuth alone: the token endpoints
under `github.com/login/oauth/` send no CORS headers, and the redirect flow
needs a client secret that neither the static hosted client nor an npm-shipped
runtime can hold. GitHub's device flow removes both constraints — it needs
only a public client ID — so the card can offer real in-browser sign-in.

The flow: a **Sign in with GitHub** button (primary action on the card; the
token paste stays as the fallback beneath it) calls `POST
/api/github/device-code`; the card shows the returned user code with a link to
`github.com/login/device` opened in a new tab. The backend polls the token
endpoint through `POST /api/github/device-token`, honouring the returned
`interval` and `slow_down` responses, and on approval the token lands in the
existing `hub-token-store` — the card flips to the same Connected state the
pasted path uses. Cancel or code expiry returns the card to idle with the
message GitHub gave.

Both endpoints are thin proxies of `github.com/login/device/code` and
`github.com/login/oauth/access_token`, carrying no secret. The card calls them
through the same api base the page already uses, so whichever backend answers
`/api` runs the flow: the runtime serving the hub (two routes in
`src/app/server/routes`, shipped in the package), or — for the hosted client
with no runtime, its GitHub-only planning mode — one Vercel serverless
function doing the identical proxy; `vercel.json`'s rewrite already excludes
`/api/` from the SPA fallback.

Identity is the existing **Paper Scout** GitHub App with device flow enabled
in its settings. Its server-side role is untouched — the private key stays a
repo secret, and device flow adds only the public client ID — while its
installation base does double duty: the repositories a user installed Scout
on are exactly what the hub token reaches, so one install powers both the PR
bot and the hub's repo list, and tokens come out repo-scoped the way the
card's fine-grained copy promises today. The accepted trade-off of sharing
the app is its single permission set: a future hub need Scout lacks means a
permission bump that re-prompts every existing installation. User-token
expiry is disabled in the app settings, so no refresh plumbing exists. The
client ID ships as a constant with a `PAPERCAMP_GITHUB_CLIENT_ID` env
override for forks, the same pattern `PAPERCAMP_HOSTED_CLIENT_URL` set.

### Out of scope

What the token is used for once stored. Scout's server-side credential path
(app id + private key). Refresh-token plumbing — expiry is disabled at the
app level. Removing the paste-a-token fallback.

### Phases
- [ ] Enable device flow on the Paper Scout app
      Human step: device flow on, user-token expiry disabled, metadata and contents read confirmed in its permissions; record the public client ID.
- [ ] Ship the client ID as a constant with a `PAPERCAMP_GITHUB_CLIENT_ID` override
- [ ] Add the two device-flow proxy routes to the runtime server
      `POST /api/github/device-code` and `POST /api/github/device-token`, passing GitHub's `interval` and `slow_down` straight back.
- [ ] Mirror the same proxy as one Vercel serverless function for the hosted client
- [ ] Add the Sign in with GitHub button and user-code step to the connect card
      Primary action above the existing paste-a-token fallback, ending in the same Connected state.
- [ ] Return the card to idle on cancel, denial, or code expiry with GitHub's message

### Thread
- [x] 2026-08-28 [decision] [agent] Reuse the Paper Scout GitHub App instead of registering a new one — device flow adds only the public client ID, the private-key PR-bot path is untouched, and one installation's repo selection powers both the PR bot and the hub's repo list. Accepted trade-off: a future hub permission Scout lacks re-prompts every installation.
- [x] 2026-08-28 [question] [agent] Run-all parked on phase 1 ("Enable device flow on the Paper Scout app") — the agent needs a decision: Phase 1 of IDEA-218 requires manually enabling device flow, disabling user-token expiry, and confirming metadata/contents read permissions in the Paper Scout GitHub App settings (github.com → Settings → Developer settings → GitHub Apps → Paper Scout), then reporting back the app's public Client ID. Could you do this in the GitHub UI and give me the Client ID so I can mark this phase complete and proceed to phase 2 (shipping it as a constant)?
- [x] 2026-08-28 [clarification] client id - Iv23ligLF1oQlhORSdew
- [x] 2026-08-28 [chat] [agent] Got it — Client ID Iv23ligLF1oQlhORSdew. That closes out phase 1; marking it done and moving to phase 2 (shipping the ID as a constant with the PAPERCAMP_GITHUB_CLIENT_ID override).
