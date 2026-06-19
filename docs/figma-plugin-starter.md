# Figma Plugin Starter Evidence

Figma is a source-level experimental DX adapter target. This note records the
starter-gate evidence for `hosts/figma/dx-figma`; it is not release readiness.

## Official SDK Evidence

- Manifest schema and required plugin fields:
  https://developers.figma.com/docs/plugins/manifest/
- Network access model:
  https://developers.figma.com/docs/plugins/making-network-requests/
- Runtime split between main thread and iframe UI:
  https://developers.figma.com/docs/plugins/how-plugins-run/

## Manifest Policy

- New plugins must declare `documentAccess: "dynamic-page"`.
- Production network access stays at `allowedDomains: ["none"]` until an exact
  reviewed DX service endpoint exists.
- `devAllowedDomains` stays empty for this scaffold because DX local-service
  proof remains deferred.
- The manifest must not use `build`, `enableProposedApi`,
  `enablePrivatePluginApi`, broad wildcard domains, or privileged Figma scopes
  without a focused source owner and receipt plan.

## Runtime Boundary

The Figma main thread and plugin UI exchange typed messages only. Source files
must not call `fetch`, `XMLHttpRequest`, `child_process`, process spawning APIs,
shell wrappers, or raw DX commands. Asset search and status commands are command
plans for a future local-service bridge, not live runtime proof.

`scripts/build-figma-plugin.ts` owns the TypeScript bundle proof for the
manifest's `main.js` entry. Tests must emit that bundle into a temp directory so
generated JavaScript never becomes hand-authored source.

`scripts/write-figma-canva-package-output-receipts.ts --host figma` records a
host-free checksum receipt for `manifest.json`, `ui.html`, generated `main.js`,
and the source map. The receipt is local evidence only and does not claim loaded
Figma, signing, Community review, or public release readiness.

## Deferred Proof

Loaded Figma desktop smoke, generated plugin ID replacement, live local-service
proof, signing, release checksum proof, Community review remains deferred, and
public release proof remains deferred.
