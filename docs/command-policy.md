# DX Extensions Command Policy

DX extension work runs on a Windows machine that can become unstable under broad
parallel builds. Any heavy command added to this workspace must be single-job by
default.

## Required Defaults

- Cargo build, check, test, and clippy commands must include `-j 1`.
- Root heavy commands must route through the PowerShell wrappers in `scripts/`.
- Long-running scripts must avoid background fan-out unless they also expose a
  single-job mode.
- Do not add `concurrently`, `npm-run-all -p`, broad workspace builds, or hidden
  nested build chains without a focused reason.
- Extension host packages should validate metadata before compiling host bundles.
- Browser extension build scripts must compile one host package at a time and
  write generated artifacts only under ignored `dist/` paths.
- Schema-generated manifest declaration files are source-owned contract artifacts
  under `schemas/types/`, not browser bundle artifacts.

## Safe Examples

```powershell
npm run verify
npm run verify:j1
npm run build:j1
npm run check:browser
npm run check:vscode
npm run check:rust
npm run check:official-registry
npm run check:extension-starter
npm run check:professional-host-targets
npm run check:native-host-command-boundary
npm run build:browser:j1
npm run smoke:browser-native-host:j1
npm run smoke:browser-loaded-profile:j1
npm run package:browser-native-host:j1
npm run smoke:vscode-loaded-host:j1
npm run smoke:office-local-service:j1
npm run smoke:local-service:j1
npm run smoke:release-package-checksum:j1
npm run smoke:package-signing:j1
npm run smoke:distribution-review:j1
npm run write:operator-proof-template -- --list
npm run write:operator-proof-template -- --id figma --output .dx/operator-proof-templates/figma.json
npm run smoke:ide-game-engine-loaded-host:j1
npm run smoke:ide-game-engine-special-proof:j1
npm run smoke:creative-loaded-host:j1
npm run package:adobe-ccx:j1
npm run smoke:google-workspace-deployment:j1
npm run smoke:figma-loaded-host:j1
npm run smoke:application-loaded-host:j1
```

## Release Gate

Before release packaging, run:

```powershell
npm run verify:j1
git status --short --branch
```

If a future package manager or host SDK ignores single-job settings, document the
exact behavior in this file before making it part of the normal workflow.
