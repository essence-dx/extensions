# DX Sketch Adapter Boundary

Sketch plugins are host-managed command bundles, not native DX process
launchers. DX Sketch adapters must use Sketch menu commands and reviewed service
boundaries instead of direct local process access.

Sketch owns document, layer, artboard, and symbol behavior. Source-level Sketch
adapters may expose DX status, asset search intent, document-safe metadata
intent, and receipt metadata, but they must not launch local processes, request
broad network or filesystem access, mutate documents, layers, artboards, or
symbols, or claim plugin listing readiness without loaded-host smoke, package,
signing, checksum, notarization, and listing receipts.
