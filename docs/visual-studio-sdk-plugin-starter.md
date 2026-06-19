# Visual Studio SDK Plugin Starter

Official docs: https://learn.microsoft.com/en-us/visualstudio/extensibility/visual-studio-sdk

`hosts/visual-studio/dx-visual-studio` is a source-level only Visual Studio SDK
VSIX scaffold. It uses a VSIX manifest, project metadata, command declarations,
typed C# command plans, and metadata-only service-boundary records.

`scripts/write-visual-studio-package-output-receipt.ts` records a host-free
checksum receipt for the checked-in VSIX source layout. It proves deterministic
source package files and hashes only; it is not an MSBuild-produced `.vsix`,
Experimental Instance smoke, signing, Marketplace, or distribution proof.

The adapter keeps DX work behind a future `dx-local-service` boundary. It must
not execute process APIs, call live HTTP, write solution files, start builds, or
claim VSIX/Marketplace readiness before Experimental Instance smoke receipts,
package signing, checksums, and local-service proof exist.

Visual Studio Experimental Instance loading, VSIX package signing, checksum
receipts, Marketplace review, DX CLI execution, local-service proof remains deferred,
local-service runtime proof, and loaded-host smoke receipts remain deferred.
