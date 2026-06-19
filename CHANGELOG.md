# DX Extensions Changelog

## Unreleased

- Created the official DX extensions workspace as an isolated git repository.
- Added the first typed extension manifest crate and registry entry.
- Added schema-generated TypeScript declarations for the shared DX extension
  manifest contract, with a check script to catch stale declarations.
- Hardened shared extension manifest validation for shell-free entrypoints,
  metadata-only receipt paths, checksum requirements, and browser
  permission-to-capability parity.
- Added a machine-checkable official extension readiness ledger that keeps
  every adapter at an explicit proof stage and blocks release-ready claims
  until loaded-host, package, signing, checksum, and distribution receipts are
  recorded.
- Added a source-level readiness receipt writer so guarded `test:j1` and
  `verify:j1` runs can emit ignored `.dx/receipts/extensions/*/readiness-latest.json`
  evidence without claiming loaded-host or release proof.
- Added loaded-host preflight receipts that recompute existing package-output
  hashes and keep host execution, marketplace proof, and release readiness
  explicitly false.
- Added platform host-discovery receipts for every official adapter, with
  local-tooling, manual-only, and cloud-service status buckets, without
  launching proprietary hosts.
- Added an extension progress report that counts official adapters,
  package-output proofs, preflight receipts, host-discovery status buckets, and
  release-stage gaps.
- Updated the extension progress report so Affinity `content-package-latest.json`
  counts as package-output proof instead of leaving Affinity undercounted.
- Added a release evidence gate matrix covering host execution, package output,
  signing, checksum, and distribution proof before release-ready claims.
- Added a release evidence gap report that checks declared release receipt paths
  and writes ignored missing-proof evidence without launching hosts.
- Added operator proof templates for Chrome, Microsoft Edge, and Firefox
  loaded-profile proof input. These templates are invalid by default and do not
  claim loaded-browser, native-host, signing, checksum, store, or release proof
  until the guarded browser loaded-profile receipt writer validates real
  launched-profile evidence.
- Added a guarded VS Code loaded-host proof JSON importer and matching operator
  proof template for Extension Development Host metadata evidence. The importer
  validates package-output linkage and metadata-only command proof without
  claiming signing, release checksum, Marketplace review, distribution, or
  release readiness.
- Extended operator proof template metadata with explicit multi-receipt outputs
  for guarded writers that can emit several release-gate receipts from one proof
  input, including Figma, Google Workspace, Blender, and Sketch.
- Added Adobe UXP operator proof templates for Photoshop, Premiere Pro, and
  InDesign loaded-host, Developer Console plugin-id, and CCX package proof,
  plus native plugin proof inputs for Premiere Pro and InDesign.
- Updated the DaVinci Resolve loaded-host operator template to advertise its
  optional workflow-integration receipt output.
- Hardened Office and Google Workspace package-output source freshness so
  receipts now hash sideload manifests, taskpane HTML, Apps Script entrypoints,
  and cloud-service boundary source alongside generated package files.
- Hardened Figma, Canva, Sketch, Blender, Obsidian, and Affinity package-output
  source freshness so generated package receipts fail when their adapter source
  inputs drift after packaging.
- Hardened the Visual Studio local-service boundary so metadata request helpers
  preserve host-UI receipt actions that do not require runtime proof.
- Added operator proof templates for IntelliJ Platform sandbox IDE proof,
  IntelliJ Plugin Verifier proof, Visual Studio Experimental Instance proof,
  Unity loaded-host and project-import proof, and Unreal loaded-host and
  project-enablement proof. These templates are invalid proof inputs only and
  do not write release receipts until guarded writers validate real host
  evidence.
- Centralized IntelliJ Plugin Verifier, Unity project-import, and Unreal
  project-enablement release evidence classification in the shared special-proof
  classifier.
- Added a guarded Office and Google Workspace public release package checksum
  workflow that creates deterministic ZIP artifacts from existing package-output
  receipts, writes proof JSON, and emits ignored `checksum-latest.json` receipts
  without claiming loaded-host, signing, review, or distribution proof.
- Added a guarded standard package-output public release checksum workflow for
  adapters with current host-free package-output receipts, while leaving Browser
  and stale Zed package evidence on separate refresh paths and without claiming
  loaded-host, signing, review, marketplace, or distribution proof.
- Added a guarded Affinity public release package checksum workflow that creates
  a deterministic content ZIP from the Affinity content-package receipt and
  emits an ignored `checksum-latest.json` receipt without claiming manual import,
  signing, loaded-app, store review, or distribution proof.
- Changed the release evidence gap report to derive blocker text from missing
  and weak receipt obligations, so Browser evidence can show a captured Edge
  profile receipt without still listing Edge as blocked.
- Hardened Zed loaded dev-extension proof so release-valid host execution now
  requires installed source/index/log evidence, executable hashing, and
  package-matched WebAssembly proof instead of slash-command availability.
- Hardened Zed loaded-host classification so extension index, host log, and
  WebAssembly artifact proof must still match current files and the linked
  package-output receipt.
- Tightened release evidence gates into explicit `kind=receipt` obligations,
  including manifest-required local-service/cloud-service proof and kind-level
  gap-report counters, while keeping every adapter not release-ready until real
  receipts exist.
- Split release evidence gap reporting between per-kind receipt obligations and
  unique receipt-path counts, so shared proof files are visible without hiding
  missing release obligations.
- Hardened source-level host scaffolds by making Unreal command lookup fail
  closed for unknown command IDs and by declaring the Visual Studio package
  menu resource needed for VSCT command surfacing.
- Added the initial VS Code command-center host adapter scaffold.
- Added a shared typed Office local-service request boundary for Excel,
  PowerPoint, and Word task-pane status/search actions, with coarse host-state
  context only, while keeping live local-service proof deferred.
- Added a shared hosted Office task-pane asset build proof for Excel,
  PowerPoint, and Word using a TypeScript esbuild helper and temp-directory
  test. The guarded `build:office-taskpane:j1` wrapper emits ignored
  `dist/taskpane.html`, `dist/taskpane.js`, and source maps only when
  explicitly requested. Sideloaded Office smoke, live local-service proof,
  signing, checksum receipts, AppSource approval, and release proof remain
  deferred.
- Added a guarded Office sideload manifest output proof for Excel,
  PowerPoint, and Word. The helper emits ignored `dist/manifest.xml` files
  with a caller-provided HTTPS origin, removes the inert source placeholder,
  and preserves read-only Office permissions. Loaded Office sideload smoke,
  live local-service proof, signing, checksum receipts, AppSource approval, and
  release proof remain deferred.
- Added host-free Office package-output checksum receipts for Excel,
  PowerPoint, and Word. The receipts hash sideload `manifest.xml`,
  `taskpane.html`, generated `taskpane.js`, and source maps while keeping
  sideloaded host smoke, live local-service proof, signing, AppSource approval,
  release checksums, and release proof deferred.
- Added a guarded Office sideloaded-host receipt writer for Excel, PowerPoint,
  and Word. It requires explicit metadata-only proof JSON, verifies package
  receipt and sideload manifest hashes, rejects privacy-sensitive document or
  tenant metadata, and keeps local-service, signing, release checksum,
  AppSource, and distribution claims false.
- Split Adobe UXP receipt-path actions from local-service runtime proof:
  Photoshop, Premiere Pro, and InDesign now mark receipt metadata actions as
  host-UI loaded-host proof gates while keeping status and search actions
  local-service proof-gated.
- Added single-job verification and build policy for low-memory Windows work.
- Added a guarded Blender package-layout output proof and host-free checksum
  receipt for `blender_manifest.toml` plus `__init__.py`, while keeping loaded
  Blender smoke, installed add-on proof, package archive proof, signing,
  release checksums, marketplace review, and release proof deferred.
- Added a test-covered VS Code DX command-plan allowlist for shell-free command execution.
- Added VS Code host-action parity across manifest actions, command plans,
  command contributions, activation events, and host-UI receipt opening.
- Hardened VS Code package metadata so compiled source maps are excluded from
  VSIX file lists and package verification catches regressions.
- Added a guarded VS Code `.vsix` package-output checksum receipt writer wired
  into `package:vscode:j1` after `vsce package`, while keeping captured VSIX
  package-output evidence, loaded Extension Development Host smoke, signing,
  release checksums, Marketplace review, and distribution proof deferred.
- Hardened the TypeScript source policy so unapproved package metadata and
  Git-visible generated JavaScript output cannot be committed as host source.
- Added a generated-output ignore validator for browser, VS Code, Obsidian, and
  Figma build/package artifacts.
- Started experimental DX Browser Command Center support with Chromium/Firefox
  MV3 manifests, typed browser command plans, native-host request/response
  parsing, manifest policy tests, and static popup/sidebar/options surfaces.
- Added development-only, user-scoped browser native-host manifest templates,
  guarded install wrappers, and a typed native messaging transport boundary.
- Wired experimental browser command-center UI clicks into typed background
  dispatch for approved native-host actions and host-UI receipt actions, without
  releasing end-to-end native execution.
- Added a host-free Browser Command Center package-output checksum receipt
  writer for the generated Chrome, Microsoft Edge, and Firefox `dist/browser`
  layouts, while keeping loaded browser profile proof, native-host release
  packaging, signing, release checksums, store review, and distribution proof
  deferred.
- Added the first Rust DX browser native-host executable with native-messaging
  framing tests, while keeping installed-browser execution as a release gate.
- Added a guarded process-level browser native-host binary smoke test that proves
  the JavaScript transport boundary can talk to the real Rust executable.
- Added semantic official-registry validation for official extension metadata
  and folder policy, without changing release status for host packaging,
  loaded-host smoke tests, signing, or browser DX CLI-backed execution.
- Linked official registry entries to validated professional host targets, so
  first-party adapter metadata stays traceable to the planning catalog without
  claiming release readiness.
- Added an official extension starter gate for future professional-software host
  adapters, keeping source work registry-first and guarded by `j1` verification.
- Added a validated professional host target catalog for planning future DX
  adapters without claiming registry membership, package readiness, signing, or
  loaded-host proof.
- Added source-level browser native-host DX CLI command boundary support for
  `dx status` and `dx doctor`, keeping installed/loaded browser execution proof,
  signing, checksums, and release packaging deferred.
- Added installed native-host DX CLI execution for the allowlisted `dx status`
  and `dx doctor` plans, while keeping loaded-browser dispatch, signing,
  checksums, and release packaging deferred.
- Added Windows PowerShell and macOS/Linux shell manifest-only browser
  native-host install/uninstall proof for Chrome, Edge, and Firefox, keeping
  the checks non-destructive and separate from loaded-browser dispatch proof.
- Wired a profileless loaded-background native-host receipt smoke into the
  guarded browser native-host `j1` wrapper. Real loaded Chrome, Microsoft Edge,
  and Firefox profile proof remains deferred.
- Added a strict Browser loaded-profile receipt writer that only records real
  launched profile proof with package-output evidence, extension id,
  native-host registration, background service worker proof, and Status, Forge
  Packages, and Build Graph native-host round trips. Captured Chrome, Edge, and
  Firefox profile receipts remain deferred.
- Clarified the next extension ecosystem slice as loaded-host proof work for
  existing source scaffolds, starting with VS Code and browser/Edge receipts,
  without claiming release readiness, marketplace readiness, or plugin ecosystem
  readiness.
- Promoted Microsoft Edge from shared browser compatibility to a first-class
  browser distribution target under the DX Browser Command Center, with a
  dedicated Edge manifest artifact, separate Edge extension-id/native-host proof
  language, and deferred loaded Edge smoke, Edge Add-ons package/review,
  signing, checksum, and release packaging gates.
- Added `hosts/blender/dx-blender` as the first professional creative-tool
  adapter scaffold, with a Blender 4.2 add-on manifest, Python registration and
  sidebar operators, official experimental registry metadata, fixed shell-free
  argv for approved DX commands, and a `test:blender-adapter` guard. Loaded-host
  smoke, package proof, signing, checksum receipts, marketplace approval, and
  release packaging remain deferred.
- Added `hosts/obsidian/dx-command-center` as the first professional
  knowledge-workspace adapter scaffold, with an Obsidian desktop plugin
  manifest, TypeScript command runner, command palette and ribbon actions,
  official experimental registry metadata, fixed shell-free argv for approved DX
  commands, and a `test:obsidian-adapter` guard. Loaded test-vault smoke, built
  release assets, signing, checksum receipts, community plugin review, and
  package proof remain deferred.
- Added an Obsidian bundle-output proof using a TypeScript esbuild helper and
  temp-directory test, plus a guarded `build:obsidian:j1` wrapper that emits the
  ignored `main.js` only when explicitly requested. Loaded test-vault smoke,
  release packaging, signing, checksum receipts, and community plugin review
  remain deferred.
- Added a host-free Obsidian package-output checksum receipt for
  `manifest.json`, generated `main.js`, and source map files, while keeping
  loaded test-vault smoke, release assets, signing, release checksums,
  community plugin review, and distribution proof deferred.
- Added `hosts/figma/dx-figma` as the first professional design-tool adapter
  scaffold, with a Figma plugin manifest, typed plugin UI message plans, static
  command-center UI, official experimental registry metadata, production network
  access disabled, and a `test:figma-adapter` guard. Loaded Figma desktop smoke,
  generated plugin ID replacement, compiled plugin assets, local-service proof,
  signing, checksum receipts, Community review, and package proof remain
  deferred.
- Added a Figma bundle-output proof using a TypeScript esbuild helper and
  temp-directory test, plus a guarded `build:figma:j1` wrapper that emits the
  ignored `main.js` only when explicitly requested. Loaded Figma desktop smoke,
  generated plugin ID replacement, live local-service proof, signing, checksum
  receipts, and Community review remain deferred.
- Added host-free Figma package-output checksum receipts for the host-loadable
  `manifest.json`, `ui.html`, generated `main.js`, and source map files, while
  keeping loaded Figma desktop smoke, plugin ID replacement, signing, Community
  review, and release proof deferred.
- Added Figma UI message validation so plugin messages enter command dispatch
  only after an `unknown` payload is checked against the typed DX message
  contract. Loaded Figma desktop smoke and local-service proof remain deferred.
- Added `hosts/canva/dx-canva` as a professional Canva Apps SDK adapter
  scaffold, with Canva app configuration, typed message plans, a source-level
  design-editor command surface, official experimental registry metadata, no
  requested Canva runtime permissions, no direct process bridge, no network
  bridge, no external URL opening, no design mutation, and a
  `test:canva-adapter` guard. Development Canva app smoke, bundle proof,
  local-service proof, Canva review, signing, checksum receipts, and release
  proof remain deferred.
- Added a Canva app bundle-output proof using a TypeScript esbuild helper and
  temp-directory test, plus a guarded `build:canva:j1` wrapper that emits the
  ignored `app.js` only when explicitly requested. Development Canva app smoke,
  live local-service proof, Canva review, signing, checksum receipts, and
  release proof remain deferred.
- Added host-free Canva package-output checksum receipts for `canva-app.json`,
  generated `app.js`, and source map files, while keeping development Canva app
  smoke, live local-service proof, Canva review, signing, release checksums, and
  release proof deferred.
- Added a Sketch plugin bundle-output proof using a TypeScript esbuild helper
  and temp-directory test, plus a guarded `build:sketch:j1` wrapper that emits
  an ignored `.sketchplugin` layout only when explicitly requested.
- Added a host-free Sketch package-output checksum receipt for the generated
  `.sketchplugin` layout. The receipt records package files, SHA-256 hashes,
  build inputs, and explicit false release claims. Loaded Sketch plugin smoke,
  sketchtool run proof, local-service proof, release package proof, signing,
  release checksum proof, notarization, Plugin Directory review, and release
  proof remain deferred.
- Added a shared Adobe UXP package-layout build proof for Photoshop, Premiere
  Pro, and InDesign using a TypeScript esbuild helper and temp-directory test.
  The guarded `build:adobe-uxp:j1` wrapper emits ignored `dist` folders with
  copied manifests, rewritten HTML, generated `index.js`, and source maps only
  when explicitly requested.
- Added host-free Adobe UXP package-output checksum receipts for Photoshop,
  Premiere Pro, and InDesign. The receipts record package files, SHA-256
  hashes, required-permission safety, build inputs, and explicit false release
  claims. Loaded UXP smoke, UXP Developer Tool receipts, document/project-safe
  runtime proof, local-service proof, `.ccx` package proof, signing, release
  checksum proof, Creative Cloud review, native SDK/hybrid plugin proof, and
  release proof remain deferred.
- Added a host-free DaVinci Resolve package-output checksum receipt for the
  metadata-only command plans plus Python and Lua scripts, while keeping loaded
  Resolve smoke, read-only project metadata proof, Workflow Integration proof,
  local-service proof, signing, release checksums, and distribution proof
  deferred.
- Hardened the DaVinci Resolve Developer documentation proof wrapper with the
  shared competing-process guard, receipt-writer test, and generated-output
  ignore verification.
- Added a host-free IntelliJ Platform Gradle source-layout checksum receipt,
  while keeping sandbox IDE smoke, Gradle plugin package proof, Plugin Verifier,
  local-service proof, signing, release checksums, Marketplace review, and
  release proof deferred.
- Added a host-free Visual Studio VSIX source-layout checksum receipt, while
  keeping Experimental Instance smoke, MSBuild `.vsix` package proof,
  local-service proof, signing, release checksums, Marketplace review, and
  release proof deferred.
- Added a host-free Unity Editor package-layout checksum receipt for the
  checked-in UPM source layout, while keeping loaded Unity Editor smoke,
  package tarball proof, project import proof, local-service proof, signing,
  release checksums, Asset Store review, and release proof deferred.
- Added a host-free Unreal Engine source-plugin package-layout checksum receipt
  for the checked-in editor plugin layout, while keeping loaded Unreal Editor
  smoke, packaged plugin archive proof, sample-project enablement,
  local-service proof, signing, release checksums, Fab/Marketplace review, and
  release proof deferred.
- Added `hosts/sketch/dx-sketch` as a professional Sketch plugin adapter
  scaffold, with a Sketch plugin manifest, typed command plans and handlers for
  DX status, asset search, document-safe metadata, and receipt path actions,
  official experimental registry metadata, no direct process bridge, no network
  bridge, no document mutation, and a `test:sketch-adapter` guard. Loaded Sketch
  plugin smoke, sketchtool run proof, local-service proof, package proof,
  signing, checksum receipts, notarization, Plugin Directory review, and release
  proof remain deferred.
- Added `hosts/adobe/dx-photoshop-uxp` as the first Adobe Photoshop UXP adapter
  scaffold, with a Photoshop UXP Manifest v5 plugin manifest, typed message
  plans, static panel and command entries for DX status, asset search, and
  receipt path actions, official experimental registry metadata, empty UXP
  `requiredPermissions`, no direct process bridge, and a
  `test:photoshop-adapter` guard. Loaded Photoshop UXP smoke, UXP Developer
  Tool receipt, document-safe runtime proof, local-service proof, `.ccx`
  package proof, signing, checksum receipts, Creative Cloud review, and release
  proof remain deferred.
- Added `hosts/adobe/dx-premiere-pro-uxp` as an Adobe Premiere Pro UXP adapter
  scaffold, with a Premiere Pro UXP plugin manifest, typed message plans,
  static panel and command entries for DX status, media search, project-safe
  metadata, and receipt path actions, official experimental registry metadata,
  no native/hybrid plugin bridge, no direct process bridge, and a
  `test:premiere-pro-adapter` guard. Loaded Premiere Pro UXP smoke,
  project-safe runtime proof, local-service proof, package proof, signing,
  checksum receipts, Creative Cloud review, native SDK/hybrid plugin proof, and
  release proof remain deferred.
- Added `hosts/adobe/dx-indesign-uxp` as an Adobe InDesign UXP adapter
  scaffold, with an InDesign UXP plugin manifest, typed message plans, static
  panel and command entries for DX status, typography and asset search,
  document-safe metadata, and receipt path actions, official experimental
  registry metadata, no native/hybrid plugin bridge, no direct process bridge,
  TypeScript source files, and a `test:indesign-adapter` guard. Loaded
  InDesign UXP smoke, document-safe runtime proof, local-service proof, `.ccx`
  package proof, signing, checksum receipts, Creative Cloud review, native
  SDK/hybrid plugin proof, and release proof remain deferred.
- Added `hosts/blackmagic/dx-davinci-resolve` as the first Blackmagic Design
  DaVinci Resolve scripting adapter scaffold, with Python/Lua metadata-only
  command plans for DX status, read-only project inspection, and receipt path
  actions, official experimental registry metadata, no project mutation, no
  render automation, no local-network scripting, no process bridge, and a
  `test:davinci-resolve-adapter` guard. Loaded DaVinci Resolve smoke, Workflow
  Integration/external scripting proof, local-service proof, signing, checksum
  receipts, Blackmagic distribution proof, and release proof remain deferred.
- Added `hosts/jetbrains/dx-intellij-platform` as an IntelliJ Platform Kotlin
  plugin scaffold, with Gradle plugin metadata, `plugin.xml` action/tool-window
  and project-service registrations, typed command plans, official experimental
  registry metadata, no process bridge, no network bridge, no inspections, and
  a `test:intellij-platform-plugin-adapter` guard. Sandbox IDE smoke, Plugin
  Verifier, local-service proof, signing, checksum receipts, Marketplace review,
  and release proof remain deferred.
- Added `hosts/visual-studio/dx-visual-studio` as a Visual Studio SDK VSIX
  scaffold, with VSIX manifest metadata, project file, command declarations,
  typed C# command plans, official experimental registry metadata, no process
  bridge, no network bridge, no solution mutation, and a
  `test:visual-studio-sdk-plugin-adapter` guard. Experimental Instance smoke,
  VSIX package proof, local-service proof, signing, checksum receipts,
  Marketplace review, and release proof remain deferred.
- Added `hosts/unity/dx-unity-editor` as a Unity Editor package scaffold, with
  Unity package metadata, Editor-only asmdefs, menu/window source, typed command
  plans, official experimental registry metadata, no process bridge, no network
  bridge, no asset import/mutation, and a `test:unity-editor-plugin-adapter`
  guard. Loaded Unity Editor test-project smoke, local-service proof, package
  tarball/checksum proof, signing, Asset Store/distribution review, and release
  proof remain deferred.
- Added `hosts/unreal/dx-unreal-engine` as an Unreal Engine editor plugin
  scaffold, with `.uplugin` metadata, one editor-only module, tool-menu source,
  typed C++ command plans, official experimental registry metadata, no runtime
  module, no content plugin, no process bridge, no network bridge, no asset
  import, and a `test:unreal-engine-plugin-adapter` guard. Loaded Unreal sample
  project smoke, local-service proof, package signing, checksum receipts,
  Fab/Marketplace review, and release proof remain deferred.
- Added `hosts/google-workspace/dx-google-workspace-addon` as a Google
  Workspace Apps Script add-on scaffold, with minimal `appsscript.json`,
  homepage card models, typed action plans, metadata-only cloud-service request
  boundary, no OAuth scopes, no Google app content mutation, official
  experimental registry metadata, and a `test:google-workspace-addon-adapter`
  guard. Apps Script deployment, OAuth consent/review, test Workspace file
  smoke, cloud-service proof, Marketplace review, signing, checksum receipts,
  and release proof remain deferred.
- Added a Google Workspace Apps Script output proof that emits ignored
  `appsscript.json` and `Code.gs` artifacts with global homepage/action
  functions and CardService UI construction from the typed source model.
- Added a host-free Google Workspace Apps Script package-output checksum
  receipt for generated `appsscript.json` and `Code.gs`, while keeping Apps
  Script deployment, OAuth review, loaded Workspace file smoke, cloud-service
  proof, Marketplace review, signing, release checksums, and release proof
  deferred.
- Added `hosts/affinity/dx-affinity-content` as an Affinity content add-on
  bridge scaffold, with content manifest metadata, typed content plans for DX
  assets, fonts, swatches, styles, templates, and receipts, official
  experimental registry metadata, no native Affinity SDK claim, no process or
  automation bridge, no native filter binary, and a
  `test:affinity-content-addon-adapter` guard. Manual import proof,
  Photoshop-compatible filter plugin proof, signing, checksum receipts, loaded
  Affinity app smoke, Affinity Store/public release proof, and release proof
  remain deferred.
- Added a strict Affinity content-package receipt writer that only accepts real
  importable content artifacts such as `.afassets`, `.affont`, `.afpalette`,
  `.afstyles`, and `.aftemplate`, while keeping manual import, native SDK,
  Photoshop-compatible filter, signing, checksum, loaded-app, and distribution
  claims false until separate proof exists.
- Added a guarded Affinity public release package checksum workflow for the
  generated content package ZIP, while keeping manual import, native SDK,
  Photoshop-compatible filter, signing, loaded-app, store review, and
  distribution proof deferred.
- Added a guarded Affinity manual-import receipt writer that requires explicit
  human import proof metadata through `DX_AFFINITY_MANUAL_IMPORT_PROOF_JSON`,
  hashes both the content-package receipt and proof file, and keeps native SDK,
  Photoshop-compatible filter, signing, checksum, loaded-app, and distribution
  claims false.
- Added `hosts/office/dx-excel` as the first professional Office adapter
  scaffold, with an Excel XML task-pane manifest, typed task-pane message plans,
  official experimental registry metadata, workbook-read-only manifest
  permission, inert HTTPS source placeholders, and a `test:excel-adapter` guard.
  Sideloaded Excel smoke, local-service proof, signing, checksum receipts,
  AppSource approval, and package proof remain deferred.
- Added `hosts/office/dx-powerpoint` as the second professional Office adapter
  scaffold, with a PowerPoint XML task-pane manifest, typed task-pane message
  plans, official experimental registry metadata, presentation-read-only
  manifest permission, inert HTTPS source placeholders, and a
  `test:powerpoint-adapter` guard. Sideloaded PowerPoint smoke, local-service
  proof, signing, checksum receipts, AppSource approval, and package proof
  remain deferred.
- Added `hosts/office/dx-word` as the third professional Office adapter
  scaffold, with a Word XML task-pane manifest, typed task-pane message plans,
  official experimental registry metadata, document-read-only manifest
  permission, inert HTTPS source placeholders, no-document-mutation source
  guards, and a `test:word-adapter` guard. Sideloaded Word smoke,
  local-service proof, signing, checksum receipts, AppSource approval, and
  package proof remain deferred.
- Tightened Office task-pane command plans so Excel, PowerPoint, and Word
  receipt-copy host-UI actions no longer require local-service runtime proof,
  while status/search actions remain proof-gated and source-only.
- Added `hosts/zed/dx-zed` as the first post-VS Code editor adapter scaffold,
  with a Zed extension manifest, Rust WebAssembly slash-command skeleton, typed
  command plans for DX status, asset search, and receipt metadata, official
  experimental registry metadata, no-process/no-download/no-npm source guards,
  and a `test:zed-adapter` guard. Loaded Zed dev-extension smoke,
  local-service proof, extension gallery package proof, signing, checksum
  receipts, and release proof remain deferred.
- Added a guarded Zed WebAssembly build-output proof that builds through
  `cargo -j 1`, copies the compiled module into ignored `extension.wasm`,
  and keeps loaded-host, gallery package, signing, checksum, and release proof
  deferred.
- Added a host-free Zed WebAssembly package-output checksum receipt for the
  current `extension.toml` plus ignored `extension.wasm` layout, while keeping
  loaded Zed dev-extension smoke, gallery package proof, local-service proof,
  signing, release checksums, and release proof deferred.
- Normalized the Zed readiness ledger and starter guide so WebAssembly
  build-output proof is no longer listed as a deferred blocker after the
  guarded output proof exists.
- Added a VS Code `DX: List Forge Packages` command backed by fixed
  `dx forge packages --json` argv, manifest parity checks, command-center
  dispatch coverage, and direct command registration.
- Added a VS Code `DX: Show Build Graph` command backed by fixed
  `dx graph --json` argv, keeping graph access shell-free, trust-gated, and
  manifest-backed.
- Added VS Code check-read commands for `DX: Show Latest Check Receipt` and
  `DX: Show Check Editor State`, backed by fixed
  `dx check --latest-receipt --json` and `dx check editor --json` argv,
  keeping check receipt/editor polling access shell-free, trust-gated, and
  manifest-backed.
- Hardened VS Code package verification so every contributed command must have
  a matching activation event, and tightened the TypeScript source policy so
  authored source stays on `.ts` or the existing `.tsx` path rather than
  drifting into `.js`, `.mjs`, `.cjs`, `.jsx`, `.mts`, or `.cts`.
- Added a guarded `smoke:vscode-loaded-host:j1` runner plus a TypeScript
  loaded-host smoke source for installed VS Code Extension Development Host
  command-registration checks. The PowerShell wrapper owns serial build
  environment, disk, competing-process, and compile gates; the TypeScript
  harness creates isolated temporary user-data/extensions/workspace paths,
  blocks already-running VS Code instances, and writes a metadata-only receipt
  only after a successful loaded-host run. This does not prove Cursor/Windsurf
  loaded-host smoke, VSIX/package install proof, DX CLI-backed command
  execution in a loaded host, signing/checksum receipts, marketplace approval,
  or public release readiness.
- Added VS Code package hygiene checks for the command-center adapter, including
  an extension-local README, `.vscodeignore`, and verifier coverage so source,
  tests, and manifest metadata stay out of future VSIX packages. Actual VSIX
  package proof remains behind the guarded `package:vscode:j1` wrapper.
- Added source-level DX Browser Command Center plans for `DX Forge Packages` and
  `DX Build Graph`, backed by fixed `dx forge packages --json` and
  `dx graph --json` native-host request plans, Rust native-host source
  allowlist coverage, manifest capability/action parity, and browser
  UI/background dispatch coverage. Real loaded Chrome, Microsoft Edge, and
  Firefox profile dispatch, installed native-host binary execution proof for
  these new plans, signing, checksum receipts, and release packaging remain
  deferred.
- Added a source-level loaded Chromium background command smoke for the browser
  adapter that verifies trusted sender dispatch, `DX Status`, `DX Forge
  Packages`, `DX Build Graph`, approved `DX Doctor`, and host-UI receipt
  routing through the compiled extension background entrypoint. Real loaded
  Chrome, Microsoft Edge, and Firefox profile receipts remain deferred.
