# Changelog

All notable changes to this project will be documented in this file.

## [0.8.0](https://github.com/adooone/paper-camp/compare/v0.7.0...v0.8.0) (2026-07-15)


### Features

* **app:** Add the needs-review queue ([e294e3f](https://github.com/adooone/paper-camp/commit/e294e3f3d6c2537d185bbcd47662b7c68fb8b598))
* **app:** Build the ambient header status cluster ([814676e](https://github.com/adooone/paper-camp/commit/814676e5d1b719d9288bff0a2872d04187cb912a))
* **app:** Course-correct focus cockpit, restore Stack panel ([ab100a3](https://github.com/adooone/paper-camp/commit/ab100a313d551a888a4fbfec3a593a6d0bd95ff6))
* **app:** Expose suggestions over the API ([ae74238](https://github.com/adooone/paper-camp/commit/ae742389a2530fe47346cef009e3ce3757e47a7c))
* **app:** Let agents append suggestions ([229f1d0](https://github.com/adooone/paper-camp/commit/229f1d03b52e8883ebbc8e136b46190cf88f40ba))
* **app:** Let fix-review agents propose commits and hint the SSE stream ([147b37f](https://github.com/adooone/paper-camp/commit/147b37f0a413fb498c6add0a8d41a2c7d7ee3924))
* **app:** mark IDEA-39 review ([1da445b](https://github.com/adooone/paper-camp/commit/1da445b742ab0a1bb483f74b34a2204e1b4a85d1))
* **app:** Parse the suggestions store ([2024f70](https://github.com/adooone/paper-camp/commit/2024f709dd14a05681d2bb46a7954d68ed96d7eb))
* **app:** Promote a suggestion to a real idea ([d30cf1e](https://github.com/adooone/paper-camp/commit/d30cf1e31c778cf8a7d29a0354392b33e2642482))
* **app:** Render the "Suggested from AI" section ([7d490cf](https://github.com/adooone/paper-camp/commit/7d490cf8d496327d34b44f81725a48baf3a2a4a8))
* **app:** Render the focus plan hero card ([154b222](https://github.com/adooone/paper-camp/commit/154b222300dcccf0376aed7381850a9b80123fcf))
* **app:** Slim the Stack panel to a git/activity drawer ([1eb78ba](https://github.com/adooone/paper-camp/commit/1eb78ba56c8e2f6bd7ffda5a34a037d48ebb3b9f))
* **app:** Summon commit from the header ([62daa9b](https://github.com/adooone/paper-camp/commit/62daa9bc642768cf577c2e6c2cf2647e54be4f7b))
* **app:** Type-check and visual pass ([7061f82](https://github.com/adooone/paper-camp/commit/7061f821979b770a251ff5045470c6239bee93c4))
* **app:** updates ([e2fca0c](https://github.com/adooone/paper-camp/commit/e2fca0c8d6ef048806db3b9e1f82599911665da0))
* **app:** updates ([57a7fd5](https://github.com/adooone/paper-camp/commit/57a7fd5c300389622ae8c663ef8f93d80debe81a))
* **ci:** Auto-label PRs from kind and tags ([55aa66a](https://github.com/adooone/paper-camp/commit/55aa66a77b52a0822716bba62bae6e19fa13720f))
* **ci:** Build the plan↔PR resolver helper ([0a6a351](https://github.com/adooone/paper-camp/commit/0a6a351ac9a31a9152defe1901d17d073eb5e942))
* **ci:** Flip PR readiness from phases and the dropped override ([1180c35](https://github.com/adooone/paper-camp/commit/1180c35510b06bcfbaca035851143ad480bb05c1))
* **ci:** Post consistency checks as a PR comment ([8e367fe](https://github.com/adooone/paper-camp/commit/8e367fe386c8d9acab259ce508a85f0939b76441))
* **ci:** Render plan phases as a PR task list ([6142ab5](https://github.com/adooone/paper-camp/commit/6142ab57de9deb464917b91a5f80b22ceb1fbdc2))
* **plans:** Revert focus-plan hero card, keep list uniform ([3dbfcbe](https://github.com/adooone/paper-camp/commit/3dbfcbee409faccc7ca44cc6d81ac66dea8da717))
* **plans:** Revert focus-plan hero card, keep status bar quick-commit ([cc0b1d4](https://github.com/adooone/paper-camp/commit/cc0b1d4f237feb02773761f9468b82774f48b1d2))
* **plans:** Revert focus-plan hero, wire status bar to quickCommit ([26046c5](https://github.com/adooone/paper-camp/commit/26046c56994949750c89a80e14db4b3eec926d15))


### Bug Fixes

* **app:** Address PR review findings for IDEA-61 ([4465736](https://github.com/adooone/paper-camp/commit/4465736eb63f8d5068354994319baec1526a663e))
* **app:** Extract agent-launch error handling and fix suggestion-line matching ([b2679c3](https://github.com/adooone/paper-camp/commit/b2679c3496d1c7bb3da12160469eff34f38479bf))
* **app:** Move status bar separator to bottom edge ([10e9b0f](https://github.com/adooone/paper-camp/commit/10e9b0f4b32c62a0545b7e88f707ec082e43bff6))
* **app:** Respect reduced-motion preference in refresh button ([6ccdce3](https://github.com/adooone/paper-camp/commit/6ccdce3d8a6209b696af491677dba79a801852f5))
* **app:** Settle review threads right after fix-review finishes ([c3994bb](https://github.com/adooone/paper-camp/commit/c3994bb7b581481816f6cb77623f9ca683a5b29d))
* **core:** Fix phase-body replacer and PATCH flag in PR sync ([ef9e074](https://github.com/adooone/paper-camp/commit/ef9e074241c4c321e02a1e6c9d362484dc3d5f52))
* **server:** Lock API to trusted hosts and stop leaking env secrets ([fb786f9](https://github.com/adooone/paper-camp/commit/fb786f95ac70f4546dce66963cbf79563c294350))


### Code Refactoring

* **app:** (Stretch) Client render + bundle ([72cf7d6](https://github.com/adooone/paper-camp/commit/72cf7d6e55e8930a73886f61e0046360665d6a13))
* **app:** Cache the parsed corpus off the existing watcher ([eb65354](https://github.com/adooone/paper-camp/commit/eb6535499c94304d8f073f9453df3e1f31db91c9))
* **app:** Capture baseline endpoint timings ([bf335ce](https://github.com/adooone/paper-camp/commit/bf335ce7b5747bbdb9df07bc115a6899bd7dd258))
* **app:** Coalesce the SSE-driven refetch ([a8e8345](https://github.com/adooone/paper-camp/commit/a8e8345568311d69c17f6e95d711a3f26e767ce7))
* **app:** Codify the layout rule in the style guide ([03689ab](https://github.com/adooone/paper-camp/commit/03689abb948c8573b11729125861ee04dfcaa952))
* **app:** Consolidate the inline icon/glyph SVGs ([0729008](https://github.com/adooone/paper-camp/commit/0729008abf35db6450051aee06a9da2c83316b83))
* **app:** De-dupe imports, assets, and dead code across the app ([8f42476](https://github.com/adooone/paper-camp/commit/8f42476ae78b1ec3ad69848cce9c60aad71733b8))
* **app:** Extract the check-status derivation into one helper ([40b4c22](https://github.com/adooone/paper-camp/commit/40b4c22a1ebcce06be8f40398d6068366f6589f0))
* **app:** Group `core` into domain subfolders ([46bdc9a](https://github.com/adooone/paper-camp/commit/46bdc9a5bab16653a2419b745a16db07c7151f3a))
* **app:** Group `features/plans/components` into domain subfolders ([382ae35](https://github.com/adooone/paper-camp/commit/382ae35030f7c58e2f04dfe4f727fc85ab6f9cc0))
* **app:** Group the remaining wide folders ([d6a98f0](https://github.com/adooone/paper-camp/commit/d6a98f0f11bca293cac25d8d4bafdf7ef34b4fb2))
* **app:** Inventory the load-bearing comments to preserve ([245feed](https://github.com/adooone/paper-camp/commit/245feed40c9dc80abdca7044a8f99558f430195c))
* **app:** Parallelise the corpus read ([00f3f7e](https://github.com/adooone/paper-camp/commit/00f3f7ed4af098605fd237d792befc80a53800ff))
* **app:** Parallelise the git status spawns ([7bb9a7b](https://github.com/adooone/paper-camp/commit/7bb9a7b8e058482bab33b39f4ba6598591da6d45))
* **app:** Prune the dead exports knip flags ([4a2b669](https://github.com/adooone/paper-camp/commit/4a2b6691f702ded8bb4b53e6cb09fb6c5246031e))
* **app:** Restyle status bar, fix sticky sidebar, tighten comments ([cd6a00f](https://github.com/adooone/paper-camp/commit/cd6a00ffaf0f2fef60938446b45c424b4ab9e222))
* **app:** Rewrite CODE_STYLE.md §7 to the firmer bar ([10167da](https://github.com/adooone/paper-camp/commit/10167da88b0de046b02dbf8fb54a2adef6ddab5b))
* **app:** Route the action pattern through `usePlanStatusPatch` ([ea50558](https://github.com/adooone/paper-camp/commit/ea505584d3ad6a53851aaf626ec126835d0b73a0))
* **app:** Run the acceptance gate ([fb416b2](https://github.com/adooone/paper-camp/commit/fb416b24b38c38c1507433d6eb44781b780e5d72))
* **app:** Split `stack-panel.tsx` into per-section components ([baa5088](https://github.com/adooone/paper-camp/commit/baa5088f15118d443893bc7dd4ea1f00eb7c04b1))
* **app:** Sweep `src/app` ([369a725](https://github.com/adooone/paper-camp/commit/369a725f597324be8acf930caf550ff90b1dbc6e))
* **app:** Sweep `src/app` for style-guide conformance ([2f66198](https://github.com/adooone/paper-camp/commit/2f66198d98318ca375101ab70a8aa1364dbed476))
* **app:** Sweep `src/core` ([390660b](https://github.com/adooone/paper-camp/commit/390660b662c9eca8f69f6c266a437967fea717ce))
* **app:** Sweep `src/server` and `src/agents` ([c2427a1](https://github.com/adooone/paper-camp/commit/c2427a1abd31ae046e78d955484710b59b776ec6))
* **app:** Untangle the two import cycles ([ab60d62](https://github.com/adooone/paper-camp/commit/ab60d624d244c0aa25f0f1ae4ec075c21d13fdd1))
* **app:** updates ([380a78a](https://github.com/adooone/paper-camp/commit/380a78af575cd8e705f17b0c5e97e0859528e475))
* **app:** updates ([7de331b](https://github.com/adooone/paper-camp/commit/7de331b44d3231d2228f2891b84ce12b844ab5ce))
* **app:** updates ([60c3dda](https://github.com/adooone/paper-camp/commit/60c3ddacfe62b14079527621eb8d233dfeb8390f))
* **app:** updates ([43822ba](https://github.com/adooone/paper-camp/commit/43822ba5ffce0a04a7eb2794f15beb1363a8b584))
* **app:** Verify the check suite stays green ([8ae40d4](https://github.com/adooone/paper-camp/commit/8ae40d4d2ea0f27e74c616b0123111bf2fa4b95c))
* **app:** Verify the check suite stays green ([ab6e949](https://github.com/adooone/paper-camp/commit/ab6e949e701173b732e93ced9827408c42bfbc57))
* **plans:** Restructure features/plans by role, not domain ([39fc8da](https://github.com/adooone/paper-camp/commit/39fc8da03e4315713e797c75b3f89faab11a2b9e))

## [0.7.0](https://github.com/adooone/paper-camp/compare/v0.6.0...v0.7.0) (2026-07-11)


### Features

* **app:** Add the AI Check-overlap action ([71a0975](https://github.com/adooone/paper-camp/commit/71a09758a93410170c92331c99396af12751bce8))
* **app:** Add the fix-review prompt builder ([05f30c0](https://github.com/adooone/paper-camp/commit/05f30c0548a6a8da4ba0aea7794bc543f0300034))
* **app:** Build the keyword similarity matcher ([004741d](https://github.com/adooone/paper-camp/commit/004741d91bc2954e5d5ed040701e1ea6b6787172))
* **app:** Carry review signal in the PR resolver ([c96c084](https://github.com/adooone/paper-camp/commit/c96c0845daf483b1f40bceaa678966a939aec57d))
* **app:** Draft IDEA-57 and a11y-fix collapsible-text toggle ([d885f04](https://github.com/adooone/paper-camp/commit/d885f045b259748a4c13c3acc48595dbc9af8a46))
* **app:** Generalize the dashboard job queue ([f29592f](https://github.com/adooone/paper-camp/commit/f29592fc94843c3d97ee2b90180d658c4d1741b4))
* **app:** Harden fix-review flow with push verification and UI polish ([910698c](https://github.com/adooone/paper-camp/commit/910698c12d3c478a8da030214e47a2607a734ac1))
* **app:** Launch a "fix review comments" job ([c3b3be6](https://github.com/adooone/paper-camp/commit/c3b3be63117a751587b4cfb24585e84275e39e3a))
* **app:** mark IDEA-44 review ([6cdf9cd](https://github.com/adooone/paper-camp/commit/6cdf9cdb0c3360bdeb1b310dfc2187a4021fb6cf))
* **app:** mark IDEA-57 review ([fb94bf2](https://github.com/adooone/paper-camp/commit/fb94bf2ec9f024dc55ee535879bb8a57f5e1131a))
* **app:** Render the Similar-ideas strip in the New-idea modal ([0c5ddef](https://github.com/adooone/paper-camp/commit/0c5ddeff8c34689f99b0ea3578c3478678bbc2f6))
* **app:** Surface review state on the plan card ([340d668](https://github.com/adooone/paper-camp/commit/340d668449a502e6afd6a0d282785148a53d18f2))
* **app:** Type-check and verification pass ([a0afad3](https://github.com/adooone/paper-camp/commit/a0afad3a0ebc602b3155f5d4c5f1b040dee13a30))
* **app:** Type-check and visual pass ([03b3dd6](https://github.com/adooone/paper-camp/commit/03b3dd6606498e22196c0fc7c053e7748ccfab81))
* **app:** Type-check and visual pass ([a8e250e](https://github.com/adooone/paper-camp/commit/a8e250e403528b45c60b50efa3d03ddc4be11cc4))
* **app:** Wire the Extend-instead and Draft-plan actions ([8262a66](https://github.com/adooone/paper-camp/commit/8262a660e517943333b73a9a38abea9457480dc5))
* **ideas:** Derive status from PR id match, not local branches ([13868c2](https://github.com/adooone/paper-camp/commit/13868c2b21398c57d6d4bef7f02bb4b372ab0118))
* **plans:** Simplify entity detail header and plan actions ([ef382c9](https://github.com/adooone/paper-camp/commit/ef382c99599695bcfc5334c8bc74161f4850393e))


### Bug Fixes

* **app:** Address CodeRabbit review findings on IDEA-56 ([abee40b](https://github.com/adooone/paper-camp/commit/abee40bc094120e69aeef482639ab58db7b46b65))
* **app:** Disable green accent-button icon tint when disabled ([692a62e](https://github.com/adooone/paper-camp/commit/692a62e01e8183d25ee3cb493dd4b2009191c2ad))
* **app:** Fix a11y lint issues in overlap-check and plans loading ([6a6e24a](https://github.com/adooone/paper-camp/commit/6a6e24a88ddc18817be3a306751dbad4650bd725))

## [0.6.0](https://github.com/adooone/paper-camp/compare/v0.5.0...v0.6.0) (2026-07-08)


### Features

* **app:** Absorb the toolbar into the card ([a524eea](https://github.com/adooone/paper-camp/commit/a524eea834e5e01e53b2f6a02973a8fb0c9b43b4))
* **app:** Actualize the docs and closing pass ([0ba0d54](https://github.com/adooone/paper-camp/commit/0ba0d545cd22a6dc5fb15977920cc0b7162699ee))
* **app:** Add kind note and status asymmetry to the schema ([27dae3b](https://github.com/adooone/paper-camp/commit/27dae3bf69466e51a99ac2ab4468460d6ec7053b))
* **app:** Add param routes for plans, ideas, and docs ([2ec2189](https://github.com/adooone/paper-camp/commit/2ec2189af30190b7d8068d4aa7e4924a226011f3))
* **app:** Add tag chips and search ([67e914a](https://github.com/adooone/paper-camp/commit/67e914a7010c78240df4634655e5c84404377293))
* **app:** Add the Actualise-all button ([7d726ec](https://github.com/adooone/paper-camp/commit/7d726ec740d20f1c0989b4acf4ac946f2048fde1))
* **app:** Add the sort control ([70ce834](https://github.com/adooone/paper-camp/commit/70ce834223ca4b0caadc0a51b208cab67712e68f))
* **app:** Bound the closed plans section ([e8ad156](https://github.com/adooone/paper-camp/commit/e8ad15699cd3e7a72c871acf12ad5eb1b415ffdd))
* **app:** Build the batch reconcile sweep ([9b0297b](https://github.com/adooone/paper-camp/commit/9b0297bdb4d3fb38590cc8f820edc6ba78c3255f))
* **app:** Build the filter/sort selector and flat list ([f583fa2](https://github.com/adooone/paper-camp/commit/f583fa2686b06866aedea5a3a7cde38d9e3c0356))
* **app:** Build the group-aware tree selector ([31914bb](https://github.com/adooone/paper-camp/commit/31914bbb13bc7103b7b505266698919798dd562c))
* **app:** Build the queue review UI ([3e77cf0](https://github.com/adooone/paper-camp/commit/3e77cf03684f58843328cc7e3451343396b3c6b1))
* **app:** Build the sticky filter card with status chips ([1faaf5f](https://github.com/adooone/paper-camp/commit/1faaf5ff71f182c404220fcb5060b8b10ae5895a))
* **app:** Compress the plan detail preamble ([e68d36e](https://github.com/adooone/paper-camp/commit/e68d36ec8ba5d7c127aa2ca13aa2611e8b935bb3))
* **app:** Derive selection state from the URL ([6ffee04](https://github.com/adooone/paper-camp/commit/6ffee04a86d2f2b14fda6f57f9b159791b5330f4))
* **app:** Fold Review into the Plans route ([1d68b6c](https://github.com/adooone/paper-camp/commit/1d68b6ce1cacd821dc7a1419a3aa8ab64bfd0315))
* **app:** Generalize the reconcile prompt for ideas ([6b26141](https://github.com/adooone/paper-camp/commit/6b261415b9205ed2cd537418568089886ae28d80))
* **app:** Give ideas the dated Log grammar ([a1838c4](https://github.com/adooone/paper-camp/commit/a1838c4c745c7288fa5e99dea8c98951b1576bcd))
* **app:** Land Docs on the README ([540b0ab](https://github.com/adooone/paper-camp/commit/540b0abe0926f9631ae2ea47d2d38e2799d1a1de))
* **app:** Make branch management manual, bump paper-ui, restyle plan actions ([1879cbf](https://github.com/adooone/paper-camp/commit/1879cbf323e7d0c0d1636fe757d75f76cf741bc0))
* **app:** Move list actions into the list header ([15b4a15](https://github.com/adooone/paper-camp/commit/15b4a15b113082db67b696b87ca2bd5617859586))
* **app:** Pin stack panel and rebalance layout at wide viewports ([bb75056](https://github.com/adooone/paper-camp/commit/bb75056516086961955e9f7639c9960c6042f36a))
* **app:** Re-key git surfaces and merge idea/plan UI into one entity view ([260db93](https://github.com/adooone/paper-camp/commit/260db93fdde5e0494c7a1c73c85c1e4042b4b2fa))
* **app:** Render the unified two-level worklist ([87f84ea](https://github.com/adooone/paper-camp/commit/87f84ea97045770335f1ae667a0afb939a9e38b2))
* **app:** Replace back buttons with Breadcrumb ([637496a](https://github.com/adooone/paper-camp/commit/637496aba3b1b716f7b669ea96e7c7136712989c))
* **app:** Replace the plans sidebar's duplicate lists ([86ac698](https://github.com/adooone/paper-camp/commit/86ac69829b31c3d7d148e96b6d889832d7938337))
* **app:** Retire the app's Audit-all path ([45c39a3](https://github.com/adooone/paper-camp/commit/45c39a3ccaf34718df8e546234feee79f1d6e24f))
* **app:** Retire the ideas route and rename creation paths ([095050a](https://github.com/adooone/paper-camp/commit/095050ab6f3dba5c1d48c9107fd2e7b87413d24f))
* **app:** Rework the ideas board into full-width rows ([6d5b281](https://github.com/adooone/paper-camp/commit/6d5b281682ecc8c868097d301bc7fdc01c21bac9))
* **app:** Split plans and ideas onto separate routes ([735903b](https://github.com/adooone/paper-camp/commit/735903bf068982f3ab563bd73fcf8ad51c1659e9))
* **app:** Turn the reconcile slots into a queue ([dd47b64](https://github.com/adooone/paper-camp/commit/dd47b6402082980862638c33a1f460f262364b34))
* **app:** Type-check and visual pass ([39bbd4d](https://github.com/adooone/paper-camp/commit/39bbd4d578a191b9351821c10f75b27560ad2114))
* **app:** Type-check and visual pass ([f8ffa81](https://github.com/adooone/paper-camp/commit/f8ffa81f7b441047f998ab352d04fac91aeda4fd))
* **app:** Type-check and visual pass ([003fe35](https://github.com/adooone/paper-camp/commit/003fe3593f2f18afa251c6994acdeb767d15338f))
* **app:** Type-check and visual pass ([327e004](https://github.com/adooone/paper-camp/commit/327e0043b18222e0bbb5787b7e4cee790806834c))
* **app:** Type-check and visual pass ([e941301](https://github.com/adooone/paper-camp/commit/e941301e4067c1858de8e276e1b93362097cff24))
* **core:** Add optional-phase entity schema for idea/plan merge ([c462b3b](https://github.com/adooone/paper-camp/commit/c462b3b77f2b59fd0b7a657b445f1adf873a4f49))
* **ideas:** Renumber ideas, archive plans, bump idea counter ([dd51146](https://github.com/adooone/paper-camp/commit/dd51146e0323bceab457266d1165465ae36843c1))
* **plans:** Convert plans list to dense row cards ([3462d47](https://github.com/adooone/paper-camp/commit/3462d47c579ed3f8527d8d210eee63536b951ba6))
* **plans:** Keep sort control visible and add empty-filter state ([b5c3f14](https://github.com/adooone/paper-camp/commit/b5c3f14e28a55eeab5d6605e7ad79525ff3294ef))
* **plans:** Mark FEAT-37 done and archive its plan ([b8f28c6](https://github.com/adooone/paper-camp/commit/b8f28c6d81ae48b6d00a73765f97b32aad3b7bb6))
* **plans:** Split filter card into header and column ([704b270](https://github.com/adooone/paper-camp/commit/704b270ce70e32767dd2037c7c459d4db2b775df))
* **server:** Migrate readers, routes, and CLI to unified entity corpus ([a88f803](https://github.com/adooone/paper-camp/commit/a88f80301b864f67a867177b58049996a2383e45))


### Bug Fixes

* **app:** Give the phases-header tools button affordance ([dd74e06](https://github.com/adooone/paper-camp/commit/dd74e06f59c6ea17310d4ac97dc9ba4b6ada7755))
* **app:** Label the agent matrix ([e005dfc](https://github.com/adooone/paper-camp/commit/e005dfc006e5a8e7add972a38812f2030894959f))
* **app:** Replace window.confirm with a Modal ([3801a2c](https://github.com/adooone/paper-camp/commit/3801a2c5ffcfbf4408ef3317a3e9ed875f0312a8))
* **app:** Retire the color-override classes ([1b6e37d](https://github.com/adooone/paper-camp/commit/1b6e37da907aec1c3bdbb1286386558d0850866f))
* **app:** Surface update failures and relax close branch guard ([b7cd273](https://github.com/adooone/paper-camp/commit/b7cd2733e16074f6e9c7621d2a9f96f992b4b062))
* **app:** Type-check and visual pass ([1f6b4e8](https://github.com/adooone/paper-camp/commit/1f6b4e883b59db0391bcf3b2801ae663e17b7fbc))
* **app:** Unify settings persistence on save-on-change ([caa4b2e](https://github.com/adooone/paper-camp/commit/caa4b2e0045cbf92d5ea3c83f730a38c43e87d30))
* **plans:** Fix idea/plan modal error handling and pagination edge cases ([7015970](https://github.com/adooone/paper-camp/commit/70159701e01dc653679432cda8ba34bf3779ffc6))
* **plans:** Point phase-copy prompt at unified entity file path ([0e69421](https://github.com/adooone/paper-camp/commit/0e694212cbe228334f03283b20d7a9341d4990f1))
* **plans:** Shrink delete icon button to match row height ([f6d2c56](https://github.com/adooone/paper-camp/commit/f6d2c56e6529f9a93a10b4e64087020f0f9339a1))
* **plans:** Use fontSize.xs token instead of hardcoded rem value ([9e60750](https://github.com/adooone/paper-camp/commit/9e60750281967e39c86e50ef2b21652c0ba6a012))


### Code Refactoring

* **docs:** Extract shared DocsBreadcrumb component ([9df9ab3](https://github.com/adooone/paper-camp/commit/9df9ab3a549b0e9c347eade4f39a5f610a9982a9))
* **docs:** Share docs-section fallback logic in one hook ([756e9a9](https://github.com/adooone/paper-camp/commit/756e9a9b0002938227c3f1ac1102f8de06242570))
* **plans:** Collapse Plans page to a single filterable list ([e42d7d7](https://github.com/adooone/paper-camp/commit/e42d7d7c819483a2cddc77ab3238f7a434649439))


### Documentation

* **ideas:** Close IDEA-55 and archive IDEA-40 as done ([9fd15cf](https://github.com/adooone/paper-camp/commit/9fd15cfb82ec1db56cd2ed92030701f2aebd04c0))
* **ideas:** Mark IDEA-40 in-progress and IDEA-41 in review ([ab35cba](https://github.com/adooone/paper-camp/commit/ab35cba107a0381b6be44f836efebaa32625e5f2))
* **ideas:** Mark IDEA-41 done and archive it ([036dfc2](https://github.com/adooone/paper-camp/commit/036dfc22fffe14e30f19dc64317ee64aafd63b01))

## [0.5.0](https://github.com/adooone/paper-camp/compare/v0.4.0...v0.5.0) (2026-07-04)


### Features

* **agent:** updates ([f5cfdb3](https://github.com/adooone/paper-camp/commit/f5cfdb37047bf744fcbc1ba08d52fccb801b8121))
* **app:** Add accessibility and stability fixes across layout components ([7949962](https://github.com/adooone/paper-camp/commit/7949962ddea7b5a72918ac1ac561b7ecf04b3bf2))
* **app:** Add responsive breakpoints to the root layout ([fd97128](https://github.com/adooone/paper-camp/commit/fd97128937d61f50db64d524e03efe69d9119b1d))
* **app:** Adopt CopyButton and Divider ([61de4e5](https://github.com/adooone/paper-camp/commit/61de4e5dae17cc825f320de8685c703cebd3a707))
* **app:** Audit texture props and font-size token coverage ([9b6fcee](https://github.com/adooone/paper-camp/commit/9b6fcee508aca2f10d5015624bec8843b375bc2f))
* **app:** Bump to ^0.5.0 and inventory the breakage ([01e19d0](https://github.com/adooone/paper-camp/commit/01e19d04a92b2c76d6dfefcc2c5e08c9b9cd1881))
* **app:** Default the Stack panel to closed and persist the choice ([0ea24cc](https://github.com/adooone/paper-camp/commit/0ea24ccc3ed28f45d963706da84a518ae0a4e8ce))
* **app:** Evaluate the opportunistic adoptions ([7d88820](https://github.com/adooone/paper-camp/commit/7d888200c1b0c94db584306a969c73ae2cea30b2))
* **app:** Give the Stack panel the full right edge ([ae5b1b7](https://github.com/adooone/paper-camp/commit/ae5b1b7399c10b42925dcff7b0f9d3cb007c9bf9))
* **app:** Move global navigation into a Layout header and remove the nav island ([2183441](https://github.com/adooone/paper-camp/commit/2183441a0a76386103b481d2ff8b92f5314403bd))
* **app:** Redesign the Stack panel Commit section with a bounded scroll region ([5266803](https://github.com/adooone/paper-camp/commit/5266803d0e2c3feebdf32f0c3222d2623b199aee))
* **app:** Reflow the Alerts for the compact layout ([832de6f](https://github.com/adooone/paper-camp/commit/832de6f44c38c45710c068b3a03b5962377964c1))
* **app:** Remove island clearance hacks ([3b5ee8a](https://github.com/adooone/paper-camp/commit/3b5ee8a36c54ac1234f278ad3a5c5fdad7af9124))
* **app:** Replace title attributes with Tooltip ([6feeb2b](https://github.com/adooone/paper-camp/commit/6feeb2b20a0e4ae5371e16026de0d8162a22efc3))
* **app:** Simplify the Agent card to a title and one status line ([fd06b09](https://github.com/adooone/paper-camp/commit/fd06b09551305cf1d41faa6fee1b6f313364985a))
* **app:** Swap the custom loaders for Spinner and Skeleton ([41f0667](https://github.com/adooone/paper-camp/commit/41f0667b24215d0c88853c294112578a3d889eff))
* **app:** Sweep chalkboard variant to the surface prop ([86be5c9](https://github.com/adooone/paper-camp/commit/86be5c9d5d2b6a7510982980f9bbcfd978d588d4))
* **app:** Type-check and visual pass ([5d64de2](https://github.com/adooone/paper-camp/commit/5d64de2d710ba882e58eeab6178d7912d004582d))
* **app:** Type-check and visual pass ([902ff14](https://github.com/adooone/paper-camp/commit/902ff1469a564cf466723a2a3076cb3d4fc729ea))
* **app:** updates ([00123ea](https://github.com/adooone/paper-camp/commit/00123ea216569f2943c5deb7dd566f93ac96fa84))
* **app:** Visual verification pass across viewport widths ([0193e91](https://github.com/adooone/paper-camp/commit/0193e9110c26f0b4c5b187ffc4bca5cd92a915fb))
* **app:** Wire Toast and surface action failures ([fe3fa7e](https://github.com/adooone/paper-camp/commit/fe3fa7ed5a11fc44c1f2ea2eb14eab92ea6f25d2))
* **audit:** Add audited-hash to frontmatter schema ([9f1316e](https://github.com/adooone/paper-camp/commit/9f1316e83d0aa8ae93c53f26d4bf6185da529fd1))
* **audit:** Implement hash computation helper ([dc95a98](https://github.com/adooone/paper-camp/commit/dc95a98d1f85bc1b590b9d403a2b0560ea6ca2ac))
* **audit:** Replace freshness checks with hash comparison ([87ee28a](https://github.com/adooone/paper-camp/commit/87ee28a8a077f54c9377566c8cbf5372b8dbab73))
* **audit:** Tests ([ccf7f15](https://github.com/adooone/paper-camp/commit/ccf7f153fecff4dbe30bb6c61557d5a33a383e64))
* **audit:** Thread hash through stamp functions ([1cab64a](https://github.com/adooone/paper-camp/commit/1cab64a076cd22f1c56286d0d221b790afb1fe3b))
* **audit:** Update parser and serializer round-trip ([bfc0f8c](https://github.com/adooone/paper-camp/commit/bfc0f8c56a4326c48913b1f674d109d9c6860ae8))
* **cli:** Add the git post-commit auto-logger ([bba2c7c](https://github.com/adooone/paper-camp/commit/bba2c7ce02d24f3358cc016ec93299547358d4cc))
* **cli:** Add the opt-in PostToolUse hook ([e208ab7](https://github.com/adooone/paper-camp/commit/e208ab72b6be01621895615622d62bf80ae023a5))
* **cli:** Add the SessionStart focus hook ([048e57d](https://github.com/adooone/paper-camp/commit/048e57d2ea206ae2ec3b94c4f93ae4b6795e7578))
* **cli:** Document the integration and verify end-to-end ([11678ae](https://github.com/adooone/paper-camp/commit/11678ae8f0e28c80e8ab51a0c7b467a3dd4f4890))
* **cli:** Scaffold all four surfaces from `paper-camp init` ([78c1f7f](https://github.com/adooone/paper-camp/commit/78c1f7f1319a50164aec04ab89fb85b497cba749))
* **cli:** updates ([44da253](https://github.com/adooone/paper-camp/commit/44da253fb64f77df464a5f95a75723249f989713))
* **cli:** updates ([5a1d018](https://github.com/adooone/paper-camp/commit/5a1d018d4ceabd50f9d07dae69e33d331932cd7e))
* **cli:** updates ([bd8e5bc](https://github.com/adooone/paper-camp/commit/bd8e5bc41fc419b63c96cacf47d19a8b78e633d1))
* **cli:** updates ([c4e264b](https://github.com/adooone/paper-camp/commit/c4e264b47c9caf1b818eb25afb5805bb07fc52d7))
* **ideas:** Add explicit status field for planless ideas ([6ca3a0d](https://github.com/adooone/paper-camp/commit/6ca3a0dc35cb23d91fc379c8695969fcdcac2854))
* **plans:** Mark FEAT-32 done and archive plan file ([3befdd2](https://github.com/adooone/paper-camp/commit/3befdd233e5ebc955f9744a98cc0d1edd6b9372d))
* **repo:** updates ([434151d](https://github.com/adooone/paper-camp/commit/434151dcc36eb39442023136952708dac03c0c2d))
* **server:** Add the MCP SDK and `paper-camp mcp` entry point ([117bdef](https://github.com/adooone/paper-camp/commit/117bdef16990fd9db77f0692a8c738b9ff5515bb))
* **server:** Document registration and the MCP surface ([3123cb0](https://github.com/adooone/paper-camp/commit/3123cb043d9723dddcc16e7a98b00787f6ed2f88))
* **server:** Enforce the branch-conflict guard on plan-advancing writes ([85f5bf1](https://github.com/adooone/paper-camp/commit/85f5bf1d49d75be3489b0af3f5d7bbdec8f90d0e))
* **server:** Map the read tools onto core readers ([ca9a8c6](https://github.com/adooone/paper-camp/commit/ca9a8c6c703eb35222573721018e7a2ea2ee7320))
* **server:** Map the write tools through the guarded core ([b1504a0](https://github.com/adooone/paper-camp/commit/b1504a0cf4ee8d8959aa4eb55addbe5d7de66d62))
* **server:** Serialize id-allocating MCP writes and surface start errors ([63d4c96](https://github.com/adooone/paper-camp/commit/63d4c96ccc42740b41d4b8dd38e69c2b18272ef8))
* **server:** Tests for the tool handlers and guard enforcement ([eace328](https://github.com/adooone/paper-camp/commit/eace32889ae7cb19b9dde26e3d5633ebfcfafd3a))


### Documentation

* **ideas:** Refresh backlog ideas after FEAT-34 landed ([6d310b9](https://github.com/adooone/paper-camp/commit/6d310b9445155051ac6e0c0a3c21fc9b21e0926c))
* **plans:** Mark FEAT-31 done and archive plan file ([4c7bc7d](https://github.com/adooone/paper-camp/commit/4c7bc7dc96e350befb6ee716b039c991e3c75582))
* **plans:** Mark FEAT-34 and FEAT-35 done and archive plans ([e08cb9e](https://github.com/adooone/paper-camp/commit/e08cb9e94d72eb5626f3d811eee2edc72ad969dd))
* **plans:** Mark FEAT-34 phase 5 done and move plan to review ([f59321c](https://github.com/adooone/paper-camp/commit/f59321c2e19dc7ce586d6283006b9754a2ca5717))

## [0.4.0](https://github.com/adooone/paper-camp/compare/v0.3.0...v0.4.0) (2026-07-02)


### Features

* **agent:** updates ([bf00b26](https://github.com/adooone/paper-camp/commit/bf00b264e62e8f6a4ee98eebc7caedab75f69b6f))
* **ideas:** Add IDEA-35/36, mark FEAT-27 review, tighten sync guards ([a5b8c5d](https://github.com/adooone/paper-camp/commit/a5b8c5d1a2f47d36b11a3b0dc30295324ecbc533))
* **plans:** Add launch route for reconcile tasks ([78b8b69](https://github.com/adooone/paper-camp/commit/78b8b696f75a88cde5a003a3e5a53360b09e1734))
* **plans:** Add Reconcile button to plan-detail.tsx ([b4f41a5](https://github.com/adooone/paper-camp/commit/b4f41a50010cc270db2361873f9b951a0f556a8b))
* **plans:** Add reconcile TaskKind and prompt ([95ac9af](https://github.com/adooone/paper-camp/commit/95ac9af4116deb40591fa0f3f06f6dcb835f7dc7))
* **plans:** Build diff/preview approval UI ([5efe1ac](https://github.com/adooone/paper-camp/commit/5efe1ac0f8ab5c6d67851b5f435dd37c4b6b97d9))
* **plans:** complete FEAT-30 run-all-phases implementation ([5a97451](https://github.com/adooone/paper-camp/commit/5a974511048ea9030e2738fadf6cc4b0c14cd46b))
* **plans:** Gate AuditPhasesButton to review/done status ([171b4dd](https://github.com/adooone/paper-camp/commit/171b4ddb79833db5a5f22a32cbb7b6227c5147f5))
* **plans:** Mark FEAT-28 done and archive plan ([af84ab2](https://github.com/adooone/paper-camp/commit/af84ab2d79acf55ed374319c029d80c6dd8a6330))
* **plans:** Optional deterministic pre-pass ([0927842](https://github.com/adooone/paper-camp/commit/092784295ee852f113a8b7231d2f7e3d081eb539))
* **plans:** updates ([4c02ebb](https://github.com/adooone/paper-camp/commit/4c02ebb1d1ff3eef682238b8873490654ea2a1c6))
* **repo:** updates ([9a2b36a](https://github.com/adooone/paper-camp/commit/9a2b36a1b0b6623625e6b7341557380f867f1924))


### Bug Fixes

* **app:** Reject reconcile launch when another plan has one pending ([0685c61](https://github.com/adooone/paper-camp/commit/0685c619f5d85cc08228b538e06a11b1aa419b36))
* **config:** Upgrade phase/commitSuggest agents to sonnet and fix config file newline ([d29b89b](https://github.com/adooone/paper-camp/commit/d29b89bb0b57a7ec7b1b6099a48137c627ef8cbb))
* **plans:** Fix reconcile state leaks and CI review triggers ([ad82f9c](https://github.com/adooone/paper-camp/commit/ad82f9cbc1bbe31c16cba3777e020ccc74ce6d77))
* **server:** disable git fs watchers in tests to stop CI teardown crash ([473f819](https://github.com/adooone/paper-camp/commit/473f819acea58df6015332eeea0445f2a6500bbb))


### Code Refactoring

* **app:** split api.ts into routes, readers, and agent-hooks modules ([3f9ddd9](https://github.com/adooone/paper-camp/commit/3f9ddd95160b71d839b6bf59e6be379c6cbd9f5e))


### Documentation

* **plans:** Correct file paths and phase details in FEAT-28/29/31/32/33 ([f5c60ee](https://github.com/adooone/paper-camp/commit/f5c60eeb345dac81e4d038086f671788302d5d1e))
* **plans:** Refresh FEAT-33 architecture doc for shipped storage migration ([bf93ab3](https://github.com/adooone/paper-camp/commit/bf93ab3f2f530e29d11b7cf398ff05b3c83e072d))
* **plans:** Rewrite agent prompts with clearer numbered task steps ([766e83b](https://github.com/adooone/paper-camp/commit/766e83b9eb1f67542c01bae7fdc8286cb5b52adb))

## [0.3.0](https://github.com/adooone/paper-camp/compare/v0.2.1...v0.3.0) (2026-07-01)


### Features

* **23:** Resolve open questions from Docs ([7a8179b](https://github.com/adooone/paper-camp/commit/7a8179b9183aa8f729ed72b3f30f26d023637244))
* **24:** Add push button to commit panel ([a1867ed](https://github.com/adooone/paper-camp/commit/a1867ed01b6bb7c05d27235e1d6e8d3f107654d3))
* **24:** Archive FEAT-24 and close IDEA-20 as done ([1520ab2](https://github.com/adooone/paper-camp/commit/1520ab27d314e7ea2b1d86c5ede5375ff94370a3))
* **24:** Make commit-suggestion agent configurable ([57cc445](https://github.com/adooone/paper-camp/commit/57cc445377e6e20df6ab5c580c8410710cb52129))
* **24:** Plan storage architecture ([3c3f849](https://github.com/adooone/paper-camp/commit/3c3f849650a4aee47f18906ab6c1b77091285a3e))
* **24:** Track commit-suggest as a visible agent task ([071219a](https://github.com/adooone/paper-camp/commit/071219ae93c632d470be8686c67af6ece2d19993))
* **cli:** updates ([201fe09](https://github.com/adooone/paper-camp/commit/201fe094ef2409832725d582c973bb1c103afe70))
* **plans:** Complete FEAT-25 batch audit — all phases done, status → review ([17a8f66](https://github.com/adooone/paper-camp/commit/17a8f6666bcc547026bd9fb9ffc72e47714ed532))
* **stack:** Use subsystem-area scopes and move plan id to Refs footer ([da665b7](https://github.com/adooone/paper-camp/commit/da665b7cba34dc833f2da2e6c1745c8bcac544ab))


### Bug Fixes

* **23:** Validate before writing in resolve-open-question handler ([b4481e4](https://github.com/adooone/paper-camp/commit/b4481e4259508726d569da78831ba54b0c57e8c7))
* **24:** Move push button to empty-changes state, drop Refs checkbox ([e6ec4d7](https://github.com/adooone/paper-camp/commit/e6ec4d78bb718647f992fe435cc6bddcca6830d9))
* **24:** Prevent stdin EPIPE crash and skip symlinks in untracked diffs ([ef47bb2](https://github.com/adooone/paper-camp/commit/ef47bb208e9d783615f6099d731786c0a1ef2ead))
* **24:** Read archived plan files and sync ideas/plans status to done ([70de972](https://github.com/adooone/paper-camp/commit/70de972f64f487ea66027e345f1da416b4511994))
* **24:** Use merged plan/idea readers and harden push, diff, and migration ([a0f7964](https://github.com/adooone/paper-camp/commit/a0f7964ee90ee80ce908686ebdb1106e897f45a1))
* **24:** Use merged plan/idea readers and harden push, diff, and migration ([a590a21](https://github.com/adooone/paper-camp/commit/a590a2108d4acb994e994ce98e4690551f2a07ce))
* **agent:** Harden batch audit — drain stderr, archived plans, branch guard ([20821be](https://github.com/adooone/paper-camp/commit/20821bea89d60be9502ccad7b535f7393221549b))


### Code Refactoring

* **feat-24:** Adapt prompts and activity to per-file plan storage ([a127f74](https://github.com/adooone/paper-camp/commit/a127f7482346f0828fe449754bd1cd54345d6e65))
* **feat-24:** Pass commit-suggest prompt via stdin for all agents ([290124c](https://github.com/adooone/paper-camp/commit/290124c846f98400b5ffb8c4a4465edef7163cdf))


### Documentation

* **docs:** Actualize about.md for per-file plan/idea storage ([f4663ef](https://github.com/adooone/paper-camp/commit/f4663efb4646504a32a893ae4f2e0c9c5660d054))
* **plans:** Archive completed plan and mark done in index ([15123ba](https://github.com/adooone/paper-camp/commit/15123bab2c09c6542a429f43024ece738d948812))
* **repo:** Remove CODE_STYLE.md and UX_PRINCIPLES.md from repo root ([f87993c](https://github.com/adooone/paper-camp/commit/f87993c505767ecd77ee1250c32df2ce6e02c43a))
* **repo:** Restructure repo-root docs ([f1076ed](https://github.com/adooone/paper-camp/commit/f1076ed30cad2e16ea5fdcb2d6b7076d5b9cc198))
* **repo:** Switch commit scope to subsystem areas and update per-file plan references ([5155b07](https://github.com/adooone/paper-camp/commit/5155b0707a16bcfde73bc7d3a5ae94e49bdeeb50))
* **repo:** Update papercamp config ([92ec60b](https://github.com/adooone/paper-camp/commit/92ec60b3ecf7a64a226008fe718abe7fd12fba46))

## [0.2.1](https://github.com/adooone/paper-camp/compare/v0.2.0...v0.2.1) (2026-06-28)


### Bug Fixes

* **22:** skip draft PR creation if one already exists in any state ([b8c26cc](https://github.com/adooone/paper-camp/commit/b8c26ccce9341028978c07f36201811774e503f9))

## [0.2.0](https://github.com/adooone/paper-camp/compare/v0.1.0...v0.2.0) (2026-06-28)


### Features

* **22:** fix paper-ui link and ci ([8d4b781](https://github.com/adooone/paper-camp/commit/8d4b78141bad70756b49ca20f0c3b7ad381f8da3))
* **22:** GitHub CI/CD automation ([b26e89d](https://github.com/adooone/paper-camp/commit/b26e89d53b979b4617ebb26f2e88316081873268))
* **22:** GitHub CI/CD automation ([7353d41](https://github.com/adooone/paper-camp/commit/7353d4176f67590f109e355c02bf18054ae09b40))
* **22:** Triage CodeRabbit's first review and harden branch checkout ([2385b54](https://github.com/adooone/paper-camp/commit/2385b54e8dfa4668c481ca59f844f843e9b22a9b))
* **22:** update api ([c56e51f](https://github.com/adooone/paper-camp/commit/c56e51f0c195700acdc07bb5ada6c44046f3ab1c))
* **22:** update ci ([b8fc547](https://github.com/adooone/paper-camp/commit/b8fc54798efb3c4ba33570108ab4c29c93cd3841))
* **22:** update npm flow ([7b09e7f](https://github.com/adooone/paper-camp/commit/7b09e7f4bb48c43fa921ca33ba0f6f6084e1e046))
* Add opencode agent support ([b372bc4](https://github.com/adooone/paper-camp/commit/b372bc41e488add670f6d9275a54fb1f49721652))
* Agent-drafted plans ([07d2dbb](https://github.com/adooone/paper-camp/commit/07d2dbb33de0ce8152c6c162d8a41950710f8069))
* Phase convergence audit ([c4ecdab](https://github.com/adooone/paper-camp/commit/c4ecdabc0a270f64639eb75f7d38d1b767acf445))
* Plan clarification pass ([07b0ad9](https://github.com/adooone/paper-camp/commit/07b0ad95de8c7fa77fdb6641eac1f4b2650b7ec4))
* Plan/decision consistency check ([eb6eb0c](https://github.com/adooone/paper-camp/commit/eb6eb0c975759fd4e65a6e0a9f27468c917198cc))
* Polish Ideas and Stack UX ([201ff20](https://github.com/adooone/paper-camp/commit/201ff20916525c3f338c74a299d530556250e4c6))
* Project settings and config views ([bd3ca00](https://github.com/adooone/paper-camp/commit/bd3ca0003c237939c421c61ab1a0793a60e37588))
* Repo health status ([d9cf2a2](https://github.com/adooone/paper-camp/commit/d9cf2a2349223e654eac107d8c5a6ca690a99e6a))
* Settings config workspace ([661ecc7](https://github.com/adooone/paper-camp/commit/661ecc76564f8f0ab28df86fb85858d3698345eb))


### Bug Fixes

* **22:** align publish.yml checkout with repo convention ([920e3c8](https://github.com/adooone/paper-camp/commit/920e3c83f57430cd99ed8795dccf5eb0aa48392f))
* **22:** scope Scout app token to least privilege ([b65bfff](https://github.com/adooone/paper-camp/commit/b65bfffef3193fad4648be1a426a5d68656c3b5c))

## [0.1.0] - 2024-XX-XX

### Added
- Initial MVP release
- CLI commands: `init`, `dev`, `add`
- Admin dashboard with 5 pages:
  - Dashboard with project health gauges
  - Projects management
  - Plans browser with task tracking
  - Focus mode for AI-assisted work
  - Settings configuration
- Local-first data storage
- Analog gauge visualizations
- Integration with `paperplan/` planning system
