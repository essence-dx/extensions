# Unity Editor Plugin Starter

Official docs: https://docs.unity3d.com/Manual/ExtendingTheEditor.html

`hosts/unity/dx-unity-editor` is a source-level only Unity Editor package
scaffold. It uses a Unity package manifest, Editor-only asmdefs, a menu item, an
EditorWindow, typed command plans, and a metadata-only local-service boundary.

`scripts/write-unity-editor-package-output-receipt.ts` records a host-free
checksum receipt for the checked-in UPM source layout. It proves deterministic
package files and hashes only; it is not a loaded Unity Editor smoke, tarball,
signing, Asset Store, or project-import proof.

The adapter keeps DX work behind a future `dx-local-service` boundary. It must
not execute process APIs, call `UnityWebRequest`, import assets, create project
files, trigger builds, mutate scenes, or claim Asset Store readiness before
loaded Unity Editor smoke receipts, package checksums, signing, and
local-service proof exist.

Loaded Unity Editor smoke, local-service proof remains deferred, package
tarball/checksum, signing, Asset Store/distribution review, project
mutation/import proof, and release readiness remain deferred.
