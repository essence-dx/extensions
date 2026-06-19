# DX Premiere Pro Command Center

Official experimental Adobe Premiere Pro UXP adapter for DX.

This source scaffold defines a Premiere Pro UXP command surface for:

- Show DX Status
- Search DX Media Assets
- Show DX Receipts Path

The UXP manifest uses Manifest v5 with no network, local filesystem,
clipboard, webview, native addon, hybrid plugin, or process-launch permission.
The TypeScript source does not call the Premiere Pro project APIs, mutate
timelines, request network access, or call a DX service yet. A package-layout
build proof emits an ignored `dist` folder with `manifest.json`, rewritten
`index.html`, generated `index.js`, and source map output. A host-free
package-output checksum receipt records the ignored package files and SHA-256
hashes without claiming a loaded Premiere Pro run. Loaded Premiere Pro UXP smoke,
local-service proof remains deferred, project-safe runtime proof, hybrid plugin proof remains deferred,
`.ccx` package proof, signing, and release checksum
proof remain deferred, and Creative Cloud review plus public release proof
remain deferred.

## Development Check

```powershell
npm run test:premiere-pro-adapter
npm run test:adobe-uxp-package-output
npm run test:adobe-uxp-package-output-receipts
npm run build:adobe-uxp:j1
```
