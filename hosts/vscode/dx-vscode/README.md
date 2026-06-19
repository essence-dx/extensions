# DX Command Center

DX Command Center is the official VS Code host bridge for DX tools. It exposes
DX status, diagnostics, icon search, Forge package reads, build graph reads, and
receipt actions through the VS Code command palette.

## Commands

- `DX: Open Command Center`
- `DX: Show Status`
- `DX: Run Doctor`
- `DX: Search Icons`
- `DX: List Forge Packages`
- `DX: Show Build Graph`
- `DX: Show Latest Check Receipt`
- `DX: Show Check Editor State`
- `DX: Open Receipts Folder`
- `DX: Copy Receipts Path`

## Safety

DX CLI execution requires workspace trust. Command arguments are fixed by typed
command plans before they reach the local DX CLI bridge, and host UI actions for
receipts do not run through the CLI.

Configure `dx.cliPath` only when the installed DX executable is not available on
`PATH`.
