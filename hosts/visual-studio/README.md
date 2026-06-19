# Visual Studio Host Adapters

Visual Studio adapters target the Visual Studio SDK and VSIX packaging model.
They must stay source-level until an Experimental Instance loads the extension
and emits metadata-only receipts.

No adapter in this namespace may execute shell commands, write solution files,
or call DX without the reviewed local-service boundary.
