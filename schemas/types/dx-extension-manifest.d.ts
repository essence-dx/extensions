/*
 * Generated from schemas/dx.extension.manifest.schema.json.
 * Run `npm run generate:manifest-types` after editing the schema.
 */

export interface DxExtensionIdentity {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description?: string;
  license: string;
  official: boolean;
}

export interface DxExtensionCompatibility {
  dx_min: string;
  hosts: string[];
  platforms: string[];
  architectures: string[];
}

export interface DxExtensionEntrypoint {
  transport: "process" | "stdio_json_rpc" | "http" | "native_messaging" | "named_pipe" | "host_script";
  command: string;
  args: string[];
  cwd: string;
  startup_timeout_ms: number;
  shutdown_timeout_ms: number;
}

export interface DxExtensionTransportContract {
  protocol: string;
  framing: string;
  encoding: "utf8";
  max_message_bytes: number;
  heartbeat_interval_ms?: number;
  supports_cancel: boolean;
}

export interface DxExtensionSecurityPolicy {
  trust: string;
  signature: string;
  checksum?: string;
  sandbox: string;
  network: string;
  secrets: string;
  redaction: string;
  stores_payloads: boolean;
  stores_process_output: boolean;
}

export interface DxExtensionCapability {
  id: string;
  required: boolean;
  scope: string[];
  reason: string;
}

export interface DxExtensionHostAction {
  id: string;
  group: string;
  label: string;
  description: string;
  operation: string;
  transport: string;
  input: string;
  output: string;
  risk_level: "low" | "medium" | "high";
  requires_user_approval: boolean;
  writes_receipts: boolean;
  required_capabilities: string[];
}

export interface DxExtensionReceiptContract {
  id: string;
  schema: string;
  latest_path: string;
  retention_limit: number;
  metadata_only: boolean;
}

export interface DxExtensionManifest {
  schema: "dx.extension.manifest";
  manifest_version: number;
  extension: DxExtensionIdentity;
  compatibility: DxExtensionCompatibility;
  entrypoint: DxExtensionEntrypoint;
  transport: DxExtensionTransportContract;
  security: DxExtensionSecurityPolicy;
  capabilities: DxExtensionCapability[];
  host_actions: DxExtensionHostAction[];
  receipts: DxExtensionReceiptContract[];
}
