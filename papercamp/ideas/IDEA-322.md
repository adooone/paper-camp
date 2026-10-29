---
id: IDEA-322
title: Files on an idea
type: feat
status: idea
created: 2026-10-29
updated: 2026-10-29
tags:
  - app
  - planning
  - mobile
subject: Planning surface
---

An idea can only hold text. When a plan needs a mockup, a screenshot, a
diagram or a log excerpt, there's nowhere to put it that the app shows.
IDEA-321's UI mockups ended up in `papercamp/assets/IDEA-321/mockups.html`,
but the idea view has no section for files, and the daemon serves nothing
from `papercamp/assets/` except the project icon (`GET /api/icon` in
`src/app/server/routes/system/icon.ts`). The link in the idea's text opens
nowhere: `Markdown` (`src/app/components/markdown.tsx`) passes a relative
`href` straight to the browser, which resolves it against the app's route.
On the phone, `IdeaScreen` shows the body as a plain-text excerpt.

**One folder per idea.** An idea's files live in
`papercamp/assets/<ID>/`. IDEA-320 already counts `assets/` as part of the
plan, so the files are committed and shared between machines. The folder is
the only source of truth: no frontmatter list. A file dropped there by hand
or by an agent shows up the same as one uploaded in the app. The project
icon stays at `assets/icon.*`.

**The corpus reports them.** `readCorpus` lists each idea's folder (name,
size, type, modified time) onto `EntityEntry.assets`, so the web view, the
mobile app and agents get the files with the idea without an extra request.
The file watcher already covers `papercamp/`, so a new file refreshes the
view.

**The daemon serves them safely.**
- `GET /api/ideas/:id/assets` lists the folder.
- `GET /api/ideas/:id/assets/:name` serves one file, with the MIME type from
  its extension. The name must be a single path segment, so `..` and
  slashes are refused.
- HTML and SVG are served with `Content-Security-Policy: sandbox
  allow-scripts` and no `allow-same-origin`. A mockup an agent wrote can run
  its own script but can't call the daemon's API as the user.
- `POST` uploads one file and `DELETE` removes one. Both write through the
  same per-run bookkeeping commit that IDEA-319 sets up, not a commit per
  file.
- A per-file limit (default 5 MB, set in `config.json`) keeps the repo
  small. A larger upload is refused with the limit in the message.

**Links in the idea text just work.** In idea markdown, `assets/<name>` or
`../assets/<ID>/<name>` (the path that works when browsing the repo on
GitHub) is rewritten to the daemon route. An image link renders inline. A
link to HTML opens the preview below instead of a dead tab.

**A Files section in the idea view (web).** In `entity-detail.tsx`, between
Description and Clarifications. It only appears when the idea has files or
you drag one in. Each file shows as one row: a type icon, name, size and
age. Images get a thumbnail. Tapping a row opens a preview sheet: images at
full size, HTML in a sandboxed iframe, and text or JSON in a code view,
with *Open in new tab* and *Delete*. Dropping a file anywhere on the idea
uploads it, and so does an *Add file* button. A *Copy link* action gives the
markdown to paste into the text.

**Files on the phone** (`paper-camp-mobile`, its own idea with
`needs: paper-camp/IDEA-322`). A Files card on `IdeaScreen` under the body
excerpt, with the same rows. Images open full screen. HTML opens in the
in-app browser against the daemon route. *Add file* uses the photo picker
and camera, so a screenshot of a bug can go straight onto its idea.

**Agents know where files go.** The phase and draft prompts, and the
paper-camp skill, say that supporting files for an idea go in
`papercamp/assets/<ID>/` and are linked from the text as `assets/<name>`.
The next agent that writes a mockup then puts it where the app can show it.

**Archive and doctor.** Archiving an idea leaves its folder where it is,
since the id never changes. `paper-camp doctor` warns about:
- a folder whose id matches no idea,
- a file over the limit,
- a link in an idea's text to a file that doesn't exist.

Out of scope: storing files outside git (LFS or a blob store), editing
files in the app, and files on notes or chat messages.

Done when IDEA-321's `../assets/IDEA-321/mockups.html` link opens its
mockups from the idea view on web and phone. Also: an image dropped onto an
idea shows as a thumbnail in Files and inline wherever its text links it; a
file added by hand on another machine appears after a pull; a mockup's
script can't reach `/api/*`; and `..` in a file name is refused.

### Phases
- [x] Assets on the corpus and the serving routes
      List `papercamp/assets/<ID>/` onto `EntityEntry.assets`; `GET` list and file routes with MIME types, single-segment names and a sandbox CSP for HTML and SVG; `POST` and `DELETE` with the size limit from `config.json` and the per-run bookkeeping commit; route tests including traversal.
      run: 7m35s · 132 in · 43.8k out · sonnet-5 · sess:909924a3-2277-4499-b4d4-729e82b9a8a6
- [ ] Asset links in idea markdown
      Rewrite `assets/<name>` and `../assets/<ID>/<name>` in `Markdown` to the route, render image links inline, and send HTML links to the preview.
- [ ] Files section in the web idea view
      Rows with type icon, size, age and image thumbnails; preview sheet for image, sandboxed HTML and text; drag-and-drop and *Add file* upload; *Copy link* and *Delete*.
- [ ] Agent prompts, skill and doctor
      Tell phase and draft prompts and the paper-camp skill where files go and how to link them; doctor checks for orphan folders, oversized files and dead asset links; document the routes and `EntityEntry.assets` for the paper-camp-mobile idea.
