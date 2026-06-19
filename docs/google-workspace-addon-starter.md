# Google Workspace Add-on Starter

Official docs: https://developers.google.com/workspace/add-ons/overview

`hosts/google-workspace/dx-google-workspace-addon` is a source-level only
Google Workspace Apps Script add-on scaffold. It uses `appsscript.json`, a
homepage trigger, typed action messages, card models, and a metadata-only
cloud-service request boundary.

Google Workspace cannot use a local DX process directly. The adapter must use an
OAuth-reviewed cloud-service bridge, request least-privilege scopes only, avoid
document content access, and keep Apps Script deployment, OAuth consent,
Marketplace review, and loaded Workspace file smoke receipts deferred until
those proofs exist.

Apps Script deployment, OAuth consent/review, Marketplace review, loaded
Docs/Sheets/Slides/Gmail smoke, cloud-service proof remains deferred, signing,
checksum, and public release proof remain deferred.

`scripts/write-google-workspace-apps-script-package-output-receipt.ts` records
a host-free checksum receipt for generated `appsscript.json` and `Code.gs`.
The receipt is local evidence only and does not claim Apps Script deployment,
OAuth review, cloud-service proof, Marketplace review, signing, or public
release readiness.
