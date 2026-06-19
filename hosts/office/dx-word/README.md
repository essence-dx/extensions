# DX Word Command Center

Official experimental Word adapter for DX.

This source scaffold defines an Office task-pane add-in surface for:

- Show DX Status
- Search DX Assets
- Copy DX Receipts Path

Word cannot spawn DX directly. The task pane keeps commands as typed plans for
a future DX local-service bridge and requests only document read permission in
the XML manifest. A hosted task-pane asset proof emits ignored `dist`
`taskpane.html`, `taskpane.js`, and source map output. The guarded package-output
receipt hashes sideload `manifest.xml`, `taskpane.html`, generated
`taskpane.js`, and the source map without claiming a loaded Word run.
Sideloaded Word smoke remains deferred. The local-service proof remains deferred.
Signing, release checksum proof, AppSource approval, and public release proof
remain deferred.

## Development Check

```powershell
npm run test:word-adapter
npm run test:office-taskpane-asset-output
npm run test:office-package-output-receipts
npm run build:office-taskpane:j1
```
