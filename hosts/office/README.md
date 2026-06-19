# DX Office Adapter Boundary

Office Add-ins are web add-ins, not native plugins. DX Office adapters must use
task panes, commands, dialogs, and reviewed service boundaries instead of direct
local process access.

Shared Office code should stay thin. Excel, PowerPoint, and Word can share
manifest policy, typed task-pane messages, and local-service transport rules,
but each host owns its app-specific APIs and document safety checks.

`hosts/office/shared/localServiceBoundary.ts` owns the typed request envelope
for future DX local-service calls. It normalizes host context and rejects
host-UI receipt actions so task panes cannot accidentally treat clipboard-only
work as a privileged service request. Keep that context coarse: do not pass raw
workbook names, document URLs, tenant URLs, local file paths, or document text
through this boundary.

Office adapters must not spawn local processes, pass raw argv, request broad
document permissions, or claim AppSource/public readiness without sideload,
signing, checksum, and loaded-host smoke receipts.

`scripts/build-office-sideload-manifests.ts` may emit ignored
`dist/manifest.xml` files for local sideload proof. The source manifests keep
the inert DX Office placeholder origin; the build output must replace it with a
caller-provided HTTPS origin and preserve read-only permissions.

Excel owns workbook behavior, PowerPoint owns presentation behavior, and Word owns document behavior.
Keep that split visible instead of turning this folder into a generic Office
framework.

`hosts/office/dx-word` owns document behavior: document text, selections,
comments, styles, citations, and safety checks must stay Word-specific. Shared
Office code may cover manifest policy, task-pane message envelopes, receipt
metadata, and local-service transport rules only.
