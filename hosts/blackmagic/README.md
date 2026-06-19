# DX Blackmagic Adapter Boundary

DaVinci Resolve scripting can expose Python and Lua workflow surfaces, but DX
adapters must keep Resolve project state safe until loaded-host proof exists.

Source-level Resolve adapters may describe DX status, project inspection intent,
and receipt metadata. They must not render projects, must not mutate timelines,
must not change media pools, must not open local network scripting, and must not
claim Workflow Integration or installed-host readiness without metadata-only
receipts from a reviewed Resolve setup.
