# DX Canva Command Center

Official experimental Canva Apps SDK adapter for DX.

This source scaffold defines a Canva design-editor app surface for:

- Show DX Status
- Search DX Assets
- Copy DX Receipts Path

The `canva-app.json` file enrolls the Design Editor intent and requests no
runtime permissions. The TypeScript source does not spawn processes, open
external URLs, call a DX service, read private Canva assets, or mutate Canva
designs yet. `npm run test:canva-build-output` proves the TypeScript app source
emits the ignored `app.js` bundle in a temp directory. This folder is
source-level only. The guarded package-output receipt hashes `canva-app.json`,
generated `app.js`, and the source map without claiming a loaded Canva run.
Development Canva app smoke remains deferred, live local-service proof remains deferred,
Canva review remains deferred, and signing, release checksum proof, and public
release proof remain deferred.

## Development Check

```powershell
npm run test:canva-adapter
npm run test:canva-build-output
npm run test:figma-canva-package-output-receipts
```
