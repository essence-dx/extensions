# DX Extensions

Official host extension workspace for the DX ecosystem.

This repository is intentionally separate from `G:\Dx\cli` and `G:\Dx\flow`.
Extensions should bridge into the Rust `dx` command surface instead of copying DX
business logic into host-specific code.

## First Targets

- `hosts/vscode/dx-vscode`: VS Code, Cursor, and Windsurf command-center bridge.
- `hosts/browser/dx-browser`: experimental browser command-center scaffold for
  Chrome, Microsoft Edge, and Firefox, with Microsoft Edge tracked as a
  separate first-class distribution target while reusing the Chromium adapter.
- `hosts/zed/dx-zed`: experimental Zed slash-command extension scaffold for DX
  status, asset search, and receipt metadata through a future local-service
  bridge.
- `hosts/blender/dx-blender`: experimental Blender command-center add-on
  scaffold for approved DX CLI actions.
- `hosts/obsidian/dx-command-center`: experimental Obsidian desktop plugin
  scaffold for approved DX CLI actions and receipt path access.
- `hosts/figma/dx-figma`: experimental Figma plugin scaffold for DX status,
  asset search, and receipt path actions through a future local-service bridge.
- `hosts/canva/dx-canva`: experimental Canva Apps SDK scaffold for DX status,
  asset search, and receipt path actions through a future local-service bridge.
- `hosts/sketch/dx-sketch`: experimental Sketch plugin scaffold for DX status,
  asset search, document-safe metadata, and receipt path actions through a
  future local-service bridge.
- `hosts/adobe/dx-photoshop-uxp`: experimental Photoshop UXP plugin scaffold
  for DX status, asset search, and receipt path actions through a future
  local-service bridge.
- `hosts/adobe/dx-premiere-pro-uxp`: experimental Premiere Pro UXP plugin
  scaffold for DX status, media search, project-safe metadata, and receipt path
  actions through a future local-service bridge.
- `hosts/adobe/dx-indesign-uxp`: experimental InDesign UXP plugin scaffold for
  DX status, typography and asset search, document-safe metadata, and receipt
  path actions through a future local-service bridge.
- `hosts/blackmagic/dx-davinci-resolve`: experimental DaVinci Resolve scripting
  scaffold for DX status, read-only project inspection intent, and receipt path
  actions through a future local-service bridge.
- `hosts/jetbrains/dx-intellij-platform`: experimental IntelliJ Platform plugin
  scaffold for DX status, asset search, and receipt path actions through a
  future local-service bridge.
- `hosts/visual-studio/dx-visual-studio`: experimental Visual Studio SDK VSIX
  scaffold for DX status, asset search, and receipt path actions through a
  future local-service bridge.
- `hosts/unity/dx-unity-editor`: experimental Unity Editor package scaffold for
  DX status, asset search, and receipt path actions through a future
  local-service bridge.
- `hosts/unreal/dx-unreal-engine`: experimental Unreal Editor plugin scaffold
  for DX status, asset search, and receipt path actions through a future
  local-service bridge.
- `hosts/google-workspace/dx-google-workspace-addon`: experimental Google
  Workspace Add-on scaffold for DX status, asset search, and receipt path
  actions through a future cloud-service bridge.
- `hosts/affinity/dx-affinity-content`: experimental Affinity content add-on
  bridge for DX assets, fonts, swatches, styles, templates, and receipt metadata
  with planned manual import proof.
- `hosts/office/dx-excel`: experimental Excel task-pane add-in scaffold for DX
  status, asset search, and receipt path actions through a future local-service
  bridge.
- `hosts/office/dx-powerpoint`: experimental PowerPoint task-pane add-in
  scaffold for DX status, media search, and receipt path actions through a
  future local-service bridge.
- `hosts/office/dx-word`: experimental Word task-pane add-in scaffold for DX
  status, asset search, and receipt path actions through a future local-service
  bridge.
- Future creative-tool extensions should share the manifest and protocol contracts
  from `crates/dx-extension-manifest` plus the generated manifest TypeScript
  declarations in `schemas/types/dx-extension-manifest.d.ts`.
- New official host adapters must pass the starter gate in
  `docs/official-extension-starter.md` before folders are added under `hosts/`.
- Professional host targets are tracked in
  `registry/professional-host-targets.toml` and summarized in
  `docs/professional-host-targets.md` before new folders are created.
- Extension release stages are tracked in
  `registry/extension-readiness.toml`; source scaffolds cannot claim
  release-readiness without loaded-host, package, signing, checksum, and
  distribution receipts.
- Guarded `test:j1` and `verify:j1` runs write ignored source-level readiness
  receipts under `.dx/receipts/extensions/` after their checks complete.
- `preflight:loaded-host-targets:j1` writes ignored metadata-only preflight
  receipts for adapters that already have package-output receipts, recomputing
  package hashes while keeping host execution and release readiness false.
- `preflight:platform-host-discovery:j1` writes ignored host-discovery receipts
  for every official adapter, separating local-tooling, manual-only, and
  cloud-service proof modes without launching proprietary hosts.
- `report:extension-progress:j1` writes an ignored progress report counting
  official adapters, package-output proofs, preflight receipts, and remaining
  release stages.
- `check:release-evidence-gates` validates the obligation-complete release
  evidence matrix that every official adapter must satisfy before any
  release-ready claim, including manifest-required local-service and
  cloud-service proof kinds.
- `report:release-evidence-gaps:j1` writes an ignored report showing which
  release evidence kinds, receipt obligations, and unique receipt paths from
  the matrix are still missing or present but too weak for release evidence.

## Current Status

Current ecosystem posture: source scaffolds exist for the listed hosts;
loaded-host proof is still open except the installed native-host binary smoke
described for the browser native-host boundary. The VS Code adapter has a
guarded source-level loaded-host smoke runner, but no loaded VS Code receipt is
claimed until `npm run smoke:vscode-loaded-host:j1` passes and writes its
metadata-only receipt. The browser adapter also has a profileless
loaded Chromium command smoke in the browser local check and a profileless
loaded-background receipt smoke wired into the `j1` native-host wrapper, but
neither is a real loaded Chrome, Edge, or Firefox profile proof.
This repository should not claim plugin ecosystem readiness, marketplace
readiness, or public release readiness until loaded-host receipts,
package/signing/checksum receipts, and host-specific distribution proof are
captured.

| Host | Status | Notes |
| --- | --- | --- |
| Official Registry | Active metadata gate | Semantic validation now checks official extension registry entries against their manifests and professional host target catalog links before more official folders are added. This is not a plugin ecosystem readiness signal; host smoke tests, signing, package proof, and DX CLI-backed execution remain separate gates. |
| Extension Readiness Ledger | Active release gate | Machine-readable readiness metadata now covers every official extension. Entries start at `source-level` and cannot advance to release-ready status without loaded-host, package, signing, checksum, and distribution receipt paths. The guarded j1 wrappers now emit ignored source-level readiness receipts after passing checks, while loaded-host and release proof remain separate gates. |
| Loaded-Host Preflight Receipts | Active evidence gate | `preflight:loaded-host-targets:j1` verifies existing package-output receipts against current package files and writes ignored `loaded-host-preflight-latest.json` receipts without launching proprietary hosts or claiming loaded-host, marketplace, or release proof. |
| Platform Host Discovery Receipts | Active environment gate | `preflight:platform-host-discovery:j1` writes ignored `host-discovery-latest.json` receipts for every official adapter. Local-tooling targets report `candidate-found` or `missing`, while Canva/Google Workspace and Affinity use explicit cloud-service or manual-only modes. These receipts do not launch hosts or claim loaded-host proof. |
| Operator Proof Templates | Active proof-input helper | `write:operator-proof-template` writes JSON templates for operator-captured proof inputs such as Chrome, Microsoft Edge, Firefox, VS Code, Figma, Canva, Zed, Blender, Obsidian, Sketch, Adobe UXP, Office, Google Workspace, IntelliJ Platform, Visual Studio, Unity Editor, Unreal Engine, Affinity, and DaVinci Resolve. Templates are invalid by default and never satisfy release gates until the matching receipt writer validates real host/package proof and writes the mapped receipt. Multi-receipt writers now advertise all possible output receipts, such as Figma loaded-host plus plugin-id proof and Google Workspace deployment, cloud-service, and file-smoke proof. |
| Extension Progress Report | Active status report | `report:extension-progress:j1` writes ignored `progress-latest.json` evidence that counts official adapters, package-output receipts, Affinity content-package receipts, loaded-host preflight receipts, host-discovery coverage, host-discovery status buckets, and remaining source-level stages. |
| Release Evidence Gates | Active release gate | `registry/release-evidence-gates.toml` defines an explicit `kind=receipt` obligation map for every official adapter. The validator derives local-service and cloud-service requirements from each manifest and blocks release-ready claims unless every required evidence kind has a safe receipt mapping. |
| Release Evidence Gap Report | Active status report | `report:release-evidence-gaps:j1` checks mapped release evidence receipts and writes ignored `release-evidence-gaps-latest.json` evidence showing existing, missing, and weak proof kinds, per-kind receipt obligations, unique receipt paths, and dynamically derived blockers without launching hosts. Checksum, signing, native-host, CCX, and IDE/game-engine special proof receipts must include their structural evidence before the report treats them as release-valid. |
| Release Package Checksum Receipts | Proof-gated release gate | `smoke:release-package-checksum:j1` requires `DX_RELEASE_PACKAGE_CHECKSUM_PROOF_JSON`, verifies the package-output receipt, validates that the public release artifact hash matches the proof, requires the artifact to be created from package output, and writes `checksum-latest.json` with `scope: "public-release-package"`. `package:affinity-release-checksum:j1`, `package:office-google-release-checksum:j1`, and `package:package-output-release-checksum:j1` build deterministic ZIP artifacts from Affinity, Office, Google Workspace, and current standard package-output receipts, then feed that proof into the shared checksum smoke. Browser and Zed stay on separate packaging paths until their native-host/package-output evidence is refreshed. These receipts do not claim loaded-host, signing, distribution, marketplace, or review proof. |
| Browser Native-Host Package Receipts | Proof-gated browser release gate | `package:browser-native-host:j1` builds or accepts the `dx-browser-native-host` executable, renders manifest-only Chrome, Edge, and Firefox native messaging files with explicit extension IDs, verifies the browser package-output receipt, and writes `native-host-release-package-latest.json`. It does not claim loaded profiles, signing, public release checksum, or store distribution proof. |
| Package Signing Receipts | Proof-gated release gate | `smoke:package-signing:j1` requires `DX_PACKAGE_SIGNING_PROOF_JSON`, verifies package-output and public release package checksum receipts, validates signed artifact, detached signature, verification output, signer, and certificate fingerprint hashes, then writes `signing-latest.json`. It does not claim loaded-host, distribution, marketplace, or review proof. |
| Distribution Review Receipts | Proof-gated release gate | `smoke:distribution-review:j1` requires `DX_DISTRIBUTION_REVIEW_PROOF_JSON`, validates the requested review receipt path against `registry/release-evidence-gates.toml`, requires approved review metadata, links distribution-style approvals to signing and public release checksum receipts, and writes the mapped review receipt such as `marketplace-review-latest.json`, `community-review-latest.json`, `appsource-review-latest.json`, `canva-review-latest.json`, `gallery-review-latest.json`, or `distribution-latest.json`. Browser distribution proof must include `browserStoreTargets` covering `chrome_web_store`, `edge_add_ons`, and `firefox_amo`. OAuth review receipts stay separate and do not claim distribution proof. |
| Office Local-Service Receipts | Proof-gated Office release gate | `smoke:office-local-service:j1` requires `DX_OFFICE_LOCAL_SERVICE_PROOF_JSON`, verifies the matching sideloaded-host receipt, validates Excel, PowerPoint, or Word local-service request/response metadata, hashes the manual proof file, and writes `local-service-latest.json`. It does not claim signing, release checksum, AppSource approval, or distribution proof. |
| Generic Local-Service Receipts | Proof-gated local-service gate | `smoke:local-service:j1` requires `DX_LOCAL_SERVICE_PROOF_JSON`, validates the requested `local_service` receipt path against `registry/release-evidence-gates.toml`, links the proof to the mapped loaded-host receipt, requires loopback-only metadata request/response proof for manifest local-service actions, and writes `local-service-latest.json` for shared DX local-service adapters. It does not claim signing, release checksum, review, or distribution proof. |
| IDE/Game Loaded-Host Receipts | Proof-gated host-execution gate | `smoke:ide-game-engine-loaded-host:j1` requires `DX_IDE_GAME_ENGINE_LOADED_HOST_PROOF_JSON`, verifies package-output receipts, validates metadata-only loaded-host command evidence for IntelliJ Platform, Visual Studio, Unity Editor, or Unreal Engine, hashes the manual proof file, and writes the host-execution receipt path required by each release gate. It does not claim local-service, project-import/project-enablement, signing, release checksum, marketplace, or distribution proof. |
| IDE/Game Special Proof Receipts | Proof-gated host-specific release gates | `smoke:ide-game-engine-special-proof:j1` requires `DX_IDE_GAME_ENGINE_SPECIAL_PROOF_JSON`, verifies the matching package-output and loaded-host receipts, validates the mapped release gate path, and writes `plugin-verifier-latest.json` for IntelliJ Platform, `project-import-latest.json` for Unity Editor, or `project-enablement-latest.json` for Unreal Engine. It does not claim local-service, signing, release checksum, marketplace review, or distribution proof. |
| Creative Loaded-Host Receipts | Proof-gated host-execution gate | `smoke:creative-loaded-host:j1` requires `DX_CREATIVE_LOADED_HOST_PROOF_JSON`, verifies package-output receipts, validates metadata-only Adobe UXP or DaVinci Resolve loaded-host evidence, hashes the manual proof file, and writes `loaded-host-latest.json`. For DaVinci Resolve it writes `workflow-integration-latest.json` only when the proof separately verifies read-only workflow integration. It does not claim local-service, `.ccx`, native/hybrid plugin, signing, release checksum, review, or distribution proof. |
| Adobe CCX Package Receipts | Proof-gated Adobe release gate | `package:adobe-ccx:j1` requires `DX_ADOBE_CCX_PACKAGE_PROOF_JSON`, verifies the matching Adobe UXP package-output receipt, validates the source package manifest and explicit `.ccx` artifact hash, and writes `ccx-package-latest.json` for Photoshop, Premiere Pro, or InDesign. It does not claim loaded-host, signing, public release checksum, Creative Cloud review, or distribution proof. |
| Adobe UXP Plugin-ID Receipts | Proof-gated Adobe release gate | `smoke:adobe-uxp-plugin-id:j1` requires `DX_ADOBE_UXP_PLUGIN_ID_PROOF_JSON`, verifies the matching UXP Developer Tool loaded-host receipt, hashes the Adobe Developer Console proof file, requires the Developer Console plugin id to match the loaded UXP manifest id, and writes `plugin-id-latest.json`. It does not claim signing, release checksum, Creative Cloud review, or distribution proof. |
| Google Workspace Deployment Receipts | Proof-gated cloud release gate | `smoke:google-workspace-deployment:j1` requires `DX_GOOGLE_WORKSPACE_DEPLOYMENT_PROOF_JSON`, verifies the Apps Script package-output receipt, validates metadata-only test deployment, cloud-service request/response, and Workspace file smoke proof, then writes `apps-script-deployment-latest.json`, `cloud-service-latest.json`, and `workspace-file-smoke-latest.json`. It does not claim OAuth review, signing, Marketplace approval, release checksum, or distribution proof. |
| Figma Loaded-Host Receipts | Proof-gated host-execution gate | `smoke:figma-loaded-host:j1` requires `DX_FIGMA_LOADED_HOST_PROOF_JSON`, verifies the Figma package-output receipt, validates metadata-only loaded desktop plugin and plugin-ID proof, hashes the manual proof file, then writes `loaded-host-latest.json` and `plugin-id-latest.json`. It does not claim local-service, signing, Community review, release checksum, or distribution proof. |
| Application Loaded-Host Receipts | Proof-gated host-execution gate | `smoke:application-loaded-host:j1` requires `DX_APPLICATION_LOADED_HOST_PROOF_JSON`, verifies package-output receipts, validates metadata-only loaded-host evidence for Zed, Blender, Obsidian, Canva, or Sketch, hashes the manual proof file, and writes the host-execution receipt path required by each release gate. Zed proof is based on installed dev-extension source/index/log/WASM evidence rather than slash-command availability. For Blender it also writes `addon-install-latest.json`; for Sketch it writes `sketchtool-latest.json` only when the proof verifies sketchtool. It does not claim local-service, signing, release checksum, review, notarization, or distribution proof. |
| Official Extension Starter | Active source-work gate | New official host adapters must document host SDK/distribution evidence, permission model, DX command boundary, receipts, signing, loaded-host smoke plan, and guarded `j1` verification before source folders are created. |
| Professional Host Target Catalog | Active planning gate | Metadata-only catalog ranks possible DX adapters for VS Code, browsers, design tools, office apps, creative media tools, CAD/BIM, game engines, and collaboration hosts. It is not release readiness and does not create official registry entries. |
| VS Code Command Center | Active host-action scaffold | Manifest host actions are mirrored by contributed commands, activation events, allowlisted command plans, trust/approval gates, and root verification. `DX: Search Icons` prompts for a query and runs validated `dx icon search` argv through the trusted CLI bridge; `DX: List Forge Packages` runs fixed `dx forge packages --json` argv; `DX: Show Build Graph` runs fixed `dx graph --json` argv; `DX: Show Latest Check Receipt` runs fixed `dx check --latest-receipt --json` argv; and `DX: Show Check Editor State` runs fixed `dx check editor --json` argv. Receipt host actions validate the existing `.dx/receipts` folder before opening it and can copy the receipts path through the host clipboard. A guarded `smoke:vscode-loaded-host:j1` source-level runner now exists for installed VS Code Extension Development Host command-registration checks, `write-vscode-loaded-host-proof-receipts.ts` can validate explicit metadata-only proof JSON for that same receipt path, and `package:vscode:j1` is wired to emit a `.vsix` package-output checksum receipt once the guarded package command can run. Loaded VS Code/Cursor/Windsurf smoke, package-output receipt capture, signing, release checksum, marketplace review, and distribution receipts remain deferred. |
| Browser Command Center | Experimental native-host scaffold | Chrome, Microsoft Edge, and Firefox MV3 manifests, typed command plans/protocol parser, development-only user-scoped PowerShell/POSIX native-host manifest installers, cross-platform manifest-only install/uninstall proof for Chrome, Microsoft Edge, and Firefox, typed native messaging transport boundary, static popup/sidebar/options surfaces, bundled browser artifacts, typed UI/background dispatch for native-host and host-UI actions, an initial Rust native-host executable, source-level native-host command-plan support for `dx status`, `dx doctor`, `dx forge packages --json`, and `dx graph --json`, installed native-host binary execution proof for allowlisted `dx status` and `dx doctor` plans, source-level loaded Chromium command smoke for trusted sender dispatch and host-UI receipts, a profileless loaded-background receipt smoke wired into `smoke:browser-native-host:j1`, a strict loaded-profile receipt writer for real Chrome/Edge/Firefox profile proof, a guarded `smoke:browser-loaded-profile:j1` proof importer requiring `DX_BROWSER_LOADED_PROFILE_PROOF_JSON`, a guarded native-host release package receipt writer for explicit Chrome/Edge/Firefox native messaging manifests, dynamic release-gap blockers that distinguish present Edge profile evidence from missing Chrome/Firefox proof, and a host-free Chrome/Edge/Firefox dist package-output checksum receipt writer wired into `build:browser:j1` for ignored `.dx` evidence. End-to-end browser execution is not released yet: real loaded Chrome, Microsoft Edge, and Firefox profile smoke tests, loaded-browser dispatch receipts, installed native-host binary execution proof for the Forge Packages and Build Graph plans, signing, release checksum proof, and store review remain deferred. |
| Microsoft Edge Distribution | Active Edge proof target | Edge uses the DX Browser Command Center but requires separate Edge extension-id, Edge native-host registration, loaded Edge dispatch, signing and checksum receipts, Edge Add-ons package and review proof, and release packaging proof. |
| Zed Command Center | Experimental slash-command scaffold | Zed extension manifest, DX manifest and official registry entry, Rust WebAssembly extension skeleton, typed command plans for status, asset search, and receipts, standalone Cargo workspace metadata, source-level no-process/no-download/no-npm guards, ignored `extension.wasm` build-output proof, host-free WebAssembly package-output checksum receipt, and a guarded loaded dev-extension receipt writer requiring source path, installed dev-extension path, Zed extension index, host log, executable hash, and package-matched WASM proof are present. This is source-level only until proof is captured: local-service proof, gallery package proof, signing, release checksum proof, and release proof remain deferred. |
| Blender Command Center | Experimental add-on scaffold | Blender extension manifest, DX manifest and official registry entry, Python sidebar operators for `dx status`, `dx doctor`, and receipt opening, source-level shell-free command-boundary tests, guarded package-layout output proof, host-free package-output checksum receipt, and a guarded loaded add-on plus add-on-install receipt writer for explicit real-host proof JSON are present. This is source-level only until proof is captured: package archive proof, signing, release checksum proof, marketplace approval, and release packaging remain deferred. |
| Obsidian Command Center | Experimental desktop plugin scaffold | Obsidian plugin manifest, DX manifest and official registry entry, TypeScript command runner, command palette/ribbon actions for `dx status`, `dx doctor`, and receipt path copying, source-level shell-free command-boundary tests, temp-directory bundle-output proof for generated `main.js`, host-free package-output checksum receipt, and a guarded loaded test-vault receipt writer for explicit real-host proof JSON are present. This is source-level only until proof is captured: release assets, signing, release checksum proof, community plugin review, and package proof remain deferred. |
| Figma Command Center | Experimental plugin scaffold | Figma plugin manifest, DX manifest and official registry entry, typed message plans, validated unknown UI message payloads, a static plugin UI for status, asset search, and receipt path actions, production `allowedDomains: ["none"]`, host-UI receipt copy without local-service runtime proof, temp-directory build-output proof for generated `main.js`, host-free package-output checksum receipt, and a guarded loaded-host/plugin-ID receipt writer for explicit proof JSON are present. Captured Figma desktop smoke, generated public plugin ID replacement, live local-service proof, signing, release checksum proof, Community review, and release proof remain deferred. |
| Canva Command Center | Experimental app scaffold | Canva app configuration, DX manifest and official registry entry, typed message plans, source-level design-editor app surface for status, asset search, and receipt path actions, no requested Canva runtime permissions, host-UI receipt copy without local-service runtime proof, source-level no-process/no-network/no-design-mutation guards, temp-directory build-output proof for generated `app.js`, host-free package-output checksum receipt, and a guarded development-app receipt writer for explicit proof JSON are present. Live local-service proof, Canva review, signing, release checksum proof, and release proof remain deferred. |
| Sketch Command Center | Experimental plugin scaffold | Sketch plugin manifest, DX manifest and official registry entry, typed command plans and handlers for DX status, asset search, proof-gated document metadata, and receipt path actions, source-level no-process/no-network/no-document-mutation guards, temp-directory build-output proof for the generated `.sketchplugin` bundle, host-free package-output checksum receipt, and a guarded loaded-plugin plus optional sketchtool receipt writer for explicit proof JSON are present. Local-service proof, release package proof, signing, release checksum proof, notarization, Plugin Directory review, and release proof remain deferred. |
| Photoshop Command Center | Experimental Adobe UXP scaffold | Photoshop UXP Manifest v5 plugin scaffold, DX manifest and official registry entry, typed message plans, static panel and command entries for status, asset search, and receipt path actions, empty `requiredPermissions`, source-level no-process/no-network/no-document-mutation guards, shared package-layout build proof for ignored `dist/index.js` output, host-free package-output checksum receipt, guarded `.ccx` package receipt writer, guarded UXP Developer Tool loaded-host receipt writer, and guarded Adobe Developer Console plugin-id receipt writer are present. Loaded Photoshop UXP smoke, document-safe runtime proof, local-service proof, signing, release checksum proof, Creative Cloud review, and release proof remain deferred. |
| Premiere Pro Command Center | Experimental Adobe UXP scaffold | Premiere Pro UXP plugin scaffold, DX manifest and official registry entry, typed message plans, static panel and command entries for status, media search, project-safe metadata, and receipt path actions, no native/hybrid plugin bridge, no direct process bridge, source-level no-process/no-network/no-timeline-mutation guards, shared package-layout build proof for ignored `dist/index.js` output, host-free package-output checksum receipt, guarded `.ccx` package receipt writer, guarded UXP Developer Tool loaded-host receipt writer, and guarded Adobe Developer Console plugin-id receipt writer are present. Loaded Premiere Pro UXP smoke, project-safe runtime proof, local-service proof, native SDK/hybrid plugin proof, signing, release checksum proof, Creative Cloud review, and release proof remain deferred. |
| InDesign Command Center | Experimental Adobe UXP scaffold | InDesign UXP plugin scaffold, DX manifest and official registry entry, typed message plans, static panel and command entries for status, typography and asset search, document-safe metadata, and receipt path actions, no native/hybrid plugin bridge, no direct process bridge, source-level no-process/no-network/no-document-mutation guards, shared package-layout build proof for ignored `dist/index.js` output, host-free package-output checksum receipt, guarded `.ccx` package receipt writer, guarded UXP Developer Tool loaded-host receipt writer, and guarded Adobe Developer Console plugin-id receipt writer are present. Loaded InDesign UXP smoke, document-safe runtime proof, local-service proof, signing, release checksum proof, Creative Cloud review, native SDK/hybrid plugin proof, and release proof remain deferred. |
| DaVinci Resolve Command Center | Experimental scripting scaffold | DaVinci Resolve DX manifest and official registry entry, JSON command plans, Python and Lua metadata-only scripts, source-level no-render/no-project-mutation/no-network/no-process guards, host-free package-output checksum receipt, a process-guarded Developer documentation proof wrapper, and a guarded loaded-host plus read-only workflow-integration receipt writer for explicit real-host proof JSON are present. This is source-level only: captured loaded DaVinci Resolve smoke, bundled Developer documentation version capture, live read-only project metadata proof, local-service proof, signing, release checksum proof, distribution proof, and release proof remain deferred. |
| IntelliJ Platform Command Center | Experimental Kotlin plugin scaffold | IntelliJ Platform Gradle Plugin project, DX manifest and official registry entry, plugin.xml action/tool-window/project-service registrations, typed Kotlin command plans for status, asset search, and receipts, source-level no-process/no-network/no-inspection guards, host-free Gradle source-layout checksum receipt, and a guarded sandbox loaded-host receipt writer for explicit real-host proof JSON are present. This is source-level only: captured sandbox IDE smoke, Gradle plugin package proof, Plugin Verifier, local-service proof, signing, release checksum proof, Marketplace review, and release proof remain deferred. |
| Visual Studio Command Center | Experimental VSIX scaffold | Visual Studio SDK VSIX manifest, DX manifest and official registry entry, project file, command declarations, typed C# command plans, source-level no-process/no-network/no-solution-mutation guards, host-free VSIX source-layout checksum receipt, and a guarded Experimental Instance loaded-host receipt writer for explicit real-host proof JSON are present. This is source-level only: captured Experimental Instance smoke, MSBuild `.vsix` package proof, local-service proof, signing, release checksum proof, Marketplace review, and release proof remain deferred. |
| Unity Editor Command Center | Experimental editor package scaffold | Unity package manifest, DX manifest and official registry entry, Editor-only asmdefs, menu/window source, typed C# command plans, source-level no-process/no-network/no-asset-mutation guards, host-free package-layout checksum receipt, and a guarded loaded-host receipt writer for explicit real-host proof JSON are present. This is source-level only: captured loaded Unity Editor test-project smoke, local-service proof, package tarball proof, signing, Asset Store review, project import/mutation proof, release checksum proof, and release proof remain deferred. |
| Unreal Engine Command Center | Experimental editor plugin scaffold | Unreal `.uplugin` descriptor, DX manifest and official registry entry, editor-only module, tool-menu source, typed C++ command plans, source-level no-runtime-module/no-process/no-network/no-asset-import guards, host-free source-plugin package-layout checksum receipt, and a guarded loaded-host receipt writer for explicit real-host proof JSON are present. This is source-level only: captured loaded Unreal sample-project smoke, local-service proof, packaged plugin archive proof, signing, release checksum proof, Fab/Marketplace review, and release proof remain deferred. |
| Google Workspace Command Center | Experimental Apps Script add-on scaffold | Apps Script manifest, DX manifest and official registry entry, homepage-trigger card model, typed TypeScript action plans, metadata-only cloud-service request envelope, no OAuth scopes, source-level no-Drive/Gmail/Docs/Sheets/Slides mutation guards, ignored Apps Script `appsscript.json`/`Code.gs` output proof with source freshness for entrypoints and the cloud-service boundary, host-free package-output checksum receipt, public release package checksum receipt for the generated Apps Script ZIP, and a guarded Apps Script deployment/cloud-service/workspace-file smoke receipt writer for explicit proof JSON are present. This is source-level only: captured test deployment, captured Workspace file smoke, OAuth consent/review, Marketplace review, signing, distribution proof, and release proof remain deferred. |
| Affinity Content Bridge | Experimental content add-on bridge | Affinity content manifest, DX manifest and official registry entry, typed TypeScript content plans for DX assets, fonts, and receipts, source metadata for swatches, styles, and templates, strict content-package/manual-import/loaded-app/Photoshop-compatible filter receipt writers, guarded j1 smoke wrappers, and a public release package checksum receipt for the generated Affinity content ZIP are present. Source-level no-process/no-automation/no-native-filter guards are present. This is source-level only and not a native Affinity SDK plugin: captured manual import proof, captured Photoshop-compatible filter plugin proof, signing, loaded Affinity app smoke, Affinity Store/public release proof, and release proof remain deferred until real import evidence exists. |
| Excel Command Center | Experimental Office task-pane scaffold | Excel XML task-pane manifest, DX manifest and official registry entry, typed task-pane message plans, workbook-read-only manifest permission, inert HTTPS source placeholders, a shared typed Office local-service request boundary for proof-gated status/search actions, host-UI receipt copy without local-service runtime proof, source-level no-process/no-broad-domain guards, hosted task-pane asset proof for ignored `dist/taskpane.js` output, sideload manifest proof for ignored `dist/manifest.xml` output, host-free package-output checksum receipt with source freshness for the manifest and taskpane HTML, public release package checksum receipt for the generated task-pane ZIP, guarded sideloaded-host receipt writer, and guarded local-service receipt writer for metadata-only Excel proof are present. Captured sideloaded Excel smoke, live local-service proof, signing, AppSource approval, and release proof remain deferred. |
| PowerPoint Command Center | Experimental Office task-pane scaffold | PowerPoint XML task-pane manifest, DX manifest and official registry entry, typed task-pane message plans, presentation-read-only manifest permission, inert HTTPS source placeholders, a shared typed Office local-service request boundary for proof-gated status/search actions, host-UI receipt copy without local-service runtime proof, source-level no-process/no-broad-domain guards, hosted task-pane asset proof for ignored `dist/taskpane.js` output, sideload manifest proof for ignored `dist/manifest.xml` output, host-free package-output checksum receipt with source freshness for the manifest and taskpane HTML, public release package checksum receipt for the generated task-pane ZIP, guarded sideloaded-host receipt writer, and guarded local-service receipt writer for metadata-only PowerPoint proof are present. Captured sideloaded PowerPoint smoke, live local-service proof, signing, AppSource approval, and release proof remain deferred. |
| Word Command Center | Experimental Office task-pane scaffold | Word XML task-pane manifest, DX manifest and official registry entry, typed task-pane message plans, document-read-only manifest permission, inert HTTPS source placeholders, a shared typed Office local-service request boundary for proof-gated status/search actions, host-UI receipt copy without local-service runtime proof, source-level no-process/no-broad-domain/no-document-mutation guards, hosted task-pane asset proof for ignored `dist/taskpane.js` output, sideload manifest proof for ignored `dist/manifest.xml` output, host-free package-output checksum receipt with source freshness for the manifest and taskpane HTML, public release package checksum receipt for the generated task-pane ZIP, guarded sideloaded-host receipt writer, and guarded local-service receipt writer for metadata-only Word proof are present. Captured sideloaded Word smoke, live local-service proof, signing, AppSource approval, and release proof remain deferred. |

## Command Policy

Heavy local commands must use a single build job. The root scripts already encode
this for Cargo with `-j 1`.

```powershell
npm run check
npm run build
npm run check:browser
npm run check:vscode
npm run check:rust
npm run check:official-registry
npm run check:extension-readiness
npm run check:source-readiness-receipts
npm run check:release-evidence-gates
npm run report:release-evidence-gaps:j1
npm run preflight:loaded-host-targets:j1
npm run preflight:platform-host-discovery:j1
npm run report:extension-progress:j1
npm run write:operator-proof-template -- --list
npm run write:operator-proof-template -- --id figma --output .dx/operator-proof-templates/figma.json
npm run check:extension-starter
npm run check:professional-host-targets
npm run check:native-host-command-boundary
npm run smoke:browser-native-host:j1
npm run smoke:browser-loaded-profile:j1
npm run package:browser-native-host:j1
npm run smoke:vscode-loaded-host:j1
npm run package:affinity-content:j1
npm run package:affinity-release-checksum:j1
npm run smoke:affinity-manual-import:j1
npm run smoke:office-sideloaded-host:j1
npm run smoke:office-local-service:j1
npm run smoke:local-service:j1
npm run smoke:release-package-checksum:j1
npm run package:office-google-release-checksum:j1
npm run package:package-output-release-checksum:j1
npm run smoke:package-signing:j1
npm run smoke:distribution-review:j1
npm run smoke:ide-game-engine-loaded-host:j1
npm run smoke:ide-game-engine-special-proof:j1
npm run smoke:creative-loaded-host:j1
npm run package:adobe-ccx:j1
npm run smoke:google-workspace-deployment:j1
npm run smoke:figma-loaded-host:j1
npm run smoke:application-loaded-host:j1
```

See `docs/command-policy.md` before adding new build scripts.
