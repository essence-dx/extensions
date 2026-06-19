# DX Extensions Agent Instructions

This repository owns official DX host-extension contracts and first-party host
adapters.

- Keep host adapters thin. Host code may expose UI and commands, but DX logic
  belongs in the Rust `dx` CLI or a future local DX service.
- Use typed manifests and receipts. Do not scrape terminal prose when a JSON or
  manifest contract can exist.
- Run heavy commands through the root `verify:j1`, `build:j1`, and `test:j1`
  scripts so Cargo and host tooling stay single-job.
- Do not use shell command strings for extension bridges. Pass executable and
  arguments separately.
- Keep files cohesive and small. Split protocol, validation, host commands, and
  transport code by responsibility.
- Do not commit generated bundles, VSIX files, package zips, or dist folders.
