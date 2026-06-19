# DX Adobe Adapter Boundary

Adobe UXP plugins are sandboxed Creative Cloud plugin surfaces, not native DX
process launchers. DX Adobe adapters must use panels, commands, and reviewed
service boundaries instead of direct local process access.

The guarded Adobe package-output receipts may hash ignored `dist` package
layouts for local evidence. They are not `.ccx` package, signing, release
checksum, Creative Cloud review, or loaded-host receipts.

Receipt path actions are host-UI metadata actions and require loaded-host proof
before they can be claimed. Status and search actions remain local-service
runtime proof gates until the reviewed DX service boundary exists.

Photoshop owns document behavior. Premiere Pro owns timeline and project
behavior. InDesign owns document, page, and typography behavior. Source-level
Adobe adapters may expose DX status, asset search intent, project-safe or
document-safe metadata intent, and receipt metadata, but they must not launch local processes, request broad network or filesystem permissions, mutate
documents, pages, typography, or timelines, or claim Creative Cloud distribution
readiness without loaded-host smoke, signing, checksum, package, and review
receipts.
