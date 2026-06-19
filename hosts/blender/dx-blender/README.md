# DX Blender Command Center

Official experimental Blender adapter for DX.

This add-on exposes approved DX actions inside Blender's sidebar:

- Show DX Status
- Run DX Doctor
- Open DX Receipts

The command actions use fixed shell-free argv and suppress process output. This
folder is source-level only. The guarded package-layout proof emits ignored
`dist/blender_manifest.toml` and `dist/__init__.py` output, and the
package-output receipt hashes those files. The creative-host checksum writer
can emit `checksum-latest.json` from that verified package receipt without
claiming a loaded Blender run. Loaded Blender smoke, installed add-on proof,
package archive proof, signing, public release artifact checksum proof,
marketplace approval, and release packaging remain deferred.

## Development Check

```powershell
npm run test:blender-adapter
npm run test:blender-package-output
npm run test:blender-package-output-receipt
npm run test:creative-host-checksum-receipts
npm run build:blender:j1
npm run write:creative-host-checksum-receipts:j1
```
