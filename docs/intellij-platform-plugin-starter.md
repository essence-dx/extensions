# IntelliJ Platform Plugin Starter

Official docs: https://plugins.jetbrains.com/docs/intellij/welcome.html

`hosts/jetbrains/dx-intellij-platform` is a source-level only Kotlin plugin
scaffold. It uses IntelliJ Platform plugin metadata, `plugin.xml`, actions, a
tool window, and a project service to expose metadata-only DX command plans.

`scripts/write-intellij-platform-package-output-receipt.ts` records a
host-free checksum receipt for the checked-in Gradle source plugin layout. It
proves deterministic plugin files and hashes only; it is not a sandbox IDE
smoke, Gradle plugin package, Plugin Verifier, signing, Marketplace, or
distribution proof.

The adapter keeps DX work behind a future `dx-local-service` boundary. It must
not execute process APIs, open sockets, mutate PSI/project files, register
inspections, or claim Marketplace readiness before sandbox IDE smoke receipts,
Plugin Verifier proof, signing, checksums, and local-service proof exist.

Sandbox IDE smoke, local-service proof remains deferred, signing, checksum
receipts, JetBrains Marketplace review, and release proof remain deferred.
