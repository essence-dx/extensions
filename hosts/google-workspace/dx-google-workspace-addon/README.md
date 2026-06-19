# DX Google Workspace Command Center

Source-level only Google Workspace Add-on scaffold. Apps Script deployment,
OAuth consent/review, Marketplace readiness remains deferred, Marketplace
review, test Workspace file smoke, loaded Docs/Sheets/Slides/Gmail smoke,
cloud-service proof remains deferred, signing, checksum, and public release
proof remain deferred.

The scaffold uses a minimal Apps Script manifest, card builders, typed command
plans, and a metadata-only cloud-service request envelope. It requests no broad
Gmail, Drive, Docs, Sheets, Slides, Calendar, or external request scopes.

The guarded package-output receipt hashes generated `appsscript.json` and
`Code.gs` without claiming Apps Script deployment, OAuth review, cloud-service
runtime proof, Marketplace review, signing, release checksum proof, or public
release readiness.
