# Unity Host Adapters

Unity adapters target Editor-only extensions. They must keep runtime/player
assemblies, asset imports, build pipeline hooks, and project mutation deferred
until loaded Unity Editor proof exists.

The first DX adapter is a source-level Editor package scaffold with menu/window
registration and typed command-plan metadata only.
