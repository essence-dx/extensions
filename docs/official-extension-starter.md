# Official Extension Starter

Official DX extensions are host adapters for trusted first-party surfaces. New
folders must start with registry-first planning and a host-specific evidence
record before code is added under `hosts/`.

Use `registry/professional-host-targets.toml` as the planning catalog before
opening a host-specific starter record. Catalog membership does not create an
official registry entry or release-readiness claim.

## Starter Gate

Before adding a new official extension folder, record:

- Host target, audience, and exact host surface.
- Host SDK and distribution evidence, including the official extension API,
  package format, signing path, and installation or marketplace channel.
- Permission and sandbox model, including requested host permissions, user
  consent, workspace trust, native process access, filesystem access, network
  access, and secret handling.
- DX CLI or local service boundary, including which DX commands or services the
  host may request and how raw shell strings stay out of the host adapter.
- Manifest and registry identity, including the registry entry,
  `professional_targets`, `dx.extension.toml`, host package metadata, host
  action IDs, capabilities, and receipt paths.
- J1 verification, including every local heavy command routed through a guarded
  `j1` wrapper and every Cargo command using `-j 1`.
- Metadata-only receipts for install, smoke, packaging, compatibility, and
  host-action checks.
- Package signing and checksums before any release package is called public or
  installable.
- Loaded-host smoke plan for the target host, with the host application,
  installation steps, command invocation, and expected metadata receipt.

## Creation Order

1. Add or update the professional host target catalog before source work begins.
2. Add or update the registry entry only after the host target has a starter
   record with the evidence above.
3. Add `dx.extension.toml` with a stable official identity and no raw entrypoint
   arguments.
4. Add the host package scaffold with package metadata that matches the DX
   manifest.
5. Add command-plan tests before host dispatch code.
6. Add host package build or smoke scripts only through guarded root `j1`
   wrappers.
7. Update `docs/extension-architecture.md`, `TODO.md`, and `CHANGELOG.md`
   without claiming release readiness.

## Readiness Boundary

Passing this starter gate means the extension proposal is structured enough to
start source work. It does not prove marketplace readiness, loaded-host
execution, public package signing, installed native-host execution, DX
CLI-backed behavior, or plugin ecosystem readiness.

## Proof Vocabulary

- `source-level`: manifest, registry metadata, typed command plans, static UI or
  handlers, and source guards exist.
- `loaded-host`: the real host application loaded the development extension,
  add-in, plugin, app, or script and produced metadata-only receipts.
- `local_service`: a loaded host proved its DX local-service boundary with a
  safe, typed request/response receipt; source request envelopes do not count.
- `cloud_service`: a hosted or deployed service path proved the cloud bridge,
  auth boundary, and test-host request without leaking secrets.
- `manual_import`: a human imported a real content package into the target app
  and recorded metadata-only proof. For Affinity this is manual content import,
  not DX execution inside a native plugin runtime.
- `operator_proof_template`: a JSON input helper for a human proof capture. It
  is not loaded-host, local-service, cloud-service, signing, review,
  marketplace, or release proof until the matching receipt writer validates real
  evidence and writes a mapped receipt.
- `release`: signed/checksummed package artifacts, distribution or marketplace
  evidence, and host-specific install/review proof exist.

Do not convert source-level scaffolds into loaded-host or release claims from
tests, manifests, generated bundles, or native-host process smokes alone.
Every release evidence kind must have an explicit `kind=receipt-path` mapping in
`registry/release-evidence-gates.toml`; compatibility-only flat receipt lists
are not enough to prove an obligation.
