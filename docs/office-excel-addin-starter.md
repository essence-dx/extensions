# Excel Office Add-in Starter Evidence

Excel is a source-level experimental DX adapter target. This note records the
starter-gate and hosted task-pane asset evidence for `hosts/office/dx-excel`;
it is not release readiness.

## Official SDK Evidence

- Excel add-ins overview:
  https://learn.microsoft.com/en-us/office/dev/add-ins/excel/excel-add-ins-overview
- Office add-in manifests:
  https://learn.microsoft.com/en-us/office/dev/add-ins/develop/add-in-manifests
- Office add-in requirements:
  https://learn.microsoft.com/en-us/office/dev/add-ins/concepts/requirements-for-running-office-add-ins
- Manifest validation and troubleshooting:
  https://learn.microsoft.com/en-us/office/dev/add-ins/testing/troubleshoot-manifest

## Manifest Policy

- The first scaffold uses an XML `TaskPaneApp` manifest for Excel workbooks.
- The add-in requests `ReadDocument` only.
- `SourceLocation` and `AppDomain` use an inert HTTPS placeholder until a
  reviewed sideload endpoint exists.
- Localhost, wildcard domains, tunneled public URLs, and HTTP origins are not
  allowed in this source scaffold.

## Runtime Boundary

Excel cannot spawn DX directly. The task pane exchanges typed messages and keeps
status, asset search, and receipt-path actions as plans for a future DX local
service. Source files must not call process spawning APIs, shell wrappers,
Office auth, raw DX commands, or unreviewed network clients.

## Hosted Assets

`scripts/build-office-taskpane-assets.ts` rewrites the source taskpane HTML to
load generated `taskpane.js` and bundles the TypeScript taskpane into ignored
`dist` output. This proves hosted asset shape only; it does not prove
sideloading, live local-service calls, manifest validation with
`office-addin-manifest`, signing, checksum receipts, AppSource approval, or
public release.

`scripts/write-office-package-output-receipts.ts` records a host-free checksum
receipt for the sideload `manifest.xml`, `taskpane.html`, generated
`taskpane.js`, and source map. The receipt is local evidence only and does not
claim sideloaded Excel, signing, AppSource approval, or public release
readiness.

## Deferred Proof

Sideloaded Excel smoke, local-service proof remains deferred, manifest
validation with `office-addin-manifest`, signing, release checksum proof,
AppSource approval remains deferred, and public release proof remains deferred.
