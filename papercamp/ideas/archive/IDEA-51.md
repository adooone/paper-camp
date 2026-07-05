---
id: IDEA-51
title: Add board view and branding
type: feat
status: done
created: 2026-06-19
tags:
  - app
  - plans
  - settings
---

Extended the Plans page with a board view and plan create/delete, and gave the dashboard a project identity (icon + name) instead of generic branding.

### Phases
- [x] Add list/board view toggle
      List/board view toggle on the Plans page; board view is a read-only kanban (`in-progress`/`planned`/`idea`/`done` columns, no drag-and-drop)
- [x] Add collapsible Closed section
      Collapsible "Closed" section in list view for `done`/`dropped` plans
- [x] Add idea creation modal
      "Add idea" modal — `POST /api/plans` to create a new `Status: idea` entry
- [x] Delete plan or idea entry
      Delete a plan/idea entry — `DELETE /api/plans?title=...`
- [x] Render ideas.md prose sections
      Render `ideas.md` prose sections (parsed client-side, split on `---`) alongside idea-status plans in the sidebar and list view's "Ideas" grouping
- [x] Add project icon upload
      Project icon upload in Settings (`GET`/`POST /api/icon`, stored at `.paper-camp/assets/icon.<ext>`), shown in the nav island and Plans sidebar
- [x] Source project name from package.json
      Project name in nav/sidebar sourced from this repo's own `package.json` (`/api/package-name`), replacing the hardcoded "Paper Camp" fallback
