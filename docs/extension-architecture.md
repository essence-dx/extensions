# DX Extension Architecture

DX extensions are host adapters. They should expose host-native commands,
panels, and menus while delegating DX work to the Rust CLI or a future local DX
service.

```text
host extension
  -> dx host bridge
  -> dx CLI or local DX service
  -> icons, fonts, media, forge, receipts, models, and checks
```

## Principles

- Keep host code thin and predictable.
- Prefer typed JSON contracts over ad hoc stdout parsing.
- Do not run shell command strings. Pass executable and arguments separately.
- Route host commands through small allowlisted command plans before spawning
  `dx`.
- Keep workspace-trust and user-consent gates visible in each host adapter.
- Record receipts for install, smoke, package, and host compatibility checks.

## Shared Contracts

`crates/dx-extension-manifest` owns the first shared contract:

- extension identity
- host compatibility
- bridge transport
- declared capabilities
- security expectations
- receipt location

The manifest crate is deliberately small so future VS Code, browser, Figma,
Office, and Adobe adapters can share the same base policy without depending on
each other's implementation details.

`schemas/dx.extension.manifest.schema.json` is the JSON Schema view of this
contract, and `schemas/types/dx-extension-manifest.d.ts` is generated from it
for TypeScript host adapters and tooling. These declarations describe manifest
metadata only; they do not implement host dispatch, spawn `dx`, release a
browser native-host executable, or prove loaded-browser smoke tests.

Shared manifest validation keeps command execution and receipts constrained:
entrypoint arguments must stay empty because host command plans own argv,
receipt paths must remain metadata-only under
`.dx/receipts/extensions/{extension.id}/`, signed manifests require checksums,
and release-package validation rejects `development-unsigned` signatures.

## Official Registry Validation

The semantic official-registry validator is a metadata and path-policy gate for
official DX extension entries. It rejects duplicate registry IDs, duplicate
paths, duplicate manifest paths, unsafe repository paths, manifests outside
their registered extension folders, registry/manifest identity drift,
unsupported registry statuses, and manifests that are not marked official.
Each official registry entry must also declare `professional_targets` that exist
in `registry/professional-host-targets.toml`, keeping first-party extension
metadata traceable to host planning evidence.

Passing this validator means official registry metadata is internally consistent
enough to add or maintain official extension folders. It does not prove host
packaging, loaded-host smoke tests, installed browser native-host execution, DX
CLI-backed installed or loaded browser execution proof, package signing,
checksum receipts, or public plugin ecosystem readiness.

## Official Extension Starter Gate

`docs/official-extension-starter.md` defines the source-work gate for future
official host adapters. It requires registry-first planning, host SDK and
distribution evidence, permission and sandbox review, a DX CLI or local service
boundary, manifest and registry identity, guarded `j1` verification,
metadata-only receipts, package signing and checksums, and a loaded-host smoke
plan before new source folders are added under `hosts/`.

Passing the starter gate only means a host adapter is ready to begin source
work. It does not prove marketplace readiness, loaded-host execution, public
package signing, installed native-host execution, DX CLI-backed behavior, or
plugin ecosystem readiness.

DX Extensions is currently an official-host adapter starter, not a public plugin
marketplace. New adapters must stay official-only, allowlisted, metadata-first,
and host-thin: no third-party extension intake, no broad host permissions, no
raw shell command strings, no copied DX runtime or business logic, and no claims
beyond the checks listed in the current receipt and TODO state.

## Release Evidence Matrix

`registry/release-evidence-gates.toml` is the machine-readable release contract.
Every required proof kind must map to one or more explicit
`kind=.dx/receipts/...` entries through `evidence_receipt_requirements`. The
flat `evidence_receipts` list is compatibility metadata; it is not sufficient
by itself to prove an obligation.

The validator derives service obligations from `dx.extension.toml` manifests:
`local_service.connect` requires `local_service` release evidence, and
`cloud_service.connect` requires `cloud_service` release evidence. Host-specific
proof kinds such as `plugin_verifier`, `appsource_review`, `ccx_package`,
`manual_import`, and `content_package` remain separate from generic
package/signing/checksum receipts. The gap report counts missing proof kinds,
per-kind receipt obligations, and unique receipt paths, so source scaffolds
cannot look release-ready merely because a path list exists.

`write:operator-proof-template` prepares JSON inputs for proof-gated receipt
writers. These templates are deliberately invalid by default, do not write
`.dx/receipts`, and do not satisfy loaded-host, signing, review, marketplace, or
release evidence until the matching receipt writer validates real host/package
proof and writes the mapped receipt. Run
`npm run write:operator-proof-template -- --list` to print the current ordered
template catalog before preparing operator-captured metadata-only proof input.

## VS Code Host Boundary

The VS Code host is the first active editor adapter for VS Code, Cursor, and
Windsurf. Its `dx-host-action` surface mirrors manifest host actions through
contributed commands, activation events, and allowlisted command plans.

`status` and `doctor` use shell-free DX CLI plans, with workspace trust required
and `doctor` kept behind user approval. `searchIcons` prompts for host-side
input, validates the query, and then runs `dx icon search` with shell-free argv.
`listForgePackages` runs the fixed read-only `dx forge packages --json` plan.
`showBuildGraph` runs the fixed read-only `dx graph --json` plan.
`showLatestCheckReceipt` runs the fixed read-only
`dx check --latest-receipt --json` plan, and `showCheckEditorState` runs the
low-impact read-only `dx check editor --json` polling plan.
`openReceipts` and `copyReceiptsPath` stay on the host UI transport, validate
the workspace `.dx/receipts` folder before acting, handle reveal or clipboard
failures visibly, and never pass receipt actions as argv to the DX CLI. Package
metadata verification and manifest-command parity tests guard this mapping
before release packaging. Package hygiene verification also requires an
extension-local README and `.vscodeignore` so future VSIX packages document the
DX CLI/workspace-trust boundary and exclude source, tests, and DX manifest
metadata.

`smoke:vscode-loaded-host:j1` is the guarded installed-VS-Code smoke runner for
Extension Development Host command-registration checks. The PowerShell wrapper
owns serial build environment, disk, competing-process, and compile gates. The
TypeScript harness creates isolated temporary user-data, extensions, and
workspace paths, loads `dx-runtime.dx-vscode`, and checks that the contributed
command IDs are exposed without executing CLI-backed commands. It writes
`.dx/receipts/extensions/dx.vscode.command-center/vscode-loaded-host-latest.json`
only after a successful run. `write-vscode-loaded-host-proof-receipts.ts` also
accepts explicit metadata-only operator proof JSON for the same receipt path,
validates the current package-output receipt linkage, and refuses proof that
stores process output or lacks Extension Development Host verification. Both
paths remain proof runners until executed; loaded VS Code, Cursor, and Windsurf
receipts are not claimed until metadata receipts are captured.

## Browser Host Boundary

The browser host is a WebExtension adapter, not a DX runtime. It may collect
minimal active-tab metadata and render browser-native command surfaces. It must
not request broad host permissions, spawn processes, accept raw argv, store
command output, or copy Flow model-pack runtime code.

Browser command execution must stay behind the `dx.browser.native-host` JSON
protocol. UI dispatch is wired to typed background dispatch, and the browser
JavaScript transport boundary has a guarded process-level smoke test against the
real Rust native-host executable. Source-level DX CLI command plans now map
`dx.status` to `dx status`, `dx.doctor` to `dx doctor`,
`dx.forge.packages.list` to `dx forge packages --json`, and `dx.graph.read` to
`dx graph --json`. Installed binary execution proof currently covers the
allowlisted `dx status` and `dx doctor` pairs; Forge Packages and Build Graph
stay source/request-plan coverage until the guarded native-host smoke proves
those exact plans. A source-level loaded Chromium command smoke loads the
compiled background entrypoint and verifies trusted sender dispatch for Status,
Forge Packages, Build Graph, approved Doctor, and host-UI receipt actions with
an in-process runtime. Loaded-browser dispatch remains deferred until the
native-host manifest is installed and smoke-tested from a real loaded browser. The
`status`, Forge Packages, and Build Graph actions are low-risk, `doctor` remains
approval-gated, and receipts stay metadata-only until package signing and
loaded-browser smoke tests are added.

`scripts/write-browser-loaded-profile-receipt.ts` is the strict receipt writer
for real loaded Chrome, Microsoft Edge, and Firefox profile proof. It refuses
profileless evidence: proof must include an absolute browser executable, a
temporary profile path, a concrete extension id and extension URL, package-output
receipt evidence, native-host manifest registration, a verified background
service worker, and successful native-host round trips for Status, Forge
Packages, and Build Graph. It does not claim native-host release packaging,
signing, release checksums, store review, or distribution proof.
The only browser source file allowed to call `sendNativeMessage` is
`src/runtime/nativeHostTransport.ts`, and native-host manifests are installed
under user-scoped browser locations only.

### Zed Adapter

`hosts/zed/dx-zed` is the first post-VS Code editor adapter folder. Zed
extensions are manifest-rooted Rust/WebAssembly projects, so the current
scaffold uses slash commands and typed command-plan metadata instead of a custom
panel or external process bridge. It deliberately does not request `process:exec`,
`download_file`, or `npm:install` capabilities and does not implement an MCP
context server. Loaded Zed dev-extension smoke, WebAssembly build proof,
local-service proof, extension gallery package proof, signing, checksum
receipts, and public release proof remain deferred.

### Blender Adapter

`hosts/blender/dx-blender` is the first professional creative-tool adapter
folder. It uses Blender's extension manifest format plus a Python add-on entry
point with registered operators for approved DX actions. The current scaffold is
source-level only: it keeps DX commands as fixed shell-free argv, suppresses
process output, and emits an ignored package-layout proof containing
`blender_manifest.toml` and `__init__.py`. The guarded package-output receipt
hashes that layout without claiming loaded Blender smoke, installed add-on
proof, archive package proof, signing, release checksum proof, marketplace
review, or public release readiness.

### Obsidian Adapter

`hosts/obsidian/dx-command-center` is the first knowledge-workspace adapter
folder. The Obsidian plugin manifest id intentionally stays `dx-command-center`
so the local plugin folder matches the host manifest without putting the host
name in the plugin id. The TypeScript source keeps DX commands in a fixed
allowlist, runs them with `spawn` and `shell: false`, suppresses process output,
and marks the host package desktop-only because it uses Node.js APIs. The
current scaffold has a temp-directory bundle-output proof for generated
`main.js` through `scripts/build-obsidian-plugin.ts`, while the generated
`main.js` and source map remain ignored until explicitly built. The guarded
package-output receipt hashes `manifest.json`, generated `main.js`, and the
source map without claiming a loaded vault run. It does not claim loaded
test-vault smoke, signed package status, release checksum proof, community
plugin review, or release readiness.

### Figma Adapter

`hosts/figma/dx-figma` is the first design-tool adapter folder. Figma plugins
cannot spawn DX directly, so this scaffold uses typed plugin UI messages and a
future local-service boundary instead of shell or process execution. Unknown UI
messages are validated before command dispatch, so malformed plugin messages do
not reach the command-plan layer. Its Figma manifest requires dynamic page
loading and keeps production network access at `allowedDomains: ["none"]`;
`scripts/build-figma-plugin.ts` proves the TypeScript plugin entrypoint can
bundle to ignored `main.js` output in a temp directory, and receipt-copy is a
host-UI action that does not require local-service runtime proof. The guarded
package-output receipt hashes `manifest.json`, `ui.html`, generated `main.js`,
and the source map without claiming a loaded host run. Live local-service proof,
generated plugin ID, loaded Figma desktop smoke, signed package assets, release
checksum proof, Community review, and public release proof remain deferred.

### Canva Adapter

`hosts/canva/dx-canva` is the first Canva adapter folder. Canva apps run inside
an iframe under the Canva Apps SDK, so this scaffold uses typed message plans,
a design-editor app configuration, and a source-level UI that never mutates the
design or requests Canva runtime permissions. `scripts/build-canva-app.ts`
proves the TypeScript design-editor source can bundle to ignored `app.js`
output in a temp directory, and receipt-copy is a host-UI action that does not
require local-service runtime proof. The guarded package-output receipt hashes
`canva-app.json`, generated `app.js`, and the source map without claiming a
loaded Canva run. Development Canva app smoke, live local-service proof, Canva
review, signing, release checksum proof, and public release proof remain
deferred.

### Sketch Adapter

`hosts/sketch/dx-sketch` is a Sketch plugin adapter folder. Sketch plugins run
inside the host command environment, so this scaffold keeps DX work behind typed
command plans and a future local-service boundary instead of process execution,
network calls, filesystem access, document mutation, or macOS native bridges.
The scaffold supports DX status, asset search, document-safe metadata, and
receipt path actions while loaded Sketch plugin smoke, sketchtool run proof, and
local-service proof remain deferred.
`scripts/build-sketch-plugin.ts` proves the TypeScript command entrypoint can
bundle to an ignored `.sketchplugin` layout in a temp directory and rewrites
Sketch command scripts to generated `index.js`. Package proof, signing,
checksum receipts, notarization, Plugin Directory review, and public release
proof remain deferred.

### Photoshop Adapter

`hosts/adobe/dx-photoshop-uxp` is the first Adobe Photoshop UXP adapter folder.
Photoshop UXP plugins run as host-managed JavaScript panels and command
entrypoints, not native DX process launchers, so this scaffold uses typed
message plans and a future local-service boundary instead of shell or process
execution. Its Manifest v5 host target is Photoshop (`PS`),
`requiredPermissions` stays empty, and the source avoids Photoshop document
mutation, network calls, broad filesystem access, and process launch APIs.
`scripts/build-adobe-uxp-package.ts` proves the source scripts can become an
ignored UXP package-layout folder with copied manifest, rewritten `index.html`,
and generated `index.js`; the guarded package-output receipt records SHA-256
hashes for that ignored layout without claiming a loaded host run. Loaded
Photoshop UXP smoke, UXP Developer Tool receipt, document-safe runtime proof,
local-service proof, `.ccx` package proof, signing, release checksum proof,
Creative Cloud review, and public release proof remain deferred.

### Premiere Pro Adapter

`hosts/adobe/dx-premiere-pro-uxp` is an Adobe Premiere Pro UXP adapter folder.
Premiere Pro UXP plugins run as host-managed JavaScript panels and command
entrypoints, so this scaffold uses typed message plans and a future
local-service boundary instead of shell, process, native SDK, or hybrid plugin
execution. It avoids timeline or sequence mutation, export automation, broad
filesystem access, network calls, process launch, and native/hybrid plugin
bridges. The shared Adobe UXP build proof emits an ignored package-layout
folder with copied manifest, rewritten `index.html`, and generated `index.js`;
the guarded package-output receipt records SHA-256 hashes for that ignored
layout without claiming a loaded host run. Loaded Premiere Pro UXP smoke,
project-safe runtime proof, local-service proof, `.ccx` package proof, signing,
release checksum proof, Creative Cloud review, native SDK/hybrid plugin proof,
and public release proof remain deferred.

### InDesign Adapter

`hosts/adobe/dx-indesign-uxp` is an Adobe InDesign UXP adapter folder. InDesign
UXP plugins run as host-managed JavaScript panels and command entrypoints, so
this scaffold uses typed message plans and a future local-service boundary
instead of shell, process, native SDK, or hybrid plugin execution. It supports
metadata-only DX status, typography and asset search, document-safe metadata,
and receipt path actions while avoiding document mutation, broad filesystem
access, network calls, process launch, and native/hybrid plugin bridges. The
shared Adobe UXP build proof emits an ignored package-layout folder with copied
manifest, rewritten `index.html`, and generated `index.js`; the guarded
package-output receipt records SHA-256 hashes for that ignored layout without
claiming a loaded host run. Loaded InDesign UXP smoke, document-safe runtime
proof, local-service proof, `.ccx` package proof, signing, release checksum
proof, Creative Cloud review, native SDK/hybrid plugin proof, and public release
proof remain deferred.

Across Photoshop, Premiere Pro, and InDesign, receipt-path actions are host-UI
metadata actions guarded by loaded-host proof instead of local-service runtime
proof. Status and search actions stay local-service proof-gated until the
reviewed DX service boundary exists.

### DaVinci Resolve Adapter

`hosts/blackmagic/dx-davinci-resolve` is the first Blackmagic Design media-tool
adapter folder. DaVinci Resolve scripting uses host-loaded Python and Lua
scripts, so this scaffold exposes typed metadata-only command plans and a future
local-service boundary instead of shell or process execution. The source-level
scaffold must not render projects, mutate timelines or media pools, open
local-network scripting, call raw process bridges, or read/write arbitrary
files. The guarded package-output receipt hashes the command-plan JSON plus
Python and Lua metadata scripts without claiming a loaded Resolve run. Loaded
DaVinci Resolve smoke, Workflow Integration/external scripting proof, read-only
project metadata receipts, local-service proof, signing, release checksum
proof, Blackmagic distribution proof, and public release proof remain deferred.

### IntelliJ Platform Adapter

`hosts/jetbrains/dx-intellij-platform` is an IntelliJ Platform adapter folder.
The scaffold uses a Gradle plugin layout, `plugin.xml` action declarations, a
tool window, a project service, and typed Kotlin command-plan metadata. It keeps
DX work behind a future local-service boundary and does not spawn processes,
open sockets, mutate PSI/project files, or register inspections. Sandbox IDE
smoke, Plugin Verifier, local-service proof, signing, checksum receipts,
JetBrains Marketplace review, and public release proof remain deferred.

### Visual Studio Adapter

`hosts/visual-studio/dx-visual-studio` is a Visual Studio SDK adapter folder.
The scaffold uses VSIX metadata, a C# project file, VSCT command declarations,
typed command plans, and metadata-only local-service request records. It does
not execute DX, call live HTTP, write solution files, start builds, or claim
VSIX package readiness. Experimental Instance smoke, VSIX package proof,
local-service proof, signing, checksum receipts, Marketplace review, and public
release proof remain deferred.

### Unity Editor Adapter

`hosts/unity/dx-unity-editor` is a Unity Editor package adapter folder. The
scaffold uses a Unity package manifest, Editor-only asmdefs, menu/window source,
typed C# command plans, and a metadata-only local-service boundary. It does not
spawn processes, call `UnityWebRequest`, import assets, create project files,
trigger builds, or mutate scenes/assets. Loaded Unity Editor test-project smoke,
local-service proof, package tarball/checksum proof, signing, Asset
Store/distribution review, and public release proof remain deferred.

### Unreal Engine Adapter

`hosts/unreal/dx-unreal-engine` is an Unreal Engine editor plugin adapter
folder. The scaffold uses a `.uplugin` descriptor, one editor-only module,
tool-menu registration, and typed C++ command-plan metadata. It does not add a
runtime module, content plugin, process bridge, network bridge, Python bridge,
asset import, or project mutation. Loaded Unreal sample-project smoke,
local-service proof, package signing, checksum receipts, Fab/Marketplace review,
and public release proof remain deferred.

### Google Workspace Adapter

`hosts/google-workspace/dx-google-workspace-addon` is a Google Workspace Add-on
adapter folder. Apps Script add-ons cannot talk to a local DX process directly,
so the scaffold uses minimal `appsscript.json` metadata, homepage card models,
typed action plans, and a metadata-only cloud-service request envelope. It
requests no OAuth scopes and avoids Gmail, Drive, Docs, Sheets, Slides, and
Calendar content APIs until OAuth and loaded-host proof exist. Apps Script
deployment, OAuth consent/review, test Workspace file smoke, cloud-service
proof, Marketplace review, signing, checksum receipts, and public release proof
remain deferred. The guarded package-output receipt hashes generated
`appsscript.json` and `Code.gs` without claiming Apps Script deployment,
OAuth review, Marketplace review, or public release readiness.

### Affinity Content Adapter

`hosts/affinity/dx-affinity-content` is an Affinity content add-on bridge, not a
native Affinity SDK plugin. Affinity's supported source-level surface for DX is
manual import of content packs such as assets, fonts, swatches, styles, and
templates. Affinity Photo's Photoshop-compatible 64-bit filter plugin support is
tracked as a separate deferred native/filter-plugin proof path. The scaffold
does not automate Affinity, spawn processes, ship a filter binary, or claim
Affinity Store/public release readiness. The content-package receipt writer
requires at least one real importable Affinity artifact such as `.afassets`,
`.affont`, `.afpalette`, `.afstyles`, or `.aftemplate`, and keeps manual import,
native SDK plugin, Photoshop-compatible filter plugin, signing, checksum,
distribution, and loaded-app claims false. Captured content package proof,
manual import proof, Photoshop-compatible filter plugin proof, signing,
checksum receipts, loaded Affinity app smoke, and public release proof remain
deferred until real artifacts and import evidence exist. The manual-import
receipt writer is only enabled by an explicit
`DX_AFFINITY_MANUAL_IMPORT_PROOF_JSON` file and records human import metadata,
proof-file hashes, imported artifact paths, and Affinity import surfaces without
claiming Affinity automation, native SDK plugin support, filter plugin support,
signing, distribution, or loaded-app proof.

### Excel Adapter

`hosts/office/dx-excel` is the first Office adapter folder. Office Add-ins are
web add-ins, so Excel cannot spawn DX directly or use native messaging. The
current scaffold uses an XML task-pane manifest, `ReadDocument` permission, an
inert HTTPS source placeholder, typed task-pane messages, and the shared typed
Office local-service request boundary for proof-gated status/search actions.
`scripts/build-office-taskpane-assets.ts` proves the source taskpane can bundle
to ignored hosted `dist/taskpane.html`, `dist/taskpane.js`, and source map
output. Sideloaded Excel smoke, live local-service proof, signing, checksum
receipts, AppSource approval, and public release proof remain deferred.

### PowerPoint Adapter

`hosts/office/dx-powerpoint` is the second Office adapter folder and follows the
same thin Office boundary without turning Excel, PowerPoint, and Word into a
shared mega-adapter. The current scaffold uses an XML task-pane manifest, the
`Presentation` host, `PowerPointApi` requirement metadata, `ReadDocument`
permission, an inert HTTPS source placeholder, typed task-pane messages, and
the shared typed Office local-service request boundary for proof-gated
status/search actions. The shared Office taskpane build proof emits ignored
hosted `dist/taskpane.html`, `dist/taskpane.js`, and source map output.
Sideloaded PowerPoint smoke, live local-service proof, signing, checksum
receipts, AppSource approval, and public release proof remain deferred.

### Word Adapter

`hosts/office/dx-word` is the third Office adapter folder and owns Word-specific
document behavior instead of sharing document semantics through a generic Office
framework. The current scaffold uses an XML task-pane manifest, the `Document`
host, `WordApi` requirement metadata, `ReadDocument` permission, an inert HTTPS
source placeholder, typed task-pane messages, no-document-mutation source
guards, and the shared typed Office local-service request boundary for
proof-gated status/search actions. The shared Office taskpane build proof emits
ignored hosted `dist/taskpane.html`, `dist/taskpane.js`, and source map output.
Sideloaded Word smoke, live local-service proof, signing, checksum receipts,
AppSource approval, and public release proof remain deferred.

Across Excel, PowerPoint, and Word, receipt-copy actions are host-UI operations
and do not require local-service runtime proof. Status and search actions now
build a typed `dx.office.local-service` request envelope, then stay proof-gated
until sideloaded Office smoke and live local-service receipts exist. The
envelope carries only coarse host state; raw workbook names,
document URLs, tenant URLs, local file paths, and document text stay out of the
source-level boundary. The guarded package-output receipts hash sideload
`manifest.xml`, `taskpane.html`, generated `taskpane.js`, and source maps
without claiming loaded Office runs. The sideloaded-host receipt writer is
enabled only by an explicit `DX_OFFICE_SIDELOADED_HOST_PROOF_JSON` file. It
requires package-output receipt evidence, a matching sideload manifest hash,
HTTPS taskpane URL, loaded taskpane proof, observed command ids, command click
or proof-blocked status, and a coarse document state. It rejects
privacy-sensitive fields such as workbook names, document text, selection text,
file paths, account or tenant identifiers, URLs, and clipboard contents. It
claims only sideloaded host proof; local-service, signing, release checksum,
AppSource, and distribution proof remain separate gates.
