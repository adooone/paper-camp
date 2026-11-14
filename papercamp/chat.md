### Thread
- [x] 2026-11-08T19:42 [question] [agent] [[IDEA-328]] Run-all parked on phase 4 ("Hosted client first paint") — the agent needs a decision: May I download the Cormorant Garamond and Caveat woff2 files from Google Fonts into public/fonts?
      option: Allow the download — I fetch the woff2 files, add @font-face with swap, drop the Google links, finish the phase
      option: You add the font files — I write @font-face and edit index.html once the files are in public/fonts
      context: The Google Fonts request was blocked by the permission classifier, and no copy of these fonts is in the repo or node_modules. The immutable cache header and the chunk split are done.
- [x] 2026-11-14T09:57 [chat] What is running right now, and which ideas are still open?
- [x] 2026-11-14T09:57 [chat] [agent] Right now only IDEA-324 is actually running (run-all, on phase 4); the rest of the live list is finished runs. Still open: IDEA-324 (in-progress), IDEA-323 and IDEA-329 (in review, waiting on your approve-and-close), and IDEA-325 and IDEA-331 (planned, not started). Everything else is done or dropped.
