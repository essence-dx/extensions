# DX Zed Command Center

Official experimental Zed adapter for DX.

This source scaffold defines a Zed slash-command extension surface for:

- `/dx-status`
- `/dx-assets`
- `/dx-receipts`

Zed extensions compile Rust to WebAssembly. This adapter keeps commands as typed
plans and returns metadata-only Assistant output until a reviewed DX
local-service bridge exists. Loaded dev-extension release proof is based on the
installed source path, Zed extension index, host log, executable hash, and
package-matched `extension.wasm` evidence rather than slash-command availability.
This folder is source-level only: loaded Zed dev-extension smoke remains
deferred, local-service proof remains deferred, signing and public release
checksum proof remain deferred, and extension gallery review and public release
proof remain deferred. The ignored `extension.wasm` output is covered by the
guarded root `build:zed:j1` proof.

## Development Check

```powershell
npm run test:zed-adapter
npm run build:zed:j1
```
