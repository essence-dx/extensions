# Canva Apps SDK Starter

Canva is a professional design target for DX asset and receipt workflows. This
starter record is evidence for a source-level scaffold only; it does not prove a
loaded Canva app, app bundle, Canva review, public release, signing, checksums,
or marketplace readiness.

## Official Evidence

- `canva-app.json` is the Canva app configuration file and includes
  `manifest_schema_version`, `runtime.permissions`, and intent enrollment:
  https://www.canva.dev/docs/apps/app-configuration/canva-app-json/
- Canva apps run as JavaScript inside an iframe embedded in the Canva editor,
  with Canva APIs exposed through SDK packages:
  https://www.canva.dev/docs/apps/integrating-canva/
- Release submission requires a standalone JavaScript bundle uploaded through
  Canva's Developer Portal; Canva documents `dist/app.js`, no code splitting,
  and a 5 MB bundle limit:
  https://www.canva.dev/docs/apps/bundling-apps/
- Public and team apps must pass their relevant Canva review path before
  release:
  https://www.canva.dev/docs/apps/submitting-apps/

## Source Boundary

- The DX scaffold requests no Canva runtime permissions.
- The DX scaffold enrolls the Design Editor intent only.
- The source must not read design content, write design content, upload private
  assets, open external URLs, or call a local service until those actions have
  explicit loaded-host proof.
- `scripts/build-canva-app.ts` owns the TypeScript bundle proof for the
  generated `app.js` entry. Tests must emit that bundle into a temp directory so
  generated JavaScript never becomes hand-authored source.
- `scripts/write-figma-canva-package-output-receipts.ts --host canva` records a
  host-free checksum receipt for `canva-app.json`, generated `app.js`, and the
  source map. The receipt is local evidence only and does not claim loaded
  Canva, signing, Canva review, or public release readiness.
- The local-service proof remains deferred.
- Canva review remains deferred.

## Deferred Proof

- Development Canva app smoke with metadata-only command availability receipts.
- Local-service proof for DX status and asset search.
- Package signing, release checksum proof, Canva review evidence, and release
  proof.
