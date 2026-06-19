# DX InDesign Command Center

Official experimental Adobe InDesign UXP adapter for DX.

This source scaffold defines an InDesign UXP command surface for:

- Show DX Status
- Search DX Assets
- Show DX Receipts Path

The UXP manifest uses Manifest v5 with no network, local filesystem,
clipboard, webview, native addon, hybrid plugin, or process-launch permission.
The TypeScript source does not call the InDesign document APIs, mutate pages,
stories, typography, or layout objects, request network access, or call a DX
service yet. A package-layout build proof emits an ignored `dist` folder with
`manifest.json`, rewritten `index.html`, generated `index.js`, and source map
output. A host-free package-output checksum receipt records the ignored package
files and SHA-256 hashes without claiming a loaded InDesign run. Loaded InDesign UXP smoke,
local-service proof remains deferred, document-safe runtime proof, hybrid plugin proof remains deferred,
`.ccx` package proof, signing, and release checksum
proof remain deferred, and Creative Cloud review plus public release proof
remain deferred.

## Development Check

```powershell
npm run test:indesign-adapter
npm run test:adobe-uxp-package-output
npm run test:adobe-uxp-package-output-receipts
npm run build:adobe-uxp:j1
```
