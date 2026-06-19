# DX Sketch Command Center

Official experimental Sketch plugin adapter for DX.

This source scaffold defines Sketch menu commands for:

- Show DX Status
- Search DX Assets
- Show DX Receipts Path

The Sketch manifest is TypeScript-first and command-only. A temp-directory
build-output proof emits an ignored `.sketchplugin` bundle with generated
`index.js`. The package-output receipt records the generated bundle files and
SHA-256 hashes, and the creative-host checksum writer can emit
`checksum-latest.json` from that verified package receipt without claiming a
loaded Sketch run. The repository still does not commit generated bundle output,
appcast metadata, package manager workspace files, direct process bridges,
document mutation, broad filesystem access, or network bridges. Loaded Sketch
plugin smoke remains deferred, sketchtool run proof remains deferred,
local-service proof remains deferred, release package proof remains deferred,
signing and public release artifact checksum proof remain deferred, notarization
proof remains deferred, and plugin listing proof remains deferred.

## Development Check

```powershell
npm run test:sketch-adapter
npm run test:sketch-build-output
npm run test:sketch-package-output-receipt
npm run test:creative-host-checksum-receipts
npm run build:sketch:j1
npm run write:creative-host-checksum-receipts:j1
```
