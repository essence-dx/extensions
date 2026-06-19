# DX DaVinci Resolve Command Center

Official experimental DaVinci Resolve scripting adapter for DX.

This source scaffold defines metadata-only Python and Lua command plans for:

- Show DX Status
- Inspect Resolve Project
- Show DX Receipts Path

The scripts do not call Resolve project APIs, render APIs, media pool APIs,
timeline APIs, subprocess APIs, filesystem write APIs, sockets, or a DX service
yet. This folder is source-level only: loaded DaVinci Resolve smoke,
local-service proof remains deferred, Workflow Integration proof remains
deferred, read-only project metadata proof, signing, and public release
artifact checksum proof remain deferred, and release proof remains deferred.
The guarded package-output receipt hashes `command-plans.json`,
`dx.extension.toml`, and the Python and Lua metadata scripts. The creative-host
checksum writer can emit `checksum-latest.json` from that verified package
receipt without claiming a loaded Resolve run.

## Development Check

```powershell
npm run test:davinci-resolve-adapter
npm run test:davinci-resolve-package-output-receipt
npm run test:creative-host-checksum-receipts
npm run package:davinci-resolve:j1
npm run write:creative-host-checksum-receipts:j1
```
