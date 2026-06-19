# Premiere Pro UXP Plugin Starter Evidence

Premiere Pro is a source-level experimental DX adapter target. This note
records the starter-gate and package-layout evidence for
`hosts/adobe/dx-premiere-pro-uxp`; it is not release readiness.

## Official SDK Evidence

- Premiere Pro UXP getting started guide:
  https://developer.adobe.com/premiere-pro/uxp/plugins/
- Premiere Pro UXP manifest:
  https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/
- Premiere Pro UXP entrypoints:
  https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/entrypoints/
- Premiere Pro UXP panels and commands:
  https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/panels-and-commands/

## Manifest Policy

- The scaffold uses `"manifestVersion": 5`.
- The host target is Premiere Pro through `host.app = "premierepro"` and
  `minVersion = "25.6.0"`.
- `requiredPermissions` stays empty until an exact reviewed DX service endpoint
  or Premiere Pro API proof exists.
- The manifest must not request network, webview, clipboard, local filesystem,
  process launch, wildcard domains, native addon, hybrid plugin, or broad
  external-link permissions.

## Runtime Boundary

The panel and command entrypoints only render metadata-only DX command plans.
Source files must not call `fetch`, `XMLHttpRequest`, Premiere Pro project or
timeline mutation APIs, UXP process-launch APIs, process spawning APIs, hybrid
native libraries, or raw DX commands. Media asset search and status commands
are command plans for a future local-service bridge, not live runtime proof.

## Package Layout

`scripts/build-adobe-uxp-package.ts` copies `manifest.json`, rewrites
`index.html` to load generated `index.js`, and compiles the ordered TypeScript
scripts into ignored `dist` output. The guarded package-output receipt records
SHA-256 hashes for that ignored layout. This proves local package layout and
host-free checksum evidence only; it does not prove UXP Developer Tool loading,
`.ccx` packaging, signing, release checksum proof, Creative Cloud review,
native SDK or hybrid plugin behavior, or public release.

## Deferred Proof

Loaded Premiere Pro UXP smoke, UXP Developer Tool loading receipt,
project-safe runtime proof, local-service proof remains deferred, hybrid plugin
proof remains deferred, `.ccx` package proof, signing, release checksum proof,
Creative Cloud distribution remains deferred, and public release proof remains
deferred.
