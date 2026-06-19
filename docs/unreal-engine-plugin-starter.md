# Unreal Engine Plugin Starter

Official docs: https://dev.epicgames.com/documentation/en-us/unreal-engine/plugins-in-unreal-engine

`hosts/unreal/dx-unreal-engine` is a source-level only Unreal Editor plugin
scaffold. It uses a `.uplugin` descriptor, one editor-only module, tool-menu
registration, and typed C++ command-plan metadata.

`scripts/write-unreal-engine-package-output-receipt.ts` records a host-free
checksum receipt for the checked-in editor source-plugin layout. It proves
deterministic plugin files and hashes only; it is not a loaded Unreal Editor
smoke, packaged plugin archive, signing, Fab/Marketplace, or sample-project
enablement proof.

The adapter keeps DX work behind a future `dx-local-service` boundary. It must
not add runtime modules, content plugins, process bridges, sockets, HTTP,
Python bridges, asset import, project mutation, package proof, or
Fab/Marketplace readiness claims before loaded Unreal Editor smoke receipts,
checksums, signing, and local-service proof exist.

Loaded Unreal Editor smoke, sample-project enablement, DX local-service proof
is pending; local-service proof remains deferred, package signing, checksum
receipts, Fab/Marketplace review, and release proof remain deferred.
