### Thread
- [x] 2026-11-08T19:42 [question] [agent] [[IDEA-328]] Run-all parked on phase 4 ("Hosted client first paint") — the agent needs a decision: May I download the Cormorant Garamond and Caveat woff2 files from Google Fonts into public/fonts?
      option: Allow the download — I fetch the woff2 files, add @font-face with swap, drop the Google links, finish the phase
      option: You add the font files — I write @font-face and edit index.html once the files are in public/fonts
      context: The Google Fonts request was blocked by the permission classifier, and no copy of these fonts is in the repo or node_modules. The immutable cache header and the chunk split are done.
