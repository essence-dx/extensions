# DX Figma Command Center

Official experimental Figma adapter for DX.

This source scaffold defines a Figma plugin command surface for:

- Show DX Status
- Search DX Assets
- Copy DX Receipts Path

The Figma manifest keeps production network access disabled with
`allowedDomains: ["none"]`. The TypeScript source does not spawn processes,
open shells, or call a DX service yet. `npm run test:figma-build-output` proves
the TypeScript main-thread source emits the ignored `main.js` bundle in a temp
directory. The guarded package-output receipt hashes `manifest.json`, `ui.html`,
generated `main.js`, and the source map without claiming a loaded Figma run.
This folder remains source-level only: loaded Figma desktop smoke, generated
plugin ID replacement, live local-service proof, signing and release checksum
proof remain deferred, Community review remains deferred, and public release
proof remains deferred.

## Development Check

```powershell
npm run test:figma-adapter
npm run test:figma-build-output
npm run test:figma-canva-package-output-receipts
```
