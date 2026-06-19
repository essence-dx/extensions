# DX Browser Command Center

Official experimental DX browser host adapter for Chrome, Microsoft Edge, and
Firefox.

## Structure

- `dx.extension.toml`: DX extension manifest contract.
- `manifests/`: browser-specific WebExtension manifests.
- `src/runtime/`: command plans and native-host protocol types.
- `src/background/`: browser background entrypoints.
- `src/ui/`: small host UI renderers.
- `static/`: browser HTML, CSS, and branded DX icon asset.
- `tests/`: command-plan, protocol, manifest-policy, surface, and build-output checks.

## Command Plans

Source-level browser command plans are `DX Status`, approval-gated `DX Doctor`,
`DX Forge Packages`, `DX Build Graph`, and host-UI `Open Receipts`. The Forge
and graph entries are browser/native-host request plans until the guarded
native-host smoke proves installed binary execution for those exact commands.
They are not loaded Chrome, Microsoft Edge, or Firefox proof and are not release
packaging proof.

## Commands

```powershell
npm --workspace dx-browser run check
npm run build:browser:j1
```

Generated browser artifacts are written under `dist/` and are not committed.
