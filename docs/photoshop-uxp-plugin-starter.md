# Photoshop UXP Plugin Starter Evidence

Photoshop is a source-level experimental DX adapter target. This note records
the starter-gate and package-layout evidence for
`hosts/adobe/dx-photoshop-uxp`; it is not release readiness.

## Official SDK Evidence

- Photoshop UXP getting started guide:
  https://developer.adobe.com/photoshop/uxp/guides/
- Photoshop Manifest v5 permission model:
  https://developer.adobe.com/photoshop/uxp/2022/guides/uxp_guide/uxp-misc/manifest-v5/
- UXP entry point API for commands and panels:
  https://developer.adobe.com/photoshop/uxp/2022/uxp-api/reference-js/Modules/uxp/Entry%20Points/EntryPoints/

## Manifest Policy

- The scaffold uses `"manifestVersion": 5`.
- The host target is Photoshop through `host.app = "PS"` and
  `minVersion = "23.3.0"`.
- `requiredPermissions` stays empty until an exact reviewed DX service endpoint
  or Photoshop API proof exists.
- The manifest must not request network, webview, clipboard, local filesystem,
  process launch, wildcard domains, or broad external-link permissions.

## Runtime Boundary

The panel and command entrypoints only render metadata-only DX command plans.
Source files must not call `fetch`, `XMLHttpRequest`, Photoshop document
mutation APIs, UXP process-launch APIs, process spawning APIs, or raw DX
commands. Asset search and status commands are command plans for a future
local-service bridge, not live runtime proof.

## Package Layout

`scripts/build-adobe-uxp-package.ts` copies `manifest.json`, rewrites
`index.html` to load generated `index.js`, and compiles the ordered TypeScript
scripts into ignored `dist` output. The guarded package-output receipt records
SHA-256 hashes for that ignored layout. This proves local package layout and
host-free checksum evidence only; it does not prove UXP Developer Tool loading,
`.ccx` packaging, signing, release checksum proof, Creative Cloud review, or
public release.

## Deferred Proof

Loaded Photoshop UXP smoke, UXP Developer Tool loading receipt, document-safe
runtime proof, local-service proof remains deferred, `.ccx` package proof,
signing, release checksum proof, Creative Cloud distribution remains deferred,
and public release proof remains deferred.
