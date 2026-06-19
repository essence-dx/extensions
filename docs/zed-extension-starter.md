# Zed Extension Starter

This is the source-work evidence record for `hosts/zed/dx-zed`.

## Official Evidence

- Developing extensions: https://zed.dev/docs/extensions/developing-extensions
- Slash command extensions: https://zed.dev/docs/extensions/slash-commands
- Extension capabilities: https://zed.dev/docs/extensions/capabilities
- Zed Rust extension API: https://docs.rs/crate/zed_extension_api/latest/source/README.md
- Extension architecture notes: https://zed.dev/blog/zed-decoded-extensions

## Adapter Boundary

Zed extensions are repositories with an `extension.toml` manifest. Custom
behavior is written in Rust and compiled to WebAssembly through
`zed_extension_api`. The first DX Zed adapter uses slash commands because they
are visible in the Assistant and can return metadata-only text without starting
an external process.

The first approved source-level slash commands are:

- `/dx-status`
- `/dx-assets`
- `/dx-receipts`

This scaffold does not request `process:exec`, `download_file`, or `npm:install`
capabilities. The local-service proof remains deferred, so slash commands render
only command-plan metadata until the DX service boundary is reviewed and
loaded-host receipts exist.

`scripts/write-zed-package-output-receipt.ts` records a host-free checksum
receipt for the current `extension.toml` plus ignored `extension.wasm` package
layout. It proves the WebAssembly header and package hashes only; it is not a
loaded Zed dev-extension smoke, gallery package, signing, or distribution proof.

Loaded dev-extension proof is intentionally not based on slash-command availability.
A valid `smoke:application-loaded-host:j1` Zed proof must capture the installed
dev-extension source path, installed extension path, Zed extension index, host
log reference, Zed executable hash, and an `extension.wasm` hash that matches the
package-output receipt.

## Deferred Proof

WebAssembly build-output proof is present through the guarded `build:zed:j1`
path. Loaded Zed dev-extension smoke remains deferred until installed
source/index/log/WASM evidence is captured. Extension gallery submission remains deferred.
Local-service proof, package signing, public release checksum proof, and release
packaging remain separate gates.
