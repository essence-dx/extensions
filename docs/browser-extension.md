# DX Browser Extension

The browser extension is an experimental command-center host adapter for Chrome,
Microsoft Edge, and Firefox. It shares the DX extension manifest contract with
the VS Code host and keeps future execution behind a typed native-messaging
protocol.

## Boundary

- Browser code owns command selection, active-tab context, and host UI.
- Browser command execution must go through the typed `dx.browser.native-host`
  transport boundary. Current UI dispatch is wired to typed background dispatch,
  and the JavaScript transport can be smoke-tested against the real Rust
  native-host executable. Installed native-host binary execution is proven for
  allowlisted `dx status` and `dx doctor` plans, and a profileless
  loaded-background receipt smoke is wired into the guarded native-host wrapper.
  The local browser check also loads the compiled Chromium background entrypoint
  and proves trusted sender dispatch for Status, Forge Packages, Build Graph,
  approved Doctor, and host-UI receipt actions with an in-process runtime.
  Installed browser execution remains deferred until the native host is
  smoke-tested from real loaded Chrome, Microsoft Edge, and Firefox profiles.
- Approved native-host actions now carry source-level, shell-free DX CLI command
  plans for `dx status`, approval-gated `dx doctor`,
  `dx forge packages --json`, and `dx graph --json`; browser code does not
  spawn processes, accept user-provided argv, or store DX output. Installed
  native-host binary execution is proven for `dx status` and `dx doctor`; Forge
  Packages and Build Graph remain source/request-plan coverage until the guarded
  native-host smoke proves those exact plans.
- Native-host manifest installation is scripted, user-scoped, and development-only.
- The PowerShell installer and POSIX shell install/uninstall scripts can render
  or remove Chrome, Microsoft Edge, and Firefox native-host manifests in
  temporary roots for manifest-only proof before writing user-scoped browser
  registrations. They do not install, build, or prove a native-host executable.
- Microsoft Edge reuses the Chromium runtime entrypoints, but release proof stays
  separate: Edge extension ids, Edge native-host registration, loaded Edge
  dispatch receipts, Edge Add-ons package/review proof, signing, checksums, and
  release packaging are independent gates.
- Loaded-browser DX CLI dispatch proof remains future work until Chrome,
  Microsoft Edge, and Firefox smoke tests cover the installed Rust native host.

## Checks

```powershell
npm run check:browser
npm run smoke:browser-native-host:j1
npm run build:browser:j1
npm run verify:j1
```

`npm run build:browser:j1` prepares browser artifacts under ignored `dist/`
folders and verifies that browser entrypoints are bundled.

`npm run smoke:browser-native-host:j1` builds the Rust native-host executable
with `cargo build -j 1`, runs a process-level native-messaging smoke test, and
runs the profileless Chromium loaded-background receipt smoke. This still does
not prove a real loaded browser profile.

`npm --workspace dx-browser run test:loaded-browser-command-smoke` is included
in the browser local check. It loads the compiled Chromium background entrypoint
with a trusted extension sender and verifies command dispatch shape without
claiming an installed native-host receipt.
When a debug executable already exists and disk is tight, pass a path to avoid a
rebuild:

```powershell
npm run smoke:browser-native-host:j1 -- -NativeHostPath G:\Dx\extensions\target\debug\dx-browser-native-host.exe
```

Native-host manifests can be installed for development after building the Rust
native-host executable:

```powershell
npm run install:browser-native-host:j1 -- -NativeHostPath <absolute-path-to-dx-browser-native-host.exe> -ChromeExtensionId <chrome-extension-id> -EdgeExtensionId <edge-extension-id>
npm run uninstall:browser-native-host:j1 -- -Browser All
```

For non-destructive manifest rendering proof, pass temporary roots and skip
registry writes:

```powershell
npm run install:browser-native-host:j1 -- -ManifestOnly -NativeHostPath <absolute-path-to-dx-browser-native-host.exe> -ChromeExtensionId <chrome-extension-id> -EdgeExtensionId <edge-extension-id> -InstallRoot <temporary-chromium-root> -FirefoxManifestRoot <temporary-firefox-root>
```

On macOS/Linux, use the host shell installer with temporary roots for the same
manifest-only install proof:

```bash
bash hosts/browser/dx-browser/scripts/install-native-host.sh \
  --manifest-only \
  --native-host-path /absolute/path/to/dx-browser-native-host \
  --chrome-extension-id <chrome-extension-id> \
  --edge-extension-id <edge-extension-id> \
  --install-root <temporary-chromium-root> \
  --firefox-manifest-root <temporary-firefox-root>
```

The matching shell uninstaller can prove it removes only those exact temporary
manifest files:

```bash
bash hosts/browser/dx-browser/scripts/uninstall-native-host.sh \
  --manifest-only \
  --install-root <temporary-chromium-root> \
  --firefox-manifest-root <temporary-firefox-root>
```
