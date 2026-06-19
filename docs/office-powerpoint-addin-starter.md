# Office PowerPoint Add-in Starter

This is the source-work evidence record for `hosts/office/dx-powerpoint`.

## Official Evidence

- PowerPoint add-ins overview: https://learn.microsoft.com/en-us/office/dev/add-ins/powerpoint/
- Office Add-ins manifest: https://learn.microsoft.com/en-us/office/dev/add-ins/develop/add-in-manifests
- Host manifest element: https://learn.microsoft.com/en-us/javascript/api/manifest/host
- PowerPoint requirement sets: https://learn.microsoft.com/en-us/javascript/api/requirement-sets/powerpoint/powerpoint-api-requirement-sets
- Add-in commands: https://learn.microsoft.com/en-us/office/dev/add-ins/develop/create-addin-commands
- Manifest validation: https://learn.microsoft.com/en-us/office/dev/add-ins/testing/troubleshoot-manifest
- Office Add-ins privacy and security: https://learn.microsoft.com/en-us/office/dev/add-ins/concepts/privacy-and-security

## Adapter Boundary

PowerPoint Office Add-ins are web add-ins. The DX adapter therefore uses an
add-in-only XML `TaskPaneApp` manifest, a `Presentation` host declaration, a
minimal `PowerPointApi` requirement, and an HTTPS task-pane source placeholder.
It must not spawn DX locally, use native messaging, or request broad document
write permission.

The first approved actions are source-level typed plans only:

- show DX status through a future local-service bridge
- search DX media and icon assets through a future local-service bridge
- copy the DX receipts path through host UI

## Hosted Assets

`scripts/build-office-taskpane-assets.ts` rewrites the source taskpane HTML to
load generated `taskpane.js` and bundles the TypeScript taskpane into ignored
`dist` output. This proves hosted asset shape only; it does not prove
sideloading, live local-service calls, manifest validation, signing, checksum
receipts, AppSource approval, or public release.

`scripts/write-office-package-output-receipts.ts` records a host-free checksum
receipt for the sideload `manifest.xml`, `taskpane.html`, generated
`taskpane.js`, and source map. The receipt is local evidence only and does not
claim sideloaded PowerPoint, signing, AppSource approval, or public release
readiness.

## Deferred Proof

The local-service proof remains deferred. Sideloaded PowerPoint smoke, hosted
task-pane asset runtime proof, manifest validation with `office-addin-manifest`,
signing, release checksum proof, AppSource approval remains deferred, and
public release proof all remain separate gates.
