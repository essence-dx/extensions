# Sketch Plugin Starter Evidence

Sketch is a source-level experimental DX adapter target. This note records the
starter-gate evidence for `hosts/sketch/dx-sketch`; it is not release evidence.

## Official Sources

- Sketch plugin manifest:
  https://developer.sketch.com/plugins/plugin-manifest
- Sketch plugin bundle:
  https://developer.sketch.com/plugins/plugin-bundle
- Sketch create plugin guide:
  https://developer.sketch.com/plugins/create-a-plugin
- Sketch command-line plugin runner:
  https://developer.sketch.com/cli/run-plugin
- Sketch publish plugin guide:
  https://developer.sketch.com/plugins/publish-a-plugin

## Source Boundary

- Sketch plugins are `.sketchplugin` bundles with a `Contents/Sketch`
  `manifest.json`; this repository now proves the generated bundle layout in a
  temp directory without committing generated JavaScript.
- The manifest identifier uses reverse-domain syntax and remains development
  scoped as `dev.dx.sketch.command-center`.
- The official manifest schema requires an icon field; the source manifest keeps
  `icon.png` as metadata while icon asset proof remains deferred.
- Commands declare a `script` and `handler`; this scaffold keeps those handlers
  in `src/index.ts`, and the build proof rewrites bundled command scripts to
  `index.js` under `Contents/Sketch`.
- `scope = application` keeps status and receipt commands available without
  needing a document-open mutation path.

## Deferred Proof

Loaded Sketch plugin smoke, sketchtool run proof, local-service proof remains deferred, package proof, signing, checksum receipts, notarization, update appcast, plugin listing proof remains deferred, and public release proof all remain deferred.
