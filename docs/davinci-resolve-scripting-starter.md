# DaVinci Resolve Scripting Starter Evidence

DaVinci Resolve is a source-level experimental DX adapter target. This note
records the starter-gate evidence for `hosts/blackmagic/dx-davinci-resolve`; it
is not release readiness.

## Official SDK Evidence

- Blackmagic Design describes DaVinci Resolve and Fusion automation with Python
  and Lua scripting:
  https://www.blackmagicdesign.com/products/davinciresolve/fusion
- Current DaVinci Resolve manuals and support downloads are published through
  Blackmagic Design Support:
  https://www.blackmagicdesign.com/support
- The detailed Resolve scripting README and examples are bundled Developer
  documentation inside a local Resolve installation, so this repository records
  source-level intent only until a reviewed local installation proof exists.

## Script Policy

- Python and Lua scripts stay metadata-only until loaded-host proof exists.
- The first scripts must not render, start jobs, mutate projects, change media
  pools, edit timelines, create markers, alter clips, launch shells, use sockets,
  write files, or open local network scripting.
- The first source folder does not create a Workflow Integration Plugin. That
  path remains separate because it needs Resolve Studio, host loading, signing,
  package, and receipt proof.

## Runtime Boundary

The scripting files only render typed DX command plans for a future local-service
bridge and read-only project metadata proof. Asset search, project inspection,
and receipt commands are command plans, not live Resolve automation.

`scripts/write-davinci-resolve-package-output-receipt.ts` records a host-free
checksum receipt for `command-plans.json`, `dx.extension.toml`, and the Python
and Lua metadata scripts. The receipt is local evidence only and does not claim
loaded Resolve, read-only project metadata, Workflow Integration, signing, or
public release readiness.

## Deferred Proof

Loaded DaVinci Resolve smoke, bundled Developer documentation version capture,
read-only project metadata receipt, local-service proof remains deferred,
Workflow Integration proof remains deferred, signing, release checksum proof,
package archive proof, and public release proof remain deferred.
