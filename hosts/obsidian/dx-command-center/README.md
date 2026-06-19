# DX Obsidian Command Center

Official experimental Obsidian adapter for DX.

This source scaffold exposes approved DX actions from an Obsidian vault:

- Show DX Status
- Run DX Doctor
- Copy DX Receipts Path

The command actions use fixed shell-free argv, suppress process output, and keep
the plugin desktop-only because it relies on Obsidian's desktop Node.js runtime.
This folder has source-level adapter tests plus a temp-directory bundle-output
proof for generated `main.js`. The guarded package-output receipt hashes
`manifest.json`, generated `main.js`, and the source map without claiming a
loaded vault run. Loaded vault smoke, release assets, signing, release checksum
proof, community plugin review, and package proof remain deferred.

## Development Check

```powershell
npm run test:obsidian-adapter
npm run test:obsidian-build-output
npm run test:obsidian-package-output-receipt
```

To emit the ignored plugin entrypoint for local packaging:

```powershell
npm run build:obsidian:j1
```
