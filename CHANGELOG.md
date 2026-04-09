# [1.5.0](https://github.com/nebulord-dev/gitlore/compare/v1.4.3...v1.5.0) (2026-04-09)


### Features

* **cli:** simplify the TUI displays and add the dashboard URL. ([20590c2](https://github.com/nebulord-dev/gitlore/commit/20590c22e75c66382290f33dd545b661fea1814f))

## [1.4.3](https://github.com/nebulord-dev/gitlore/compare/v1.4.2...v1.4.3) (2026-04-09)


### Bug Fixes

* **cli:** ship web dashboard inside the published package ([#15](https://github.com/nebulord-dev/gitlore/issues/15)) ([60cdd03](https://github.com/nebulord-dev/gitlore/commit/60cdd03259d51665e9d48f137b1470d24cf415bf))

## [1.4.2](https://github.com/nebulord-dev/gitlore/compare/v1.4.1...v1.4.2) (2026-04-08)


### Bug Fixes

* address audit findings across core, cli, and web ([#13](https://github.com/nebulord-dev/gitlore/issues/13)) ([3c87570](https://github.com/nebulord-dev/gitlore/commit/3c8757091b469d314ca8ac96ad4fdae0c0eb3811))

## [1.4.1](https://github.com/nebulord-dev/gitlore/compare/v1.4.0...v1.4.1) (2026-04-08)


### Bug Fixes

* bundle @gitlore/core into cli to fix broken npm install ([e3bec69](https://github.com/nebulord-dev/gitlore/commit/e3bec69ac7df9ed2422fa69b62ea7da206bb0584))

# [1.4.0](https://github.com/nebulord-dev/gitlore/compare/v1.3.1...v1.4.0) (2026-04-08)


### Features

* prepare gitlore for npm publishing ([3f037bc](https://github.com/nebulord-dev/gitlore/commit/3f037bc7cd5cf0555f5ef20a793b3af7dcc04a14))

## [1.3.1](https://github.com/TraceRicochet/gitlore/compare/v1.3.0...v1.3.1) (2026-04-07)


### Bug Fixes

* add clarity to the coupleing heatmap and fix the badge labels in the cursed files table ([6413c59](https://github.com/TraceRicochet/gitlore/commit/6413c59ecfa93912dba7e76e00bd53caa8a3b9a9))

# [1.3.0](https://github.com/TraceRicochet/gitlore/compare/v1.2.0...v1.3.0) (2026-04-07)


### Bug Fixes

* address 4 bugs from PR [#2](https://github.com/TraceRicochet/gitlore/issues/2) code review ([e36c690](https://github.com/TraceRicochet/gitlore/commit/e36c690170f1d1c95df951911e3e41f9ab056b49))
* **web:** add tooltips and axis labels to scatter plot and timeline ([0ee1b31](https://github.com/TraceRicochet/gitlore/commit/0ee1b31812ea6c8b255a2fc5ff4b354223822667))
* **web:** add tooltips and time axes to branches, swimlanes, and ownership ([b7cc4ae](https://github.com/TraceRicochet/gitlore/commit/b7cc4ae76ccea22fb0336a8324644f5ebd3089ca))
* **web:** add tooltips to coupling graph, commit DAG, and commit heatmap ([b277af8](https://github.com/TraceRicochet/gitlore/commit/b277af87313949b0af33e66b854df84f23b2166f))
* **web:** address PR [#4](https://github.com/TraceRicochet/gitlore/issues/4) review — coupling threshold bug, stack overflow, dead code ([b0c9857](https://github.com/TraceRicochet/gitlore/commit/b0c9857288dd911c0aa12b40d1d497b2eabca1ce))
* **web:** align column headers from start anchor so all labels begin at same point ([7d308ec](https://github.com/TraceRicochet/gitlore/commit/7d308ec012653f83ee416a5cc3908de936aeb649))
* **web:** align spacing and border tokens with design spec ([d65108c](https://github.com/TraceRicochet/gitlore/commit/d65108c0fba57ace0d67de93b4e4c22364e9efe7))
* **web:** growth timeline dimming is hover-only, not persistent on selection ([b74a4b0](https://github.com/TraceRicochet/gitlore/commit/b74a4b060a2fc133f439015ab5c016de5321398e))
* **web:** improve chord diagram scaling and directory aggregation ([cdd29fa](https://github.com/TraceRicochet/gitlore/commit/cdd29fa943318b3d295e7303d162ad9717e4f9c5))
* **web:** increase column header height to 160px for rotated labels ([9b51e82](https://github.com/TraceRicochet/gitlore/commit/9b51e8219d806cd9d7b38578ec980781d116a5b2))
* **web:** increase column header space in coupling heatmap to prevent clipping ([89530af](https://github.com/TraceRicochet/gitlore/commit/89530af6b0ac568a6666141d3610ba48c68dbe4e))
* **web:** position column header text at y=100 for correct rotation visibility ([819a594](https://github.com/TraceRicochet/gitlore/commit/819a59489f223918f4948aec3d5d14ddeb1a5ecf))
* **web:** prevent author name wrapping in tooltip ([9ec006e](https://github.com/TraceRicochet/gitlore/commit/9ec006e99c8cf66b0dd9b2eb3c47d6e014daccfd))
* **web:** replace forceCenter with forceX/forceY and clamp node positions ([cdc4041](https://github.com/TraceRicochet/gitlore/commit/cdc40415ac86062d0d3f77d7185a63d55efced34))
* **web:** replace remaining LABEL_SIZE reference in coupling heatmap ([2614dcd](https://github.com/TraceRicochet/gitlore/commit/2614dcd2f6b807315f021f744895456b3e386480))
* **web:** show all authors in tooltip and detail panel, position tooltip below badge ([3902974](https://github.com/TraceRicochet/gitlore/commit/3902974b830ebf1c80c34eeceb5bfd03eaca2bb2))
* **web:** skip files without bus factor data in ownership aggregation ([b1df480](https://github.com/TraceRicochet/gitlore/commit/b1df48073db52ad9d838cf5dcfcbc39acdc15993))
* **web:** stabilize coupling force graph initial layout ([a843119](https://github.com/TraceRicochet/gitlore/commit/a843119d07588874a6e405dbd2c6ec36af171ce8))
* **web:** tooltip wrapping — remove nowrap, allow long file paths to break ([fcd5ef3](https://github.com/TraceRicochet/gitlore/commit/fcd5ef309da1dae2c7be9100abd4b898bb27600c))
* **web:** use all coupling pairs for threshold check, not just top 20 ([00a6c91](https://github.com/TraceRicochet/gitlore/commit/00a6c9132bcf98a2d7eb5153974ce1fe0d1a0c0f))
* **web:** use native title attr for stats bar tooltips (overflow-safe) ([1ef3aba](https://github.com/TraceRicochet/gitlore/commit/1ef3aba8e18a465ac3447da1b41a21a0592a2244))
* **web:** use var(--font-mono) instead of generic 'monospace' ([49318c5](https://github.com/TraceRicochet/gitlore/commit/49318c5ac79aee4a7ebf53221ef8be99936b1c46))
* **web:** wrap author tooltip — one name per line with max-width ([f27e043](https://github.com/TraceRicochet/gitlore/commit/f27e043552e00a598e1f21984d57bb9b15288993))


### Features

* **core:** expose commits array on GitloreReport for viz consumption ([8620019](https://github.com/TraceRicochet/gitlore/commit/8620019ff17dfb0864c61967b4c9ce7605520b57))
* **web:** add Activity inspector tab with signal summary ([4edbc2e](https://github.com/TraceRicochet/gitlore/commit/4edbc2ec588d2e50f7c3e617488994e5efe3ad99))
* **web:** add adaptive coupling graph hero viz (force + chord) ([c50f25c](https://github.com/TraceRicochet/gitlore/commit/c50f25cf956bee832f4e7d06c23a742a831db383))
* **web:** add all 8 bottom panel tab components ([c2395d0](https://github.com/TraceRicochet/gitlore/commit/c2395d0b2355d5759d574232172130d192dd34e7))
* **web:** add all dashboard section components ([9bbe7aa](https://github.com/TraceRicochet/gitlore/commit/9bbe7aaea5beb39d8f4ecdb6c808e83e82cb956e))
* **web:** add Badge component and theme helpers ([184ced9](https://github.com/TraceRicochet/gitlore/commit/184ced9a5b127a59ef900cb10a195671edcb78ef))
* **web:** add churn treemap hero visualization with d3-hierarchy ([10ece04](https://github.com/TraceRicochet/gitlore/commit/10ece04bb2e6ec93c6219d81f21f506644ea039a))
* **web:** add contributor swimlanes hero viz with three-layer design ([d096b39](https://github.com/TraceRicochet/gitlore/commit/d096b3991dd85fa20d2b0ffe1e4da9e64af6b0b3))
* **web:** add dashboard mode to useSelection (KAN-75, KAN-76) ([1441584](https://github.com/TraceRicochet/gitlore/commit/1441584e5fb8dcfb3f9eb09649f60f1858f99eed))
* **web:** add dashboard tree expansion to sidebar ([c7b013a](https://github.com/TraceRicochet/gitlore/commit/c7b013a780817635bd7d865050cde962b1cdde50))
* **web:** add Debt Scatter hero visualization (KAN-76) ([e78e8c8](https://github.com/TraceRicochet/gitlore/commit/e78e8c81f6004f821ad6608438e3a5873633725d))
* **web:** add FileInspector and ContributorsInspector panels ([6fa2044](https://github.com/TraceRicochet/gitlore/commit/6fa2044a193ba53d9adb0852001c2893e75f5443))
* **web:** add four-panel layout shell with sidebar, metrics, bottom panel, and inspector ([b2e63fc](https://github.com/TraceRicochet/gitlore/commit/b2e63fc8ebedbf99f8362ecc1bf6600e7503d1b0))
* **web:** add group-based tab filtering to useSelection hook ([c28c92d](https://github.com/TraceRicochet/gitlore/commit/c28c92d897f3c8bf8a40024244b9c07df99999bd))
* **web:** add group-based tab filtering with resize handle and 12 tab placeholders ([a52e6a2](https://github.com/TraceRicochet/gitlore/commit/a52e6a213d903e73810e538e020583f9748fc079))
* **web:** add Growth Timeline hero visualization (KAN-76) ([d4d7e6a](https://github.com/TraceRicochet/gitlore/commit/d4d7e6a0e39235aae08d667e2637e620600e8405))
* **web:** add hero viz switching infrastructure with 7-pill toolbar ([55bbad2](https://github.com/TraceRicochet/gitlore/commit/55bbad22c162ab4b554906a12ae7345c7cb686c0))
* **web:** add hotspot scatter plot hero viz ([b128ac6](https://github.com/TraceRicochet/gitlore/commit/b128ac60427356f1aab3bea50fe1d4bd04413c55))
* **web:** add Hotspots tab with expandable rows and signal badges ([bf353bc](https://github.com/TraceRicochet/gitlore/commit/bf353bce6e8569903489880b566bf429620be13b))
* **web:** add light theme with toggle in top bar ([44aab1e](https://github.com/TraceRicochet/gitlore/commit/44aab1eb9cb5f5fd9b0ceb48b70d5142a649949a))
* **web:** add lightweight Tooltip component ([db2c1e3](https://github.com/TraceRicochet/gitlore/commit/db2c1e370970d597ae0ff4fb7a38d697b866557b))
* **web:** add multi-mode commit graph hero viz (DAG, branches, heatmap) ([e7c90b5](https://github.com/TraceRicochet/gitlore/commit/e7c90b5201d0de7b5713a6fa049f7e716027a69b))
* **web:** add ownership bubble chart hero viz ([3d7e34b](https://github.com/TraceRicochet/gitlore/commit/3d7e34bcaeb1188fd4a040fc19eccf456c86079e))
* **web:** add Ownership Sunburst hero visualization (KAN-75) ([df0ed1d](https://github.com/TraceRicochet/gitlore/commit/df0ed1d2924956e25126d5e833fc598a8afdbcc6))
* **web:** add reusable SortableTable and Badge components ([6b89b3c](https://github.com/TraceRicochet/gitlore/commit/6b89b3c1e2eb78d3a432256992c58a09d48aa16b))
* **web:** add Risk Heatmap hero visualization (KAN-75) ([a29238a](https://github.com/TraceRicochet/gitlore/commit/a29238ac5aea3df7c43999449ffb42ca9fea930b))
* **web:** add Risk Register and Debt Inventory composite tables (KAN-75, KAN-76) ([994b621](https://github.com/TraceRicochet/gitlore/commit/994b621137f27d5b955af0f3109bbad0de166abf))
* **web:** add stacked area timeline hero viz ([dd289b6](https://github.com/TraceRicochet/gitlore/commit/dd289b6521d77a350c73d92bad61679eb9798e1b))
* **web:** add test infrastructure and semantic theme token system ([038d779](https://github.com/TraceRicochet/gitlore/commit/038d779301a8cdad4dfd81aa11678c127316507b))
* **web:** add useSelection hook for cross-linked panel state ([ba7559e](https://github.com/TraceRicochet/gitlore/commit/ba7559e3a317586f9fdf03e9b60f1c02b93ba459))
* **web:** assemble redesigned dashboard ([45f026a](https://github.com/TraceRicochet/gitlore/commit/45f026a164250b23552f187adb9a10783932f13c))
* **web:** author tooltip on ownership badges ([a7f2f69](https://github.com/TraceRicochet/gitlore/commit/a7f2f69390707590df7abce3ad0b4670784d6585))
* **web:** clickable stats bar filters the hotspot table ([165b298](https://github.com/TraceRicochet/gitlore/commit/165b2989af9e507e088de25f074414302b673c25))
* **web:** dynamic hero viz switcher and mode-aware metrics strip ([41cb7b7](https://github.com/TraceRicochet/gitlore/commit/41cb7b738c70a1c221f4d812388b9c734b6c13f3))
* **web:** expand sidebar with T2 navigation items ([95e5490](https://github.com/TraceRicochet/gitlore/commit/95e5490907eb63e8f70269e94c92458bc0d32432))
* **web:** file row drill-down in hotspot table ([9e68337](https://github.com/TraceRicochet/gitlore/commit/9e68337012fa03b58b69b45c51a0df7f1583c391))
* **web:** hover explanations on stats bar cells ([08e0d0d](https://github.com/TraceRicochet/gitlore/commit/08e0d0d476f640cece4519f34b3714844674648e))
* **web:** implement Blast Radius tab ([0bf68e6](https://github.com/TraceRicochet/gitlore/commit/0bf68e6abd0e8bef398f4fd3da2938dcd52b87aa))
* **web:** implement Churn Velocity tab ([91e7bc9](https://github.com/TraceRicochet/gitlore/commit/91e7bc9dc16bd6d4243fce4868058f03e6ccb2d2))
* **web:** implement Co-Authors tab ([5f623c0](https://github.com/TraceRicochet/gitlore/commit/5f623c07bb19c8e44a1e8911483af22aa6980690))
* **web:** implement Commit Timing tab with stress scores ([8b98c13](https://github.com/TraceRicochet/gitlore/commit/8b98c1314fe63038056c879471dab330d872613c))
* **web:** implement Complexity Trend tab ([fdefcb0](https://github.com/TraceRicochet/gitlore/commit/fdefcb01029094e47463828761c153b1595fcc7c))
* **web:** implement Dead Code tab with age badges ([c73c271](https://github.com/TraceRicochet/gitlore/commit/c73c2718ae2bc11255171e61ad7c0fcf33b805c3))
* **web:** implement Ghost Files tab ([d2739bc](https://github.com/TraceRicochet/gitlore/commit/d2739bcdf3336aeb25f040cfbb32eec77acc9c89))
* **web:** implement Knowledge Silos tab with concentration index ([3cab034](https://github.com/TraceRicochet/gitlore/commit/3cab034de9f2c249af17ee474982e76d236bd84a))
* **web:** implement Languages tab with percentage bars ([7c934be](https://github.com/TraceRicochet/gitlore/commit/7c934bef3690a180f763e2fd98193216f053c31e))
* **web:** implement Renames tab with history chains ([9dc714d](https://github.com/TraceRicochet/gitlore/commit/9dc714d291013e2b759ba0a873653dd778dd4d64))
* **web:** implement Rewrite Ratio tab ([6d7e21e](https://github.com/TraceRicochet/gitlore/commit/6d7e21e39470a59bdd34ff672fc14834397b62e9))
* **web:** implement Test Coverage tab with ratio bars ([84cc2d0](https://github.com/TraceRicochet/gitlore/commit/84cc2d0a6d1727cefe1d90d2e8b2986230ded8ca))
* **web:** redesign ownership bubble to show directory-level ownership with legend ([20a276a](https://github.com/TraceRicochet/gitlore/commit/20a276a8b185f00b1e4f372314cb6cb50c064f4f))
* **web:** replace chord diagram with coupling heatmap for large repos ([1edc1cb](https://github.com/TraceRicochet/gitlore/commit/1edc1cb7f9a23b5b33b650906983ed46b93fb561))
* **web:** sortable hotspot table columns ([42f6cac](https://github.com/TraceRicochet/gitlore/commit/42f6caccd44b14cd458f9ef00f0b5c263852d885))
* **web:** split inspector into context and utility sections with Guide panel ([4572c76](https://github.com/TraceRicochet/gitlore/commit/4572c76af97e136d4e6b6dbcc9ec44488bdc7de7))


### Reverts

* **web:** remove stats bar title tooltips — methodology drawer coming instead ([7e499ec](https://github.com/TraceRicochet/gitlore/commit/7e499ec8f828034b4188bc9c3469e76e704ba11d))

# [1.2.0](https://github.com/TraceRicochet/gitlore/compare/v1.1.0...v1.2.0) (2026-04-06)


### Features

* T1-T3 dashboard redesign with IDE-style layout and 7 hero visualizations ([#4](https://github.com/TraceRicochet/gitlore/issues/4)) ([9072d00](https://github.com/TraceRicochet/gitlore/commit/9072d0009722a9f95c2133f8fa1c9daa76d44540)), closes [#2](https://github.com/TraceRicochet/gitlore/issues/2)

# [1.1.0](https://github.com/TraceRicochet/gitlore/compare/v1.0.0...v1.1.0) (2026-04-06)


### Features

* **web:** IDE-style dashboard redesign (T1 + T2) ([#2](https://github.com/TraceRicochet/gitlore/issues/2)) ([685f9ed](https://github.com/TraceRicochet/gitlore/commit/685f9ed9cc98bc5c08a14a958b03fd599d9d601d))

# 1.0.0 (2026-04-06)


### Bug Fixes

* add forensics placeholder to runner return, document shame-only file behavior ([08d414c](https://github.com/TraceRicochet/gitlore/commit/08d414cdc7df2ca57cac3a8f83e319b4a4893681))
* add missing beforeEach import in test files, add test suite docs ([5a33664](https://github.com/TraceRicochet/gitlore/commit/5a336648b0daec48d8e88e82c0b50e1221008f72))
* **cli:** fix narrative truncation splitting on email dots ([d8af357](https://github.com/TraceRicochet/gitlore/commit/d8af357048397d13dcb9576a7d3ac685b52aef94))
* **core:** add minimum floors to active/ghost contributor windows ([db54500](https://github.com/TraceRicochet/gitlore/commit/db54500f3b6aab0c049a91b7350d147abfdf9188))
* **core:** exclude .claude/ and project meta files from analysis ([67c3160](https://github.com/TraceRicochet/gitlore/commit/67c3160881b295802baf5167b5de3b6cfc2c7e43))
* deduplicate multi-signal dimensions and cap display lists ([7ef8422](https://github.com/TraceRicochet/gitlore/commit/7ef8422a87fe5bb2eda7979028043fbbe0f5d9a8))
* pre-compile shame regexes, deduplicate totalShameCommits, avoid in-place sort ([a25e11a](https://github.com/TraceRicochet/gitlore/commit/a25e11a30aac989e884be485bfdf42b53bc8ff2b))
* remove scaffolding comment, align forensics section ruler width ([928caed](https://github.com/TraceRicochet/gitlore/commit/928caedb50ba83f016ce6e8446a0b97c4bf26b84))
* remove unnecessary blank line in runLore function documentation ([a35ba75](https://github.com/TraceRicochet/gitlore/commit/a35ba759dff1686e77fc0dbfb9c3b3038ae0b6e1))
* resolve some sickbay issue findings around index as key and other things ([5adf8f7](https://github.com/TraceRicochet/gitlore/commit/5adf8f76a11a5818eb5bd57a1d6aec486b90c605))
* update getAllCommits JSDoc, restore authorEmail/Name assertions in test ([6706776](https://github.com/TraceRicochet/gitlore/commit/6706776c7d7063cee670260ea44f3f7af10ef9df))


### Features

* add --shame flag and ShamePanel to CLI ([36b1911](https://github.com/TraceRicochet/gitlore/commit/36b1911ecea647b57a2bed939d9a81a1bdc57050))
* add forensics analyzer with weighted shame scoring ([cdb023f](https://github.com/TraceRicochet/gitlore/commit/cdb023faa89e99c5342ef8197c8d208c59f65674))
* add ForensicsReport types to LoreReport ([5623040](https://github.com/TraceRicochet/gitlore/commit/5623040e33d4d546c7fa5d9ecf26aedf26df3e2f))
* add message field to RawCommit, extend git log format ([a6522fa](https://github.com/TraceRicochet/gitlore/commit/a6522faadbfa70df393a40eddd6416e0103ee3a8))
* call analyzeForensics in runner, include forensics in LoreReport ([3210bd2](https://github.com/TraceRicochet/gitlore/commit/3210bd252c501a9f5f6e1ea19783727fe590fbf1))
* **cli:** add hotspot and coupling panels ([25904af](https://github.com/TraceRicochet/gitlore/commit/25904af846cd25b0f854c4beb6321e129b8643e3))
* **cli:** add hotspot health sentiment — narrative, entry colors, all-clear state ([45a6bc7](https://github.com/TraceRicochet/gitlore/commit/45a6bc77d2640182ba15aada24ec5e2f8844039e))
* **cli:** add hotspot root cause clustering panel ([4aa51d3](https://github.com/TraceRicochet/gitlore/commit/4aa51d3a92cba68a39e644ff6daffafd5284ddf3))
* **cli:** add test coverage, ghost files, knowledge, co-author panels ([135b382](https://github.com/TraceRicochet/gitlore/commit/135b38212e47630bb4c3ad4d791afea5346bbdbf))
* **cli:** add velocity, rewrite, blast radius, and dead code panels ([ac81820](https://github.com/TraceRicochet/gitlore/commit/ac81820311c63c5142ae33770976be40ac8eea02))
* **core:** add batch 2 types and extend RawCommit with per-file stats ([9915bc0](https://github.com/TraceRicochet/gitlore/commit/9915bc01e03d2aafe9f32560a11c72a75abb2dc4))
* **core:** add churn velocity, rewrite ratio, blast radius, dead code analyzers ([8da8258](https://github.com/TraceRicochet/gitlore/commit/8da825897a6746678daaf4c9e7d6285e056833f7))
* **core:** add complexity trend analyzer with tests ([0c502c3](https://github.com/TraceRicochet/gitlore/commit/0c502c3149508c733f4ff04481c7c606566425ea))
* **core:** add complexity trend types ([3e05bfc](https://github.com/TraceRicochet/gitlore/commit/3e05bfcdb2cb94e399f8d9cadd1a1f6ad4d4b723))
* **core:** add coupling hub detection dimension ([9a6ad0c](https://github.com/TraceRicochet/gitlore/commit/9a6ad0c2c20767d24195e4fe9228e5bfe551af26))
* **core:** add hotspot clustering types ([ae7fa78](https://github.com/TraceRicochet/gitlore/commit/ae7fa7840234cb0b2e1ddd2c23e1c866a1ca5757))
* **core:** add LOC, hotspot, and coupling analyzers ([bbf2921](https://github.com/TraceRicochet/gitlore/commit/bbf29215f955cb50be85d2fd43d5dac8cc559e16))
* **core:** add LOC, hotspot, and coupling report types ([37fc8d6](https://github.com/TraceRicochet/gitlore/commit/37fc8d666d50d4b0a2407577679164537c94b003))
* **core:** add ownership clustering dimension ([53861e0](https://github.com/TraceRicochet/gitlore/commit/53861e08df8b4f18ec9b0236c7fca1fb37a7292d))
* **core:** add parallel development types ([419692d](https://github.com/TraceRicochet/gitlore/commit/419692d489b59a3bd0a4035be327329e50d70403))
* **core:** add rename tracking and commit timing forensics analyzers ([edf9c80](https://github.com/TraceRicochet/gitlore/commit/edf9c80cba167c26c2af36d723f6f1aecfa951f8))
* **core:** add structural clustering dimension + assembly ([0708876](https://github.com/TraceRicochet/gitlore/commit/070887612299ff9159632bac2c68a82bb35c809d))
* **core:** add temporal clustering dimension with inflection detection ([a8f215f](https://github.com/TraceRicochet/gitlore/commit/a8f215fc218a700641f1a63436807be8117ea3e1))
* **core:** add test coverage proxy, ghost files, knowledge concentration, co-author analyzers ([c49891c](https://github.com/TraceRicochet/gitlore/commit/c49891c29a4b65330e2e023147c64c24d4470eb6))
* **core:** add test coverage, ghost files, knowledge concentration, co-author types ([68e75b0](https://github.com/TraceRicochet/gitlore/commit/68e75b0ffc6bc445e0ed5d4fa863ae35cb7165d5))
* **core:** implement parallel development analyzer ([2995e00](https://github.com/TraceRicochet/gitlore/commit/2995e0008739f92f1d30a728fe4691e7cec78708))
* **core:** integrate complexity trend into runner and exports ([af736eb](https://github.com/TraceRicochet/gitlore/commit/af736eb60ff3738daa579fee8fffdcd03d2b70f2))
* **core:** integrate parallel development into cursed file scoring ([82232d8](https://github.com/TraceRicochet/gitlore/commit/82232d8fd9a605b64b139aa4f84a7de96e5bae0f))
* **core:** wire churn velocity, rewrite ratio, blast radius, dead code into runner ([4a7d972](https://github.com/TraceRicochet/gitlore/commit/4a7d972a3fec8819754a8095ed29fa356a97827f))
* **core:** wire hotspot clustering into runner and exports ([642a955](https://github.com/TraceRicochet/gitlore/commit/642a9555d2104789095ae2de3e217b2118886110))
* **core:** wire LOC, hotspot, and coupling analyzers into runner ([d11941c](https://github.com/TraceRicochet/gitlore/commit/d11941ce348023e579231ed0dffa5c9ff3b44bef))
* **core:** wire parallel development analyzer into runner ([100640c](https://github.com/TraceRicochet/gitlore/commit/100640cc4d60f69caece1e695efe7478d4870e4c))
* **core:** wire test coverage, ghost files, knowledge concentration, co-authors into runner ([d275b3e](https://github.com/TraceRicochet/gitlore/commit/d275b3e43bd378e67ed08907697f2ea65ddddc9c))
* **dashboard:** add hotspot health sentiment — narrative, entry colors, all-clear state ([dd4c7d7](https://github.com/TraceRicochet/gitlore/commit/dd4c7d791c436385a1b7fbb750f6e531d51d982c))
* **dashboard:** add hotspot root cause clusters to Hotspots tab ([2dc030a](https://github.com/TraceRicochet/gitlore/commit/2dc030aa9251ce934d4ee4f659263fa343191cbb))
* **dashboard:** add parallel dev tab and hotspot leaderboard tab ([d765f43](https://github.com/TraceRicochet/gitlore/commit/d765f43cf54c0c9c36198fdc719c48e22fae1b5e))
* **dashboard:** add shame tab with forensics leaderboard and detail view ([7a9bd1f](https://github.com/TraceRicochet/gitlore/commit/7a9bd1f79d76ff0dffe5d51feaaa6134933b97cf))
* **dashboard:** collapsible hotspot sections, merge leaderboard, exclude docs/ ([846b02b](https://github.com/TraceRicochet/gitlore/commit/846b02bceb8bdcc72c3b3c2536f3cdf68c9436c8))
* **dashboard:** enhance cursed files display with author tooltips and improved layout ([50b8b88](https://github.com/TraceRicochet/gitlore/commit/50b8b88bcab89bad3e7ba6fb077a0a1f63bfb0ae))
* **kanban:** update project name references from Lore to Fossick ([21ce578](https://github.com/TraceRicochet/gitlore/commit/21ce578c713c07198ca64444ee02cc195b2540e3))
* update kanban and skill documentation with new metrics and integrations; fix package.json test filters for lore packages ([347b25a](https://github.com/TraceRicochet/gitlore/commit/347b25a96f7146d7464e9d0d95fd844c52de3ce8))
* **web:** update hotspots tab and add coupling tab to dashboard ([7de879e](https://github.com/TraceRicochet/gitlore/commit/7de879e2e34431e3a78028ab6ada4624e5ea8e55))
* wire forensics shame score into cursed file scoring (+20 max bonus) ([cd77870](https://github.com/TraceRicochet/gitlore/commit/cd77870d2717fb0f0ed922c08bb02186a17b541b))

# Changelog

All notable changes to this project will be automatically documented here by [semantic-release](https://github.com/semantic-release/semantic-release).
