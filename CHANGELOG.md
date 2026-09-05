# Changelog

All notable changes to this project will be documented in this file.

## [0.28.0](https://github.com/adooone/paper-camp/compare/v0.27.0...v0.28.0) (2026-09-05)


### Features

* **app:** Add paper shade to the sidebar layout background ([1b4759a](https://github.com/adooone/paper-camp/commit/1b4759ae87f7289b7b08ddaf3a9864f676bb5969))
* **app:** Adopt it on the card and row empties ([27a6585](https://github.com/adooone/paper-camp/commit/27a658504db8e66f161723f8d256939fdfc98983))
* **app:** Adopt it on the page and panel bodies ([abd99bd](https://github.com/adooone/paper-camp/commit/abd99bd3fcb0ae5448451bb2566cf845a3ca5df8))
* **app:** Check the drawer and each sidebar area ([23cc082](https://github.com/adooone/paper-camp/commit/23cc08241eaeb64c0f16ec3ea34d5fe9c70ef898))
* **app:** Cover it in tests and run the quality checks ([1bf37d6](https://github.com/adooone/paper-camp/commit/1bf37d64ed980a9d4be0ab8f599b7a0e9a82815f))
* **app:** Delete the four `.pc-page` rules from `utilities.css` ([743effa](https://github.com/adooone/paper-camp/commit/743effaaed3a038dde559c6fa99a4360247264d9))
* **app:** Draw the four illustrations ([8c2fbc6](https://github.com/adooone/paper-camp/commit/8c2fbc64725828864122e583b17b83fb5e96a23d))
* **app:** Drop the `Page` sheet from the app shell ([6bcd18b](https://github.com/adooone/paper-camp/commit/6bcd18ba196b2f8f9c071f4e29920e134c91aa9c))
* **app:** Fold the Plans filters and actions into that card ([1c5d814](https://github.com/adooone/paper-camp/commit/1c5d814b0fb39f2b6d2e076796c86da1b192cade))
* **app:** One component for every empty message ([ee229ad](https://github.com/adooone/paper-camp/commit/ee229ad99711c8244865766e4232bd4b80dd2683))
* **app:** Wrap the sidebar in one kraft card ([80ba0c1](https://github.com/adooone/paper-camp/commit/80ba0c14491dae0de25b8d937c5c9f0984b6ccfe))
* **ideas:** Draft IDEA-233 through IDEA-236 for multi-project daemon ([4e735fb](https://github.com/adooone/paper-camp/commit/4e735fb34ad48a86c2eb1c115e7c0511427f91a7))
* **ideas:** Draft IDEA-237 for unified log view ([af0b1b0](https://github.com/adooone/paper-camp/commit/af0b1b05bf6471d6765f505359f93ff93b496c34))


### Bug Fixes

* **agent:** Detect auth errors via CLI status, not stderr text ([efe7dc6](https://github.com/adooone/paper-camp/commit/efe7dc6be9255159ed773d1bcd440407bd2e8b36))
* **app:** Answer the paste-code prompt from the app ([22f787f](https://github.com/adooone/paper-camp/commit/22f787fb8dd859eb62f54e30d927dfc86df24367))
* **app:** Carry the auth kind to the git card ([0e70568](https://github.com/adooone/paper-camp/commit/0e705681e131c717054a565929e3d482b7f0135a))
* **app:** Classify signed-out by probing auth status ([1dd7883](https://github.com/adooone/paper-camp/commit/1dd78835fece5d2348535491e260766995a782de))
* **app:** Move the sign-in controls to shared app components ([5d84dab](https://github.com/adooone/paper-camp/commit/5d84dab4637ed6121a056dafd22896434fdc3a26))
* **app:** Read the failure from the result line ([d1c276f](https://github.com/adooone/paper-camp/commit/d1c276f5e0950d135c95693eb60981a36a208fee))
* **app:** Replace CodeBlock with inline CommandLine and fix dev reachability ([f029c0a](https://github.com/adooone/paper-camp/commit/f029c0a5035b089bc4886ad193361f0ec77ab943))
* **app:** Strip OSC sequences before matching the login URL ([06e4006](https://github.com/adooone/paper-camp/commit/06e4006e0cf61302c3ad4b8b22318d6f4558e458))
* **app:** Warn when the repo's trust dialog was never accepted ([2276362](https://github.com/adooone/paper-camp/commit/2276362d35655844083b4f119701a63d9e1422d2))
* **ideas:** Restore exact byte content of IDEA-236's Fixes output ([175cef3](https://github.com/adooone/paper-camp/commit/175cef3ca81eec7a76765311cdf83e73f5c91a0d))
* **ideas:** Revert premature Quality-check mark on IDEA-236 ([4621bd3](https://github.com/adooone/paper-camp/commit/4621bd3e9149f658714631d38dd320d8c7e12891))
* **ideas:** Shorten IDEA-236's title under the 40-char limit ([32745a8](https://github.com/adooone/paper-camp/commit/32745a803a944787a404e8b6ee18959235915f5b))
* **stack:** Fix notification badge visibility and checks-group logic ([57ae591](https://github.com/adooone/paper-camp/commit/57ae5912d6a4e5b83eb09b0c448d2aa30e0058b5))

## [0.27.0](https://github.com/adooone/paper-camp/compare/v0.26.0...v0.27.0) (2026-09-04)


### Features

* **app:** Adopt a machine link into the project picker ([5b6c24f](https://github.com/adooone/paper-camp/commit/5b6c24ff3d60bf668d03a1fa35691fdaad96668e))
* **app:** Correct the docs and run the quality checks ([2e1e292](https://github.com/adooone/paper-camp/commit/2e1e292d4be1c07c6f4173b08ca504abd0223376))
* **app:** Declare the machine in the daemon's link ([7e20f0b](https://github.com/adooone/paper-camp/commit/7e20f0b37049ba595422b0b78d71eefbc8ca06bd))
* **app:** Guide the empty hub ([752973c](https://github.com/adooone/paper-camp/commit/752973cf46c6d8b6c42a1b333225fb6b270be40e))
* **app:** Register the project on `init` ([37091a2](https://github.com/adooone/paper-camp/commit/37091a2bae6d039511c28c34f9db1e439b5202aa))
* **app:** Remember machines the hub has met ([9dd9c92](https://github.com/adooone/paper-camp/commit/9dd9c92c4c6199d836b0a653bd5bf3f604984889))
* **app:** Replace machine connect flow with remembered machines ([d9ee14c](https://github.com/adooone/paper-camp/commit/d9ee14cc416676c848eeb2cf5f8c3bd1fcb0ef8f))
* **app:** Retire the paste card ([b9e1a66](https://github.com/adooone/paper-camp/commit/b9e1a662f53b95812e42eb160a74dfcfe24614bd))


### Bug Fixes

* **cli:** Correct USAGE.md and run the quality checks ([5455857](https://github.com/adooone/paper-camp/commit/5455857118f80d36d71a0fd0ae22d2f2f96fdb11))
* **cli:** Decide reachability from the two origins ([c25fc84](https://github.com/adooone/paper-camp/commit/c25fc84ac15d7fa6a5278c83f543f6776a0c12ae))
* **cli:** Print the remedy instead of a dead Network row ([2cb6aee](https://github.com/adooone/paper-camp/commit/2cb6aeec35bdc3d3be0e82756fbc87e0c73ee787))
* **cli:** Stamp Needs HTTPS in the hub ([1c5176e](https://github.com/adooone/paper-camp/commit/1c5176e4dca608b03bca47a57414ae9acdadd012))
* **core:** Isolate scaffold tests from real machine registry ([6bcb8d8](https://github.com/adooone/paper-camp/commit/6bcb8d80a42cea65ec9ba244a9a30794132ca46b))

## [0.26.0](https://github.com/adooone/paper-camp/compare/v0.25.0...v0.26.0) (2026-09-03)


### Features

* **app:** Add the compact indicator to the Stack panel ([a4800db](https://github.com/adooone/paper-camp/commit/a4800dba9db4c2f4713be85720fa1ad48a8d32a8))
* **app:** Cover it in tests and run the quality checks ([9d4fb15](https://github.com/adooone/paper-camp/commit/9d4fb15eb56d5247f17d2637a6b9f1907f82761c))
* **app:** Expire spent snapshots ([52ec418](https://github.com/adooone/paper-camp/commit/52ec4187e0eef6cc9e208c9a3aef5c7fd5abb4e3))
* **app:** Read capacity from the in-flight task ([2b12a27](https://github.com/adooone/paper-camp/commit/2b12a2777adedcc3c015c946f65b2de803395867))
* **app:** Reword the empty state on both surfaces ([21f7cd0](https://github.com/adooone/paper-camp/commit/21f7cd0139bcdb89000ea15c9f1a171e3da66565))
* **cli:** Cover the daemon banner in tests and run the quality checks ([bf80af4](https://github.com/adooone/paper-camp/commit/bf80af4ee792f04803dd33b7a97782013ed1a316))
* **cli:** Drop the bare pairing token line ([dd42774](https://github.com/adooone/paper-camp/commit/dd42774238dd793b3d942a2e8e036de83fa5873e))
* **cli:** Extend `--tailnet` and `--share` to the daemon ([d817c33](https://github.com/adooone/paper-camp/commit/d817c33f574ed81816c8210e746e786fa11f9b85))
* **cli:** Give the daemon the shared banner ([99d9f9d](https://github.com/adooone/paper-camp/commit/99d9f9daa8dfbb353250d936df2dc2d9120f832a))
* **stack:** Unify capacity/agent card layout and shorten task titles ([976c7a5](https://github.com/adooone/paper-camp/commit/976c7a58ea2369b166a4249b88db60fa85ed4f26))


### Bug Fixes

* **app:** Parse rate_limit_info and drive capacity from real utilization ([9d88c0e](https://github.com/adooone/paper-camp/commit/9d88c0ecf102f8a609011c91e18f66901e2c3fce))
* **stack:** Move agent overflow link into the section header row ([b5cbbf7](https://github.com/adooone/paper-camp/commit/b5cbbf7bec8feaf335a1a18e67e53fce340ecc8d))

## [0.25.0](https://github.com/adooone/paper-camp/compare/v0.24.0...v0.25.0) (2026-09-02)


### Features

* **app:** Desk discovery for new projects (IDEA-223) ([#202](https://github.com/adooone/paper-camp/issues/202)) ([9cb48a0](https://github.com/adooone/paper-camp/commit/9cb48a00708f5cbdf07468406b6acb5d727ca427))
* **cli:** Add machine registry with daemon, ls, rm, and scan commands ([05596e9](https://github.com/adooone/paper-camp/commit/05596e9a84d2ac8fdf133a9dd3b4aeeb33b63a55))
* **cli:** Connect to a machine from the hub ([3a5c2d8](https://github.com/adooone/paper-camp/commit/3a5c2d8e5711cf5f4cc5cf2276978ec9ac4d9add))
* **cli:** Connect to a machine from the hub ([35e8576](https://github.com/adooone/paper-camp/commit/35e8576acbee259724e4f8fc704d603a8d7729d6))
* **cli:** Document the tailnet and mobile paths ([7809055](https://github.com/adooone/paper-camp/commit/780905537fa27f3fa8cacbf5933ff603b6ec5995))
* **cli:** Drop the filesystem watchers ([9a74e69](https://github.com/adooone/paper-camp/commit/9a74e69b0ecd7395726424b2f9a38bc0ebed628e))
* **cli:** Machine-level project registry ([ced13ad](https://github.com/adooone/paper-camp/commit/ced13adc6b1534f4687921b0be2be2c91e579a94))
* **cli:** Move pairing to the machine ([285e29a](https://github.com/adooone/paper-camp/commit/285e29a8f0ff906b9bc50c61a76ee9e4305cd614))
* **cli:** Offer discovered runtimes in the hub ([466c9dd](https://github.com/adooone/paper-camp/commit/466c9dd74513e754fd6b15b7c6457024b1dd976f))
* **cli:** Probe tailnet peers for runtimes ([55191aa](https://github.com/adooone/paper-camp/commit/55191aa831e36753b8fd281944e66374c44d5048))
* **cli:** Queue agent runs per machine and run the quality checks ([157d380](https://github.com/adooone/paper-camp/commit/157d380451056bdff9bd789e2966baf0fc6ddd39))
* **cli:** Read the local tailnet identity ([d35cc5a](https://github.com/adooone/paper-camp/commit/d35cc5a001f70ce44e6da9c4c153973a7b1ee42d))
* **cli:** Scan a directory for projects ([f4b90a3](https://github.com/adooone/paper-camp/commit/f4b90a3b322e29b1c3450ec3ceee1a2d96f349b2))
* **cli:** Serve over HTTPS with `paper-camp dev --tailnet` ([709304a](https://github.com/adooone/paper-camp/commit/709304ae7d8c1b44ac63f5abfd683a3e9522f73f))
* **cli:** Serve registered projects from one daemon ([e988260](https://github.com/adooone/paper-camp/commit/e98826086b4cf0f71ff6092b7385e1168e08f133))


### Bug Fixes

* **cli:** Prefer tailnet MagicDNS host in registration link ([c3279b6](https://github.com/adooone/paper-camp/commit/c3279b69e5216927466750a7ce7696ea7e757247))

## [0.24.0](https://github.com/adooone/paper-camp/compare/v0.23.2...v0.24.0) (2026-08-31)


### Features

* **app:** Hub rebuild as a project picker ([9e27642](https://github.com/adooone/paper-camp/commit/9e2764248aa95f3192f19c59e6f3a92bb104b668))
* **app:** Hub rebuild as a project picker (IDEA-221) ([#201](https://github.com/adooone/paper-camp/issues/201)) ([db340ce](https://github.com/adooone/paper-camp/commit/db340ce763327dc815c68ce5011fa564d4adbe6c))

## [0.23.2](https://github.com/adooone/paper-camp/compare/v0.23.1...v0.23.2) (2026-08-30)


### Bug Fixes

* **app:** Add the hub-repo-store ([5aae08c](https://github.com/adooone/paper-camp/commit/5aae08c1ec7b88a34b0e4b6a933e1664ac138244))
* **app:** Make the hub shell scrollable ([144ff0c](https://github.com/adooone/paper-camp/commit/144ff0c1a6e86075a34ac7b74baf6ae34c940945))
* **app:** Run the app's quality checks ([c9495f6](https://github.com/adooone/paper-camp/commit/c9495f6abce72fa4a23952f5007830805de1f62d))
* **app:** Shrink-safe project rows ([556fce2](https://github.com/adooone/paper-camp/commit/556fce2d9a53a36d65ba09684c7fd7675bbb8fd9))
* **app:** Turn the connected card into the repo picker ([30963b7](https://github.com/adooone/paper-camp/commit/30963b7a2d852ea9c23b97c2dbebfa3973419ecd))
* **server:** stop run-all commits from choking on renamed files ([7241dc7](https://github.com/adooone/paper-camp/commit/7241dc7cf96c264388492e402339f046d5950bb6))

## [0.23.1](https://github.com/adooone/paper-camp/compare/v0.23.0...v0.23.1) (2026-08-29)


### Bug Fixes

* **app:** Inline device-flow proxy code so Vercel functions run standalone ([4369e7c](https://github.com/adooone/paper-camp/commit/4369e7c78bdaae078c7a02858ad58a52c09aa964))

## [0.23.0](https://github.com/adooone/paper-camp/compare/v0.22.0...v0.23.0) (2026-08-28)


### Features

* **app:** Add GitHub device flow sign-in to the connect card ([b8468fa](https://github.com/adooone/paper-camp/commit/b8468fa74dd7b39c3ed6043e2379fb2e40967f5c))
* **app:** Add the Sign in with GitHub button and user-code step to the connect card ([096a4c2](https://github.com/adooone/paper-camp/commit/096a4c29a248fb0f1e1c1ed6ff278eac6fc1eb7c))
* **app:** Add the two device-flow proxy routes to the runtime server ([8781eeb](https://github.com/adooone/paper-camp/commit/8781eeb061f57f7b98e61e316559280f2b911a5b))
* **app:** Mirror the same proxy as one Vercel serverless function for the hosted client ([bf4735b](https://github.com/adooone/paper-camp/commit/bf4735b007d3863e364a73ba39f4c7dd1b821ecd))
* **app:** Return the card to idle on cancel, denial, or code expiry with GitHub's message ([a87b411](https://github.com/adooone/paper-camp/commit/a87b4111f5efa5684e4a769fedfed3826528c61f))
* **app:** Ship the client ID as a constant with a `PAPERCAMP_GITHUB_CLIENT_ID` override ([34e7147](https://github.com/adooone/paper-camp/commit/34e7147de6db7d55e5673f798c6a538140efc6e4))

## [0.22.0](https://github.com/adooone/paper-camp/compare/v0.21.1...v0.22.0) (2026-08-28)


### Features

* **cli:** Pairing survives dev restarts (IDEA-216) ([#195](https://github.com/adooone/paper-camp/issues/195)) ([2a5ce11](https://github.com/adooone/paper-camp/commit/2a5ce1152b159eec69377b2874ebc17b499c9465))
* **cli:** Show a network-aware dev banner and clearer port errors ([360138e](https://github.com/adooone/paper-camp/commit/360138e7af0df1be599a32ca07b9cf04a732f63e))


### Bug Fixes

* **app:** GitHub connect on the Projects tab (IDEA-217) ([#196](https://github.com/adooone/paper-camp/issues/196)) ([be0dc8b](https://github.com/adooone/paper-camp/commit/be0dc8b8042c5f5689f68a48d947ebb8726b41af))
* **app:** Retry the runtime probe and time out the pairing fetch ([f49d5d1](https://github.com/adooone/paper-camp/commit/f49d5d1c009b4ecd823ac20c882f1ae737a3ee9e))
* **app:** Skip `verifyDirectCompletion` for boards in `handleMarkDone` ([18967b8](https://github.com/adooone/paper-camp/commit/18967b8dc19ee7d812e7883d184f1685b939d16d))
* **app:** Trust the board's derived status in `canMarkPlanDone` ([8e043e2](https://github.com/adooone/paper-camp/commit/8e043e20c64859cbe6354964b32f68a9da267a8c))

## [0.21.1](https://github.com/adooone/paper-camp/compare/v0.21.0...v0.21.1) (2026-08-24)


### Bug Fixes

* **cli:** satisfy lint gates on the hosted-client registration link ([4aff638](https://github.com/adooone/paper-camp/commit/4aff638530c34aad17a8789b667dec0a3e2db848))
* **server:** trust missing Origin on any network-scoped host, not just loopback ([9b1069c](https://github.com/adooone/paper-camp/commit/9b1069c9a673947354b216a71ff0de4239bd515a))

## [0.21.0](https://github.com/adooone/paper-camp/compare/v0.20.0...v0.21.0) (2026-08-24)


### Features

* **app:** Announce a runtime from the CLI ([433e77e](https://github.com/adooone/paper-camp/commit/433e77e743ee9116dc76fee18a046eceb3014fb6))
* **app:** Boards and tickets (IDEA-201) ([#185](https://github.com/adooone/paper-camp/issues/185)) ([aad3397](https://github.com/adooone/paper-camp/commit/aad33971b4bd91ca3693b0ca40eb09c49fbb0c20))
* **app:** Build the project switcher ([8a8d29c](https://github.com/adooone/paper-camp/commit/8a8d29cd73761516271c6d0e2db19fcab35890cd))
* **app:** Client, runtime and plugin layers (IDEA-193) ([#184](https://github.com/adooone/paper-camp/issues/184)) ([38a42e0](https://github.com/adooone/paper-camp/commit/38a42e0345659da70f0644d9052b9f03821726ef))
* **app:** Drop the on-branch card from the idea view ([6da4704](https://github.com/adooone/paper-camp/commit/6da470481b4b4e5f193a8cd05f91da79bfa493fe))
* **app:** Fan out across registered runtimes ([2337f7d](https://github.com/adooone/paper-camp/commit/2337f7d8d433a73cb2f3cfd7fc814b758102625a))
* **app:** Give both routes one name ([39b99cf](https://github.com/adooone/paper-camp/commit/39b99cf8ed49e6265e36f87d9d0f1204acc07fc0))
* **app:** Hub shell and projects list (IDEA-205) ([#189](https://github.com/adooone/paper-camp/issues/189)) ([c1ebb05](https://github.com/adooone/paper-camp/commit/c1ebb050059a70bc47d0ae464128a496fb1be84f))
* **app:** mark IDEA-117 review ([2f4b69d](https://github.com/adooone/paper-camp/commit/2f4b69d40ca16ec2711b9523a3106217526c2266))
* **app:** mark IDEA-203 review ([171c3cd](https://github.com/adooone/paper-camp/commit/171c3cd05d0ac009440d44342c121f1681883455))
* **app:** Move branch creation into the actions sidebar ([f4a71e4](https://github.com/adooone/paper-camp/commit/f4a71e48ae7347d5532bbfb1d947d00d8cf53523))
* **app:** Register projects by runtime address ([833650f](https://github.com/adooone/paper-camp/commit/833650ffaa6737ce5e238c311ba4f4601f6fe126))
* **app:** Ship cross-project views ([9b5ce01](https://github.com/adooone/paper-camp/commit/9b5ce01da6e9349a7e5107847423185c519b430a))
* **app:** Ship IDEA-204 hosted deploy config ([4199193](https://github.com/adooone/paper-camp/commit/41991930dcc867f80912466ba76fa4b7623be905))
* **app:** Style pass as a phase action (IDEA-199) ([#187](https://github.com/adooone/paper-camp/issues/187)) ([a368128](https://github.com/adooone/paper-camp/commit/a368128ecd0553ad109325c71542e54d15d59478))
* **app:** Verify a direct completion before promoting ([2febb67](https://github.com/adooone/paper-camp/commit/2febb67ef929fc834b117e1f1ded93453dbf7c2e))
* **ideas:** apply feedback edit to IDEA-117 ([bbc0051](https://github.com/adooone/paper-camp/commit/bbc005156fc90b05fc97080e7c4c3ab6ef7e4632))
* **ideas:** apply feedback edit to IDEA-203 ([20990ac](https://github.com/adooone/paper-camp/commit/20990acc2fca6892b111eeccd11bbc21eb8cfcf3))
* **repo:** Detach the client (TICKET-2) ([#188](https://github.com/adooone/paper-camp/issues/188)) ([3037c8c](https://github.com/adooone/paper-camp/commit/3037c8c3c4cd2a43184d59ea0cf480f451d6f89b))
* **repo:** Reachable from anywhere (TICKET-6) ([#190](https://github.com/adooone/paper-camp/issues/190)) ([f4721f6](https://github.com/adooone/paper-camp/commit/f4721f6403431e34e70c4962f1c770722db43dc9))


### Bug Fixes

* **app:** Remove wrong-branch card from plan detail view ([165c60d](https://github.com/adooone/paper-camp/commit/165c60d4a0975d6b0dd1b25ded1386dbebed419b))
* **app:** Reorder project switcher header and back link ([d3b05c7](https://github.com/adooone/paper-camp/commit/d3b05c7351402c11a756bbaedebc192e20d3b87f))
* **app:** Route hub state through router instead of bypassing it ([4a6a470](https://github.com/adooone/paper-camp/commit/4a6a4709c5fd309096d238ebdd80122543b35eaf))
* **cli:** Offer every reachable host in the registration link ([0f822c7](https://github.com/adooone/paper-camp/commit/0f822c771583c6e4390af2cf8c8db412476c0be7))
* **plans:** Keep the pre-overlay `order` on the entity ([cb323eb](https://github.com/adooone/paper-camp/commit/cb323eb90b9e7a5d6bba57c440cc090f66ce1c7d))
* **plans:** Persist only the stored value ([9f93a4d](https://github.com/adooone/paper-camp/commit/9f93a4d616c4e59e9cf043fa84e55207827c79c2))
* **plans:** Strip ranks already written to the corpus ([4bcb7e6](https://github.com/adooone/paper-camp/commit/4bcb7e698efb87682b67752e77a7095032659401))
* **server:** Make prioritise why an array so writes stop leaking rank ([947e8dc](https://github.com/adooone/paper-camp/commit/947e8dc32f341984675b2f38d1f2da3194b43eb9))

## [0.20.0](https://github.com/adooone/paper-camp/compare/v0.19.0...v0.20.0) (2026-08-21)


### Features

* **agent:** Fixes accumulate into one commit (IDEA-188) ([#171](https://github.com/adooone/paper-camp/issues/171)) ([a7f6750](https://github.com/adooone/paper-camp/commit/a7f6750a3b5f522b0797de78d51c592136fd2bd3))
* **app:** Add stage-all/unstage-all and group git file list by folder ([4b7b882](https://github.com/adooone/paper-camp/commit/4b7b882c461dac98fe9d4b936cfd24de736b604b))
* **app:** An Issues page you can act on (IDEA-192) ([#181](https://github.com/adooone/paper-camp/issues/181)) ([39c42a2](https://github.com/adooone/paper-camp/commit/39c42a25cc2690f9e423eec271e2d425fe7ade14))
* **app:** Complete an idea without leaving (IDEA-194) ([#178](https://github.com/adooone/paper-camp/issues/178)) ([fe4721a](https://github.com/adooone/paper-camp/commit/fe4721a249d669244677dd9cd04ec90654aeeeb9))
* **app:** Page texture fills the centre column (IDEA-189) ([#170](https://github.com/adooone/paper-camp/issues/170)) ([107a254](https://github.com/adooone/paper-camp/commit/107a2543f3ad2d56f124b793d7db3ce0bc0361aa))
* **app:** Use the whole width (IDEA-186) ([#167](https://github.com/adooone/paper-camp/issues/167)) ([381810b](https://github.com/adooone/paper-camp/commit/381810bf6ac67913b5d98629fcb94b6b5811614b))
* **core:** Version the corpus format (IDEA-168) ([#175](https://github.com/adooone/paper-camp/issues/175)) ([b6d2f82](https://github.com/adooone/paper-camp/commit/b6d2f82527135711536b5c7dba6d6ba63dbb5b5a))
* **plans:** Fixes are their own entity (IDEA-187) ([#179](https://github.com/adooone/paper-camp/issues/179)) ([e21f249](https://github.com/adooone/paper-camp/commit/e21f249f2d8d87d556ce5181b3a6375b387ce0dc))
* **server:** Make `clearPrCache` invalidate the persisted map ([75341f1](https://github.com/adooone/paper-camp/commit/75341f1a18d5e8e9a25c40e7e75371fb76e16e1a))
* **server:** mark IDEA-181 review ([67f2ff3](https://github.com/adooone/paper-camp/commit/67f2ff30bbd0c903b0c0d020235bd93c244376e3))


### Bug Fixes

* **agent:** Agents commit only what they wrote (IDEA-190) ([#173](https://github.com/adooone/paper-camp/issues/173)) ([829d2d5](https://github.com/adooone/paper-camp/commit/829d2d50698f34dc4dec504cbf939cf7ff2c1013))
* **app:** Dedupe React and rework button color tokens ([62f03d7](https://github.com/adooone/paper-camp/commit/62f03d711bd238798cd0be106d9573a2565dd8fb))
* **app:** Filters and sort tell the truth (IDEA-183) ([#176](https://github.com/adooone/paper-camp/issues/176)) ([492233d](https://github.com/adooone/paper-camp/commit/492233db0efb4cd5847a7017298463216952fcbc))
* **app:** Merge git-page header row and refresh diff after commit ([33920bb](https://github.com/adooone/paper-camp/commit/33920bbd415c86c89d503f72f8b29e2ad53b29bc))
* **app:** One row treatment on the Plans page (IDEA-184) ([#169](https://github.com/adooone/paper-camp/issues/169)) ([3bd42a5](https://github.com/adooone/paper-camp/commit/3bd42a555f3de373993b2d097ed31808d027a189))
* **app:** Prioritise lies about what it did (IDEA-179) ([#177](https://github.com/adooone/paper-camp/issues/177)) ([5849ef0](https://github.com/adooone/paper-camp/commit/5849ef05aa1e9fcb4113d3302f155fdd6d3339f3))
* **core:** Rate limits must not rewrite status (IDEA-178) ([#172](https://github.com/adooone/paper-camp/issues/172)) ([94494d2](https://github.com/adooone/paper-camp/commit/94494d2104af7df84180dfe4d0a5f1f97ae90d25))
* **server:** Skip idea-thread write for closed PR reviews ([ec4f866](https://github.com/adooone/paper-camp/commit/ec4f866ba4be08b7f5340ef430114eff0ebb843d))

## [0.19.0](https://github.com/adooone/paper-camp/compare/v0.18.1...v0.19.0) (2026-08-17)


### Features

* **app:** Build command in the desk Stack panel (IDEA-158) ([#150](https://github.com/adooone/paper-camp/issues/150)) ([53772d0](https://github.com/adooone/paper-camp/commit/53772d045495207786272154cfd60eb01a6d1dc9))
* **app:** Draft all ideas at once (IDEA-169) ([#151](https://github.com/adooone/paper-camp/issues/151)) ([3d2b0af](https://github.com/adooone/paper-camp/commit/3d2b0afb777fe2bce1b3a6d758b9b187662e1e58))
* **app:** Manual commits become phase rows (IDEA-151) ([#149](https://github.com/adooone/paper-camp/issues/149)) ([36bda5e](https://github.com/adooone/paper-camp/commit/36bda5eebcfc24d665d70e5c8c266cc8a8054b14))
* **app:** Readable diffs on the git page (IDEA-166) ([#164](https://github.com/adooone/paper-camp/issues/164)) ([7775a07](https://github.com/adooone/paper-camp/commit/7775a074985afd8631d1318df54614b10bbd641b))
* **app:** Review pull requests with a local agent (IDEA-170) ([#153](https://github.com/adooone/paper-camp/issues/153)) ([e2d7649](https://github.com/adooone/paper-camp/commit/e2d764937dc12b8f029b78bcd1ad2c875360ef7a))
* **app:** Scout posts a formatted review (IDEA-175) ([#154](https://github.com/adooone/paper-camp/issues/154)) ([7f7f7eb](https://github.com/adooone/paper-camp/commit/7f7f7ebb543eb208419ab65c2133ee9cf39b1c39))
* **app:** Show a running PR review in the UI (IDEA-174) ([#156](https://github.com/adooone/paper-camp/issues/156)) ([f9e2101](https://github.com/adooone/paper-camp/commit/f9e2101abece7c6e11e6e7c98d0e73b2613951ba))
* **app:** Stage files, write the message (IDEA-165) ([#160](https://github.com/adooone/paper-camp/issues/160)) ([6a38bc7](https://github.com/adooone/paper-camp/commit/6a38bc77bd769acff4d291b08d6eaf8f4985f227))
* **plans:** Feedback fixes start running at once (IDEA-149) ([#147](https://github.com/adooone/paper-camp/issues/147)) ([05e5ee7](https://github.com/adooone/paper-camp/commit/05e5ee77732051dd44cc82821468db17849ea152))
* **server:** Fetch from GitHub only when asked (IDEA-181) ([#163](https://github.com/adooone/paper-camp/issues/163)) ([e8b0631](https://github.com/adooone/paper-camp/commit/e8b06317e31d064a1433975d4a667c700a00f0a6))


### Bug Fixes

* **agent:** Run-all redoes work from a stale base (IDEA-171) ([#161](https://github.com/adooone/paper-camp/issues/161)) ([e1aad95](https://github.com/adooone/paper-camp/commit/e1aad95c7facbe633785f1081813ac24b6c68ca4))
* **app:** Desk section clips its own content (IDEA-161) ([#157](https://github.com/adooone/paper-camp/issues/157)) ([77a5ed6](https://github.com/adooone/paper-camp/commit/77a5ed65ae0c4873ef73c73c81441d5520db7d18))
* **app:** Git status vocabulary and chrome (IDEA-167) ([#165](https://github.com/adooone/paper-camp/issues/165)) ([c0603c9](https://github.com/adooone/paper-camp/commit/c0603c9d3a6ebe582976b4ff52cbbc974c8b62ae))
* **app:** Never lose a computed PR review (IDEA-173) ([#155](https://github.com/adooone/paper-camp/issues/155)) ([63c07c6](https://github.com/adooone/paper-camp/commit/63c07c6c714098d9d6ce5dec2b994eaa5b275964))
* **app:** Persist drafts and UI choices (IDEA-172) ([#158](https://github.com/adooone/paper-camp/issues/158)) ([1147975](https://github.com/adooone/paper-camp/commit/114797563c3b5b85db26709ae05636c5580c5dab))
* **app:** Stack panel affordance and a11y pass (IDEA-163) ([#166](https://github.com/adooone/paper-camp/issues/166)) ([414f768](https://github.com/adooone/paper-camp/commit/414f7682557cfdff9e34597b02faf6f249f4bdbd))
* **plans:** Durable drafted plans (IDEA-137) ([#152](https://github.com/adooone/paper-camp/issues/152)) ([b899564](https://github.com/adooone/paper-camp/commit/b89956441fae5609baef0f1052d890b4aaa4dd75))
* **plans:** Manual commit phase rows no longer regress ([2bbd974](https://github.com/adooone/paper-camp/commit/2bbd9746d1e7d88b6068fdef0819de5ff4b6bf3a))
* **server:** Sync stops stashing over the corpus (IDEA-176) ([#162](https://github.com/adooone/paper-camp/issues/162)) ([97601cb](https://github.com/adooone/paper-camp/commit/97601cbdde4863b1d73099c24da733fc49571d90))

## [0.18.1](https://github.com/adooone/paper-camp/compare/v0.18.0...v0.18.1) (2026-08-12)


### Bug Fixes

* **app:** Git actions time out instead of hanging ([976feed](https://github.com/adooone/paper-camp/commit/976feed59913da2322d11355c09b04455ba83f37))
* **app:** Git actions time out instead of hanging (IDEA-159) ([#145](https://github.com/adooone/paper-camp/issues/145)) ([981ccb3](https://github.com/adooone/paper-camp/commit/981ccb33b3df009494782db5402f9f4d959f95ab))
* **app:** One activity stream for the whole app ([d3c5fae](https://github.com/adooone/paper-camp/commit/d3c5faed4edb977e0d2bfa2938f4a12f65fd14d0))
* **app:** One activity stream for the whole app (IDEA-160) ([#146](https://github.com/adooone/paper-camp/issues/146)) ([b955218](https://github.com/adooone/paper-camp/commit/b9552183214eaeeb352e08f5dee8033f5d35bd0f))

## [0.18.0](https://github.com/adooone/paper-camp/compare/v0.17.1...v0.18.0) (2026-08-12)


### Features

* **app:** Build check in the status manager (IDEA-157) ([#136](https://github.com/adooone/paper-camp/issues/136)) ([0318cfc](https://github.com/adooone/paper-camp/commit/0318cfc1dbe846017312bb9f144bedd20b425587))
* **app:** Deliver lives in the idea view (IDEA-146) ([#133](https://github.com/adooone/paper-camp/issues/133)) ([46fa40e](https://github.com/adooone/paper-camp/commit/46fa40eced97db83371bb9f49da7f7006a3d6afb))
* **app:** Fix button replaces Commit when checks fail (IDEA-156) ([#143](https://github.com/adooone/paper-camp/issues/143)) ([6ab6c85](https://github.com/adooone/paper-camp/commit/6ab6c850952103a1175e51d25872cd8f521f49b9))
* **app:** Git view replaces the toolbar's four actions (IDEA-154) ([#142](https://github.com/adooone/paper-camp/issues/142)) ([154a5cc](https://github.com/adooone/paper-camp/commit/154a5cc1fe4db589797f77702debfa74ba55eb7c))
* **app:** Notifications view replaces the Inbox (IDEA-153) ([#141](https://github.com/adooone/paper-camp/issues/141)) ([ecba0cd](https://github.com/adooone/paper-camp/commit/ecba0cdfdca1d04170ee3b06bed580431fd95a9b))
* **app:** Run & monitor on the desk (IDEA-119) ([#130](https://github.com/adooone/paper-camp/issues/130)) ([25f9172](https://github.com/adooone/paper-camp/commit/25f917204a739c4f7b6293abf661955b4d0bac42))
* **app:** Scout panel replaces the sidesheet (IDEA-147) ([#134](https://github.com/adooone/paper-camp/issues/134)) ([733299e](https://github.com/adooone/paper-camp/commit/733299efda59ae3f40bcf9a4fc02d4b7b7dc1878))
* **cli:** paper-camp doctor (IDEA-121) ([#131](https://github.com/adooone/paper-camp/issues/131)) ([c0838db](https://github.com/adooone/paper-camp/commit/c0838dbed450ae1c983c84c6f68aa1f6b95eee28))
* **repo:** MCP as the primary write path (IDEA-122) ([#128](https://github.com/adooone/paper-camp/issues/128)) ([7c3ae99](https://github.com/adooone/paper-camp/commit/7c3ae99c1758e2327e5a785ecdfb3be2ab9390e4))


### Bug Fixes

* **app:** Changes page in Plans style (IDEA-145) ([#132](https://github.com/adooone/paper-camp/issues/132)) ([ad00fd2](https://github.com/adooone/paper-camp/commit/ad00fd203b085e4beb199d670331ee9da1184d60))
* **app:** Only the page container scrolls (IDEA-155) ([#138](https://github.com/adooone/paper-camp/issues/138)) ([91b2033](https://github.com/adooone/paper-camp/commit/91b2033aa06834a0b3491c0395a76f3bab263152))
* **cli:** Bare mount URL white-screens the desk (IDEA-148) ([#140](https://github.com/adooone/paper-camp/issues/140)) ([0077acd](https://github.com/adooone/paper-camp/commit/0077acda51763f50cca575a3de3f39b542727d70))

## [0.17.1](https://github.com/adooone/paper-camp/compare/v0.17.0...v0.17.1) (2026-08-08)


### Bug Fixes

* **app:** Minimal island — branch banner, one glance row, single Stack button (IDEA-144) ([#126](https://github.com/adooone/paper-camp/issues/126)) ([9a61b13](https://github.com/adooone/paper-camp/commit/9a61b131f3a9aa1612e4676238a7e4c208ce09bf))

## [0.17.0](https://github.com/adooone/paper-camp/compare/v0.16.0...v0.17.0) (2026-08-08)


### Features

* **agent:** Run analytics (IDEA-135) ([#124](https://github.com/adooone/paper-camp/issues/124)) ([dd1682b](https://github.com/adooone/paper-camp/commit/dd1682b4848c90a8d81e0fb99141e56c91cc759a))
* **app:** Phases as living progress rows (IDEA-141) ([#122](https://github.com/adooone/paper-camp/issues/122)) ([610ab2e](https://github.com/adooone/paper-camp/commit/610ab2e292c78f58d595ce7891ac5d0fa1bca5fb))


### Bug Fixes

* **app:** Roadmap page redesign (IDEA-136) ([#125](https://github.com/adooone/paper-camp/issues/125)) ([0d863b3](https://github.com/adooone/paper-camp/commit/0d863b3e532d2899dab607be3ca365f599af5309))

## [0.16.0](https://github.com/adooone/paper-camp/compare/v0.15.0...v0.16.0) (2026-08-07)


### Features

* **app:** Bottom-center island (IDEA-140) ([#121](https://github.com/adooone/paper-camp/issues/121)) ([768fb35](https://github.com/adooone/paper-camp/commit/768fb35550d352c5009451160a1893e744988aa3))
* **app:** Direct-to-main work can never reach review/done in derived status (IDEA-116) ([#115](https://github.com/adooone/paper-camp/issues/115)) ([9a99483](https://github.com/adooone/paper-camp/commit/9a994839777b8b49de2af0394f8f1538a1480feb))
* **app:** Single-bar toolbar with a Stack-style chat sidebar (IDEA-138) ([#117](https://github.com/adooone/paper-camp/issues/117)) ([6b7ba74](https://github.com/adooone/paper-camp/commit/6b7ba74f722e119d1d9da1b2d5db9169a93042f3))


### Bug Fixes

* **app:** Desk is broken under the mount — router basepath, API base, and a friendlier route (IDEA-139) ([#118](https://github.com/adooone/paper-camp/issues/118)) ([0f8d4f1](https://github.com/adooone/paper-camp/commit/0f8d4f1a5c79d2e0c455e92cdaf7adb6650d79c2))

## [0.15.0](https://github.com/adooone/paper-camp/compare/v0.14.0...v0.15.0) (2026-08-06)


### Features

* **app:** Parked-decisions inbox — every agent question awaiting a human, one queue (IDEA-118) ([#112](https://github.com/adooone/paper-camp/issues/112)) ([6f304d4](https://github.com/adooone/paper-camp/commit/6f304d40fbd5c023a9addb784a3f2504698d1b7d))
* **app:** Toolbar is an extended StatusBar — top, full-width, always visible, in layout (IDEA-133) ([#114](https://github.com/adooone/paper-camp/issues/114)) ([6484450](https://github.com/adooone/paper-camp/commit/64844506d458f271418c79a3ec05741ba58b38cf))
* **repo:** Tie ideas to releases — release notes grouped by idea (IDEA-124) ([#109](https://github.com/adooone/paper-camp/issues/109)) ([27c2f5d](https://github.com/adooone/paper-camp/commit/27c2f5d61658e0c2bd781b9e71aaa67e5868a0be))


### Bug Fixes

* **app:** Plans page decluttering (IDEA-134) ([#113](https://github.com/adooone/paper-camp/issues/113)) ([800f07c](https://github.com/adooone/paper-camp/commit/800f07cddc7b96cbbd5885dae8c39944796573e6))
* **app:** Published toolbar is dead on arrival — v0.14.0 embed fails end-to-end (IDEA-132) ([#111](https://github.com/adooone/paper-camp/issues/111)) ([84d3f75](https://github.com/adooone/paper-camp/commit/84d3f756cb091a975e5d98f9c9eb38d787d9f25a))

## [0.14.0](https://github.com/adooone/paper-camp/compare/v0.13.2...v0.14.0) (2026-08-05)


### Features

* **app:** In-app dev toolbar — paper-camp living inside the target application (IDEA-128) ([#105](https://github.com/adooone/paper-camp/issues/105)) ([c6fb945](https://github.com/adooone/paper-camp/commit/c6fb94500f169c57dd6a1020aa4b30aaf5527624))
* **repo:** Paper Scout — the conversational agent (IDEA-130) ([#107](https://github.com/adooone/paper-camp/issues/107)) ([2535ca8](https://github.com/adooone/paper-camp/commit/2535ca8c6a3d74a238cd9c2a399d43f527ee0ff6))

## [0.13.2](https://github.com/adooone/paper-camp/compare/v0.13.1...v0.13.2) (2026-08-05)


### Bug Fixes

* **cli:** Settings port is a dead field — dev never reads it (IDEA-127) ([#102](https://github.com/adooone/paper-camp/issues/102)) ([4c5d681](https://github.com/adooone/paper-camp/commit/4c5d681ff9fbd513bb42a3646545e686f985e7ba))
* **repo:** Headless runs die as bare "error" when the agent hits a permission ask (IDEA-125) ([#103](https://github.com/adooone/paper-camp/issues/103)) ([c07b799](https://github.com/adooone/paper-camp/commit/c07b799b0bf9b9f9cbf764f22bae9c51cabda01c))
* **repo:** Read-only helper tasks silently supersede a running run-all (IDEA-126) ([#100](https://github.com/adooone/paper-camp/issues/100)) ([41afaf5](https://github.com/adooone/paper-camp/commit/41afaf5b4216de5bbbcf1ff36f87c9a8746f0ccf))

## [0.13.1](https://github.com/adooone/paper-camp/compare/v0.13.0...v0.13.1) (2026-08-04)


### Bug Fixes

* **cli:** npm package is broken on Linux — bundled node-pty can't load (IDEA-115) ([#98](https://github.com/adooone/paper-camp/issues/98)) ([78ff376](https://github.com/adooone/paper-camp/commit/78ff37645b666eab85ab48836e2d8d2bdf28aeaf))

## [0.13.0](https://github.com/adooone/paper-camp/compare/v0.12.0...v0.13.0) (2026-08-03)


### Features

* **agent:** Slim agent prompts for short, direct output (IDEA-106) ([#89](https://github.com/adooone/paper-camp/issues/89)) ([0a71b6c](https://github.com/adooone/paper-camp/commit/0a71b6c8ca55d70eeca48f46a5fa985ed8b93f93))
* **app:** Agent resolves sync-rebase conflicts (IDEA-102) ([#97](https://github.com/adooone/paper-camp/issues/97)) ([c56de6a](https://github.com/adooone/paper-camp/commit/c56de6a223c5cc6b3251f850805d3d86b56d3b09))
* **app:** Compact Deliver section, more room for the agent stack (IDEA-109) ([#84](https://github.com/adooone/paper-camp/issues/84)) ([2ab8942](https://github.com/adooone/paper-camp/commit/2ab89426783dda699c4d649712cd46a2f92a59c0))
* **app:** Decisions and questions live on the idea (IDEA-104) ([#88](https://github.com/adooone/paper-camp/issues/88)) ([8bb257f](https://github.com/adooone/paper-camp/commit/8bb257f57b496fba461453fcf0eea9e4b660d803))
* **app:** Feedback as a single chat thread (IDEA-113) ([#91](https://github.com/adooone/paper-camp/issues/91)) ([7e999cb](https://github.com/adooone/paper-camp/commit/7e999cb62fb189014dc782c4c523f56306f6bf61))
* **app:** In-app code review with diffs (IDEA-110) ([#92](https://github.com/adooone/paper-camp/issues/92)) ([dddd6b8](https://github.com/adooone/paper-camp/commit/dddd6b808bbf123bb2665029969578970c1f717d))
* **app:** In-app sign-in via OAuth relay (IDEA-101) ([#94](https://github.com/adooone/paper-camp/issues/94)) ([335be5b](https://github.com/adooone/paper-camp/commit/335be5be64975a1d91d43a3f35a4f7e262327f48))
* **app:** One feedback thread on every idea, any status (IDEA-103) ([#87](https://github.com/adooone/paper-camp/issues/87)) ([f8a6e2a](https://github.com/adooone/paper-camp/commit/f8a6e2a4a39f11d9b8f6849069210e1f62b46f8a))
* **app:** Surface a diverged main with a one-click agent fix (IDEA-108) ([#96](https://github.com/adooone/paper-camp/issues/96)) ([61a084f](https://github.com/adooone/paper-camp/commit/61a084f935be8890a0efca223b3b998c1fd54ffc))
* **server:** Project stats view (IDEA-99) ([#95](https://github.com/adooone/paper-camp/issues/95)) ([c94642f](https://github.com/adooone/paper-camp/commit/c94642f5a06f1a3b572828935c6475d11ee71fa4))


### Bug Fixes

* **app:** Plain-language the confusing UI text (IDEA-105) ([#86](https://github.com/adooone/paper-camp/issues/86)) ([78cd5da](https://github.com/adooone/paper-camp/commit/78cd5da6430bd3d45d11cc1d82e03c2006924f70))

## [0.12.0](https://github.com/adooone/paper-camp/compare/v0.11.0...v0.12.0) (2026-07-29)


### Features

* **agent:** Self-healing run-all: fix red checks, ask only when stuck (IDEA-100) ([#83](https://github.com/adooone/paper-camp/issues/83)) ([f9fb50b](https://github.com/adooone/paper-camp/commit/f9fb50b80bbde69f1782f6e247d553bc0d922249))
* **agent:** Surface agent sign-in state in the app (IDEA-86) ([#72](https://github.com/adooone/paper-camp/issues/72)) ([d6dcc82](https://github.com/adooone/paper-camp/commit/d6dcc82444b2f64043db9e5fae4ee804f35bed48))
* **app:** Apply the merge policy from Settings (IDEA-85) ([#70](https://github.com/adooone/paper-camp/issues/70)) ([a15d9ab](https://github.com/adooone/paper-camp/commit/a15d9abd19df32108b11b8f926f4cf8c61279a76))
* **app:** Git actions in the toolbar, agent as fallback (IDEA-94) ([#80](https://github.com/adooone/paper-camp/issues/80)) ([9a66269](https://github.com/adooone/paper-camp/commit/9a6626962f8e4c7e4ca3c8cb160059f878a8c626))
* **app:** Margin notes on plans and phases (IDEA-87) ([#74](https://github.com/adooone/paper-camp/issues/74)) ([76f3ce4](https://github.com/adooone/paper-camp/commit/76f3ce409f8b0d0ead33c2bd25268f6a487cb88e))
* **app:** Open questions as a working queue (IDEA-96) ([#81](https://github.com/adooone/paper-camp/issues/81)) ([2d73800](https://github.com/adooone/paper-camp/commit/2d73800eb15ebcb1b0a8dd9899783171426349a8))
* **app:** Surface decisions where they bind (IDEA-97) ([#82](https://github.com/adooone/paper-camp/issues/82)) ([091a467](https://github.com/adooone/paper-camp/commit/091a4674531efc9fe409d40c20aa7a32103b9b68))
* **app:** Timeline view and horizon lanes (IDEA-92) ([#77](https://github.com/adooone/paper-camp/issues/77)) ([42c30ba](https://github.com/adooone/paper-camp/commit/42c30ba8ddf0e8fc63228e5da6747e35eead98b7))
* **core:** Roadmap items become the subject vocabulary (IDEA-95) ([#78](https://github.com/adooone/paper-camp/issues/78)) ([6c9817c](https://github.com/adooone/paper-camp/commit/6c9817c1ae4049a2eb3925c442210cead99014cd))
* **core:** Roadmap items survive promotion (IDEA-91) ([#76](https://github.com/adooone/paper-camp/issues/76)) ([5ce2074](https://github.com/adooone/paper-camp/commit/5ce2074ed20d950e7b831fc9bad304b7207a0ee5))
* **core:** Trace an idea from roadmap to release (IDEA-93) ([#79](https://github.com/adooone/paper-camp/issues/79)) ([ad0714d](https://github.com/adooone/paper-camp/commit/ad0714db09148025627d1137461f58b34bdad7e9))
* **plans:** Review a finished plan in prose (IDEA-89) ([#75](https://github.com/adooone/paper-camp/issues/75)) ([c7cba8b](https://github.com/adooone/paper-camp/commit/c7cba8bb5cc8b79cde24202ac52f2137c54ab071))
* **plans:** updates ([1ba4384](https://github.com/adooone/paper-camp/commit/1ba43844f604da767c1ae799503c2e31754e7c45))
* **server:** Connections for every service (IDEA-90) ([#73](https://github.com/adooone/paper-camp/issues/73)) ([783b7c6](https://github.com/adooone/paper-camp/commit/783b7c68492149b6501b0d0b76a2d946614fb03c))


### Bug Fixes

* **app:** Distinguish unavailable subject vocabulary from empty ([e775086](https://github.com/adooone/paper-camp/commit/e7750860c35d041d44eb074faa52a083a3b65d88))
* **ui:** Fix header background (IDEA-84) ([#68](https://github.com/adooone/paper-camp/issues/68)) ([649dcdd](https://github.com/adooone/paper-camp/commit/649dcdddfb5e411be2f2bb41cf01426f4accabd8))

## [0.11.0](https://github.com/adooone/paper-camp/compare/v0.10.0...v0.11.0) (2026-07-25)


### Features

* **app:** Compact the layout ([1ac1389](https://github.com/adooone/paper-camp/commit/1ac138947a77235e73f233b04f062dc53c929b13))
* **app:** Expand cards with live state ([1d217d6](https://github.com/adooone/paper-camp/commit/1d217d645e7957f1fdf84f292bf20835f6ee1a60))
* **app:** Gate the pass ([6952f70](https://github.com/adooone/paper-camp/commit/6952f7084cb7730d4c43b0fcb54af318fd712aec))
* **app:** Gate the pass ([33b3c91](https://github.com/adooone/paper-camp/commit/33b3c91ddd7342c960b3730708b1fa5d66a70243))
* **app:** Link the queue back to the map ([02775ca](https://github.com/adooone/paper-camp/commit/02775ca5585babb881eaf0e887cb689ad2a5df38))
* **app:** Reflow the layout shell — sidebar and Stack panel as drawers ([87290ad](https://github.com/adooone/paper-camp/commit/87290add0108e01dfb76092fc74a79bb03c21421))
* **app:** Size touch targets and reach the nav island one-handed ([9e02fa2](https://github.com/adooone/paper-camp/commit/9e02fa299de80270136ece84269ab172b4c85c0f))
* **app:** Stack the content surfaces ([4deaaf5](https://github.com/adooone/paper-camp/commit/4deaaf593f334be39111206e21931fdf7bebe696))
* **app:** updates ([648265f](https://github.com/adooone/paper-camp/commit/648265f6217877f329e9140d3d950771471d7849))
* **cli:** Gate the pass ([4dfbd73](https://github.com/adooone/paper-camp/commit/4dfbd7389add82e2053ca6d1543bc95a809bd7e9))
* **cli:** Seed a welcoming example idea in `init` ([97eaa19](https://github.com/adooone/paper-camp/commit/97eaa19ede4ae5ea7fb23eb20f28dc9231c68236))
* **cli:** Surface USAGE.md on first open ([f2cd372](https://github.com/adooone/paper-camp/commit/f2cd3721e6483418350317b5f0fac14e5749b2de))


### Bug Fixes

* **app:** Add the shuffle agent ([bd8a1b3](https://github.com/adooone/paper-camp/commit/bd8a1b35c4ac11c982ccd6a26b5d89a949138585))
* **app:** Address IDEA-77 review comments ([3c98f31](https://github.com/adooone/paper-camp/commit/3c98f315ece1322c8f506bfd37987e70fb8cf392))
* **app:** Consolidate header actions into a Menu ([7fd6a0d](https://github.com/adooone/paper-camp/commit/7fd6a0d00cffa301b23ff84b61b00f612fd6bf87))
* **app:** Enforce the invariant at the watcher seam ([1839d63](https://github.com/adooone/paper-camp/commit/1839d63af712e919673886edf43f26ded92ff40d))
* **app:** Gate the pass ([ea3f821](https://github.com/adooone/paper-camp/commit/ea3f821524ba5a34623bd69ff032886aa2d2d16b))
* **ci:** Document the merge policy ([a3de54d](https://github.com/adooone/paper-camp/commit/a3de54dbc9eb1c6b4d687889c70c35791d0f2300))
* **ci:** Gate the pass ([298e7d8](https://github.com/adooone/paper-camp/commit/298e7d86e36121486a54cc2022ff9937cd7c9598))
* **ci:** One release line per idea (IDEA-83) ([d7d7a51](https://github.com/adooone/paper-camp/commit/d7d7a51c6450b3fade9684225284e54604ba39b1))
* **ci:** Retitle PRs conventionally ([59b035b](https://github.com/adooone/paper-camp/commit/59b035b15d3c5f973dc197f7f860edfa4949c419))
* **plans:** Carry live agent state across the reload ([1790cc7](https://github.com/adooone/paper-camp/commit/1790cc77cf0c5d1f18e80a934a7f88e561e9dbf7))
* **plans:** Gate the pass ([6b47124](https://github.com/adooone/paper-camp/commit/6b47124dacc21c922936b3fe0540921a5bc27778))
* **plans:** Hot-reload the server API graph on change ([db79325](https://github.com/adooone/paper-camp/commit/db793256fb2b62156344ca0503941cfd86d00488))
* **plans:** Pin down the staleness boundary ([30d8066](https://github.com/adooone/paper-camp/commit/30d8066033d1afc7087387f9ca8734c59fb1d9bd))
* **repo:** updates ([eff32d8](https://github.com/adooone/paper-camp/commit/eff32d8b567ee05d2125aadde084c88253e21f07))
* **repo:** updates ([840e552](https://github.com/adooone/paper-camp/commit/840e552365ba59e761ca1f77e5bffa2a9555bbf5))
* **repo:** updates ([b2b2f64](https://github.com/adooone/paper-camp/commit/b2b2f64a26360ed45f78833ef0161db83fe7ee51))
* **server:** Fix PR-title/merge-detection gaps flagged in review ([dcd61fd](https://github.com/adooone/paper-camp/commit/dcd61fd5a17666a96dde20858806aa0469d24fe7))
* **server:** Serialize run-order passes and fix prioritise attribution ([f598efd](https://github.com/adooone/paper-camp/commit/f598efd1701ffb25dd4f46e70892ba8590bfe2a4))

## [0.10.0](https://github.com/adooone/paper-camp/compare/v0.9.0...v0.10.0) (2026-07-22)


### Features

* **app:** Add the Archive action ([7e69fa9](https://github.com/adooone/paper-camp/commit/7e69fa9756ec91fb41c99e7e1061391cd4dc0f68))
* **app:** Add the order field to entities ([25faa87](https://github.com/adooone/paper-camp/commit/25faa87aeb9f18163a2f9861c1105379c7e150a5))
* **app:** Add the subject field to entities ([601f463](https://github.com/adooone/paper-camp/commit/601f46310ed90b153697097f9a67efc333a71009))
* **app:** Build the Setup surface ([42c4395](https://github.com/adooone/paper-camp/commit/42c4395f93a6f4cf11936683a97b0ddfabb3c778))
* **app:** Close the absorbed idea ([62b2b6c](https://github.com/adooone/paper-camp/commit/62b2b6c904c10cffc709ceefbbc55393d0ae13d3))
* **app:** Derive effective status for display ([6fa6a5c](https://github.com/adooone/paper-camp/commit/6fa6a5cde698c39238d62c9155b45dcfa05abb86))
* **app:** Detect archivable ideas ([2cca1fa](https://github.com/adooone/paper-camp/commit/2cca1fa66a2f5cdf02930fa4387328e7759b4b07))
* **app:** Extend the roadmap grammar with candidates ([7d48548](https://github.com/adooone/paper-camp/commit/7d48548a2dbac3f2ac185564d824e7a1e080b98a))
* **app:** Gate features on capabilities ([e3fcd41](https://github.com/adooone/paper-camp/commit/e3fcd41ffbd1b0bd430fa79a990de0493f4fd59c))
* **app:** Gate the pass ([bdd82cb](https://github.com/adooone/paper-camp/commit/bdd82cbac8d04d389e33b236f81cf3f087d296e9))
* **app:** Gate the pass ([017b0aa](https://github.com/adooone/paper-camp/commit/017b0aa9edcf294a43451bc41e1426c32c33e8ce))
* **app:** Gate the pass ([65f5961](https://github.com/adooone/paper-camp/commit/65f5961a0993adfff1ea64fc1f86d7b6dde4120f))
* **app:** Gate the pass ([27072c3](https://github.com/adooone/paper-camp/commit/27072c34ad50fa78c55a3a5037700b84a4791251))
* **app:** Gate the pass ([82ca3ff](https://github.com/adooone/paper-camp/commit/82ca3ffe3b7abdd18a6ae70aced1c7e17d2250d2))
* **app:** Gate the pass ([d8caa54](https://github.com/adooone/paper-camp/commit/d8caa54b7dabbd704f42cf5de19e5f340e2871e4))
* **app:** Group the worklist by subject ([252a952](https://github.com/adooone/paper-camp/commit/252a9524ea3f8d472eb9faf103afa6cbc8d26c9d))
* **app:** Link map and queue both ways ([0e07436](https://github.com/adooone/paper-camp/commit/0e07436aef7c68f704e0fd205fb7a3ec7b4025c7))
* **app:** Manage subjects from Settings ([aa96916](https://github.com/adooone/paper-camp/commit/aa96916a46426dca258686ac25d557e224bf0b83))
* **app:** Parse the roadmap grammar ([99efb8b](https://github.com/adooone/paper-camp/commit/99efb8b7f44350d4cbab084087a444b9ac6c3ade))
* **app:** Pick a subject in idea details ([08a0057](https://github.com/adooone/paper-camp/commit/08a005705978b8627c715073a512d7e22b798dfc))
* **app:** Polish the detail view ([ac03323](https://github.com/adooone/paper-camp/commit/ac0332351d7b7af01761aee80a36d12328bdae17))
* **app:** Probe capabilities server-side ([16233db](https://github.com/adooone/paper-camp/commit/16233db126f38ad0e35b605791091b3cde427fa9))
* **app:** Promote an item to an idea ([f8c73bb](https://github.com/adooone/paper-camp/commit/f8c73bb997fbf07f4e6bc52d87847680f0cd43db))
* **app:** Rename Plans to Ideas ([e20a24a](https://github.com/adooone/paper-camp/commit/e20a24a3548d04b7992390310580643588adcd0b))
* **app:** Render and promote candidates ([dba7379](https://github.com/adooone/paper-camp/commit/dba73798431e410371c8b137483d2b8c61fa0a3c))
* **app:** Render the Roadmap surface ([a1bbc00](https://github.com/adooone/paper-camp/commit/a1bbc006f25277af39745fbb417dfe0e1e623485))
* **app:** Set the order from the UI ([1558be7](https://github.com/adooone/paper-camp/commit/1558be745336a3e9e52b6baee22b4e1abc33ad4d))
* **app:** Sort the worklist by run order ([6a4165b](https://github.com/adooone/paper-camp/commit/6a4165be3012be86f91e1c5b1703682106c93362))
* **app:** updates ([937cd8a](https://github.com/adooone/paper-camp/commit/937cd8ab0e69d225804dea6db9371e0e7a285f6b))
* **app:** updates ([c5afd3e](https://github.com/adooone/paper-camp/commit/c5afd3e80f512c335fe75bd8f4d381f7a99b58b6))
* **app:** updates ([6f9c3f5](https://github.com/adooone/paper-camp/commit/6f9c3f5cad3e0171689fa64e1d4bc5fe03693f13))
* **ideas:** Add subjects and order to idea frontmatter, sync index/progress ([a1582c4](https://github.com/adooone/paper-camp/commit/a1582c4940fe58a05a8704c9f7ccc7b47e80faf3))


### Bug Fixes

* **app:** Address IDEA-76 PR review comments ([ac96d25](https://github.com/adooone/paper-camp/commit/ac96d25d25955aad29844f6955771f9dc04f6166))
* **app:** Address IDEA-76 PR review comments ([7847c48](https://github.com/adooone/paper-camp/commit/7847c48f4c628f32b2056534dcda7aab128fb4cb))
* **app:** Address IDEA-77 review comments ([8342869](https://github.com/adooone/paper-camp/commit/8342869c2627afb8681ce411a0ed4d87a774f5e9))
* **app:** Address IDEA-77 review comments ([a65cd03](https://github.com/adooone/paper-camp/commit/a65cd030f5c498f23ae2fd7d58b438425d384374))
* **app:** Address IDEA-77 review comments ([7d070a9](https://github.com/adooone/paper-camp/commit/7d070a920b429232c7ce540f8ca63c2961e250ae))
* **app:** Align subject, order, and tags in entity detail meta row ([c0af82c](https://github.com/adooone/paper-camp/commit/c0af82cfd930c8ba1de6215df8b9750b2737dc36))
* **app:** Fix the route transition ([0a171fc](https://github.com/adooone/paper-camp/commit/0a171fc506cf4adf0fc9bd1a73112979db77013a))
* **app:** Gate the pass ([1d9db13](https://github.com/adooone/paper-camp/commit/1d9db13850efc6a629942f26c9f3f7243ca4d5d5))
* **app:** Harden subject picker, config writes, and settings nav state ([7691358](https://github.com/adooone/paper-camp/commit/7691358fade392361429e3f70cf9d4277f8f2c96))
* **app:** Harden subject picker, config writes, and settings nav state ([5cf2600](https://github.com/adooone/paper-camp/commit/5cf26004d81825bbea12dcc7b506dfb227bc8ee8))
* **app:** Profile and pin the cause ([6929a66](https://github.com/adooone/paper-camp/commit/6929a6644c2292680e7cb83f2655c50cb90f6f9d))
* **app:** Restore single 32px content inset on large screens ([471c6a3](https://github.com/adooone/paper-camp/commit/471c6a3d58017b5a81e61dde6fbe753f073b6ad9))
* **app:** Simplify the remaining usage ([ae3c4a4](https://github.com/adooone/paper-camp/commit/ae3c4a403d7159c6a56d4f089822d48770d431cb))
* **app:** Tune crossfade and add comment-ratio lint guard ([df923cb](https://github.com/adooone/paper-camp/commit/df923cbd6d69ff7bd93df4f95e3eb5ebc71dc9bd))
* **app:** updates ([ca358ed](https://github.com/adooone/paper-camp/commit/ca358ed370194d8c6856da78bd8e9e3c2bc781b8))
* **core:** Prune graduated roadmap item and harden roadmap regex ([3cbb0c6](https://github.com/adooone/paper-camp/commit/3cbb0c6027d6d0a7b42df3af6706a3966fb8075a))
* **core:** Prune graduated roadmap item and harden roadmap regex ([c8b5346](https://github.com/adooone/paper-camp/commit/c8b534639185d0c09970a711fb335ea6525bdb81))
* **core:** Prune graduated roadmap item and harden roadmap regex ([ea99fdc](https://github.com/adooone/paper-camp/commit/ea99fdcb0781bc819d1e785a5057a9345f675c36))
* **plans:** Fix run-order sort direction, note reflow, and a11y attrs ([22d219d](https://github.com/adooone/paper-camp/commit/22d219d23f3e93e5b0b3221fa9a8965c37fc14ac))
* **plans:** Fix run-order sort direction, note reflow, and a11y attrs ([ec58f8b](https://github.com/adooone/paper-camp/commit/ec58f8baee961e0793929290198280f7095a26ad))
* **ui:** Generalize the git one-line summary into a shared error formatter ([211848f](https://github.com/adooone/paper-camp/commit/211848f62b587acfcd6254e036f8d08de2f8bcd7))
* **ui:** Route agent-launch failures through the one-line summary ([2524c13](https://github.com/adooone/paper-camp/commit/2524c13b1bdaa3909b64185f06ba37f21119ec31))
* **ui:** Surface config-save failures with their cause ([ded1727](https://github.com/adooone/paper-camp/commit/ded172796136514907c619629952b9c77e3939ae))
* **ui:** Sweep remaining failure toasts for consistency ([dfb3ba4](https://github.com/adooone/paper-camp/commit/dfb3ba4616282f7f125f1ed1e285718d5035e089))
* **ui:** Type-check and full pass ([12ff237](https://github.com/adooone/paper-camp/commit/12ff2372188a1b40d11c9516ad86dc624adb7cac))


### Code Refactoring

* **app:** Baseline and dead-code inventory ([b30afa5](https://github.com/adooone/paper-camp/commit/b30afa58b64b97f688f583de7ca942b2244766b9))
* **app:** Gate and report the release numbers ([b6a2362](https://github.com/adooone/paper-camp/commit/b6a23624c76ea42607682975796135162517c4b3))
* **app:** Gate the pass ([8438035](https://github.com/adooone/paper-camp/commit/8438035ab12d8d2361587067536f9c89d0e3820c))
* **app:** Group the Tasks list by date ([4356dd0](https://github.com/adooone/paper-camp/commit/4356dd0d7bdb4fe950bc8baec2f7647172d8f82e))
* **app:** Make git errors readable toasts ([e9b6df3](https://github.com/adooone/paper-camp/commit/e9b6df350db044d7fdf2e9168709023b71bab790))
* **app:** Slim the CLI and MCP layer ([06628dd](https://github.com/adooone/paper-camp/commit/06628dd1feabc85cab334fea257380468d326af9))
* **app:** Slim the client hotspots ([e466b48](https://github.com/adooone/paper-camp/commit/e466b48de7411848b4808e118a89b6edeac25198))
* **app:** Split and shrink server/agent.ts ([66ee961](https://github.com/adooone/paper-camp/commit/66ee961ad19d63988d275755a5449148703394b2))
* **app:** Sweep orphaned client code ([b3d42de](https://github.com/adooone/paper-camp/commit/b3d42decec45ae49f14ff534a4d40f3f51a75cab))
* **app:** Tighten the core round-trip and git-pr surface ([94e38d4](https://github.com/adooone/paper-camp/commit/94e38d4330b9fe1b606cac55997ea08b494829aa))
* **app:** Trim Docs to general docs only ([da53671](https://github.com/adooone/paper-camp/commit/da53671796ea41c371f03f57a87d8f7ad78771f3))
* **app:** Trim Settings to General ([baf123c](https://github.com/adooone/paper-camp/commit/baf123c93db6ece9f9cea23f79cce29c824dd3ce))
* **app:** updates ([7aa3121](https://github.com/adooone/paper-camp/commit/7aa31212c1d8bb917d1c44d9fe992391c19f6984))
* **app:** updates ([6e92dc2](https://github.com/adooone/paper-camp/commit/6e92dc2ed097cecc35c116d8d8fe5b6a8729f228))


### Documentation

* **ideas:** Add IDEA-68 phase for readable git error toasts ([df085da](https://github.com/adooone/paper-camp/commit/df085da241226e509b74ebdce522dccaea386d4b))
* **ideas:** File four new ideas and update statuses ([c81b1aa](https://github.com/adooone/paper-camp/commit/c81b1aa6d81fb8f0b0796de6c824141ee39104e5))
* **ideas:** Sync IDEA-75 index row with frontmatter ([75b5a58](https://github.com/adooone/paper-camp/commit/75b5a589052c0b36b9477ef5cdfaed4a1aff998b))
* **ideas:** Sync IDEA-75 index row with frontmatter ([8ce7883](https://github.com/adooone/paper-camp/commit/8ce788390ec6a1fe0100114ea4e8422a27c5e936))

## [0.9.0](https://github.com/adooone/paper-camp/compare/v0.8.0...v0.9.0) (2026-07-18)


### Features

* **app:** Add a tasks page for the log ([45d3616](https://github.com/adooone/paper-camp/commit/45d361639bcef8541f4643ee0a99b3950ab02291))
* **app:** Add refresh button and fix busy/audit-status detection ([e4fbcca](https://github.com/adooone/paper-camp/commit/e4fbcca8a01c88be8356437a1da50c044964b55d))
* **app:** Add the active-key caret and `aria-sort` ([0593d98](https://github.com/adooone/paper-camp/commit/0593d98d72be72045765c5dfe601a8645a3d66bd))
* **app:** Carry the task id on the SSE tick and client state ([0be8193](https://github.com/adooone/paper-camp/commit/0be81939e2b4319031a98610f42a04b87521f05d))
* **app:** Confirm paper-ui `Table` header support ([b73b090](https://github.com/adooone/paper-camp/commit/b73b090a3c05d1457e4e00ff2dabe9cc67a11237))
* **app:** Define the write-set collision gate ([7e2fca2](https://github.com/adooone/paper-camp/commit/7e2fca267ae3d43d34165e5f90281072cccf8671))
* **app:** Fan `current` into a task registry ([634b513](https://github.com/adooone/paper-camp/commit/634b5132bb54ddfa2fcca75e6d259743c642563e))
* **app:** Gate: checks plus click each column ([a3afd99](https://github.com/adooone/paper-camp/commit/a3afd990fc82be9d95d4290ca1833fd0b5d4dcfc))
* **app:** Let the always-safe kinds through ([35a5b5a](https://github.com/adooone/paper-camp/commit/35a5b5a14f2b6a33d81796834776c01fa5c5c227))
* **app:** Link a Stack card to its task page ([535982f](https://github.com/adooone/paper-camp/commit/535982f7cd8f69b95c6a4971c128818d134edcac))
* **app:** Make `killCurrent` kill every task ([88fe5c2](https://github.com/adooone/paper-camp/commit/88fe5c27c4ff5acc5a61e11efe19836df6c14da4))
* **app:** Make the header labels sortable buttons ([738bf9c](https://github.com/adooone/paper-camp/commit/738bf9c14c28b444cca699a7ebb503ded77616c8))
* **app:** Make the Stack Agent card a real stack ([605bd19](https://github.com/adooone/paper-camp/commit/605bd19b4a536c5c47fa8d52c840717304b5abe6))
* **app:** Persist each task's log lines ([cff0748](https://github.com/adooone/paper-camp/commit/cff07489e524781ccbb91810c057542227bd73b9))
* **app:** Persist finished tasks to a log file ([e5b12ba](https://github.com/adooone/paper-camp/commit/e5b12ba61fff7f87d1315904094ea14968c2a426))
* **app:** Polish Stack agent cards and Tasks page list ([2f2bb1d](https://github.com/adooone/paper-camp/commit/2f2bb1d669d0012403ee7d7cb82bd71eb14e6f53))
* **app:** Register read-only calls as tasks ([903eb4c](https://github.com/adooone/paper-camp/commit/903eb4c6422bd92ba7c8aca64cf7b41dd3a3471e))
* **app:** Resolve the `created` key with no column ([f72db58](https://github.com/adooone/paper-camp/commit/f72db588a143a95f551b12bf016076f28d846a6c))
* **app:** updates ([38e594c](https://github.com/adooone/paper-camp/commit/38e594ca561d9ccd002f07ce951769cbb22b3930))


### Bug Fixes

* **agent:** Parse fenced fix-review verdicts robustly ([e31c7dd](https://github.com/adooone/paper-camp/commit/e31c7dd548491c7d426e6d532ef83d0f1a679ced))
* **app:** Handle stop/fetch errors and auto-expand highlighted task row ([60389b0](https://github.com/adooone/paper-camp/commit/60389b0e9999cc007bbdd8fd3bd90bd31eb228dc))
* **server:** Make dirty sync deterministic and fix stale-merged gate ([3cb8374](https://github.com/adooone/paper-camp/commit/3cb83746154d1b18a50717a4f8a5cf7b3cc6b3e9))
* **server:** Preserve staged index across dirty-sync stash ([024e491](https://github.com/adooone/paper-camp/commit/024e491b0554662e68522253f6b4cd920879308e))
* **stack:** Reserve stable height for Agent task stack ([52057b1](https://github.com/adooone/paper-camp/commit/52057b1f454b9187825825a9335e81c7f81ab7aa))
* **stack:** Reserve stable height for Agent task stack ([d2c394d](https://github.com/adooone/paper-camp/commit/d2c394db13cbdc1c907b8d321b5d8c19ff5c8f5c))
* **stack:** Reserve stable height for Agent task stack ([b1591e6](https://github.com/adooone/paper-camp/commit/b1591e624f05ba6d36299b3cb691b866793daf77))
* **stack:** Sync to main from a dirty merged branch ([b6cc75e](https://github.com/adooone/paper-camp/commit/b6cc75e927c1c3787f4157b46155b874b4678451))


### Code Refactoring

* **app:** Baseline the comment-line count per file ([8a11411](https://github.com/adooone/paper-camp/commit/8a114115817c17006f03379da5ebd4441cf6f052))
* **app:** Gate and report the net movement ([b34f4e4](https://github.com/adooone/paper-camp/commit/b34f4e4be2beabeb4d7dda944d0e896c09a510c0))
* **app:** Sweep the git-pr docstring pair against §7 ([1fe15e1](https://github.com/adooone/paper-camp/commit/1fe15e115ed0d39f5a8a1764b5a393ec2a407b0d))
* **app:** Sweep the remaining long tail across `src/` ([46cef12](https://github.com/adooone/paper-camp/commit/46cef12b87a87475b42831cf84622c30afbd4350))
* **app:** Sweep the store / serialize / types trio ([694e826](https://github.com/adooone/paper-camp/commit/694e8263bad4c43800c8a58f401ca80df211d6f4))
* **app:** Sweep the two server files ([32f5171](https://github.com/adooone/paper-camp/commit/32f517171b57620e96971332c24800e48d4132a2))


### Documentation

* **ideas:** Update IDEA-63's stale baseline to the verified 1536/8.2% ([c55c670](https://github.com/adooone/paper-camp/commit/c55c670ac91e69a5227941e16c26c429b1379eed))

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
