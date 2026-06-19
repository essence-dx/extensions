# Unreal Engine Host Adapters

Unreal adapters target editor-only plugins. They must keep runtime modules,
content plugins, asset import, project mutation, network bridges, and Python or
process bridges deferred until loaded Unreal Editor proof exists.

The first DX adapter is a source-level editor module scaffold with typed command
metadata only.
