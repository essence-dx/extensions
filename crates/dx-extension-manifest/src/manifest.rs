use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ExtensionManifest {
    pub schema: String,
    pub manifest_version: u32,
    pub extension: ExtensionIdentity,
    pub compatibility: Compatibility,
    pub entrypoint: Entrypoint,
    pub transport: TransportContract,
    pub security: SecurityPolicy,
    #[serde(default)]
    pub capabilities: Vec<Capability>,
    #[serde(default)]
    pub host_actions: Vec<HostAction>,
    #[serde(default)]
    pub receipts: Vec<ReceiptContract>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ExtensionIdentity {
    pub id: String,
    pub name: String,
    pub publisher: String,
    pub version: String,
    pub description: Option<String>,
    pub license: String,
    pub official: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct Compatibility {
    pub dx_min: String,
    #[serde(default)]
    pub hosts: Vec<String>,
    #[serde(default)]
    pub platforms: Vec<String>,
    #[serde(default)]
    pub architectures: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct Entrypoint {
    pub transport: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub cwd: String,
    pub startup_timeout_ms: u64,
    pub shutdown_timeout_ms: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct TransportContract {
    pub protocol: String,
    pub framing: String,
    pub encoding: String,
    pub max_message_bytes: u64,
    pub heartbeat_interval_ms: Option<u64>,
    pub supports_cancel: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct SecurityPolicy {
    pub trust: String,
    pub signature: String,
    pub checksum: Option<String>,
    pub sandbox: String,
    pub network: String,
    pub secrets: String,
    pub redaction: String,
    pub stores_payloads: bool,
    pub stores_process_output: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct Capability {
    pub id: String,
    pub required: bool,
    #[serde(default)]
    pub scope: Vec<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct HostAction {
    pub id: String,
    pub group: String,
    pub label: String,
    pub description: String,
    pub operation: String,
    pub transport: String,
    pub input: String,
    pub output: String,
    pub risk_level: String,
    pub requires_user_approval: bool,
    pub writes_receipts: bool,
    #[serde(default)]
    pub required_capabilities: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ReceiptContract {
    pub id: String,
    pub schema: String,
    pub latest_path: String,
    pub retention_limit: u32,
    pub metadata_only: bool,
}

impl ExtensionManifest {
    pub fn example_for_tests() -> Self {
        Self {
            schema: "dx.extension.manifest".to_string(),
            manifest_version: 1,
            extension: ExtensionIdentity {
                id: "dx.vscode.command-center".to_string(),
                name: "DX VS Code Command Center".to_string(),
                publisher: "DX".to_string(),
                version: "0.1.0".to_string(),
                description: Some("Test manifest".to_string()),
                license: "MIT".to_string(),
                official: true,
            },
            compatibility: Compatibility {
                dx_min: "0.1.0".to_string(),
                hosts: vec!["vscode".to_string()],
                platforms: vec!["windows".to_string()],
                architectures: vec!["x86_64".to_string()],
            },
            entrypoint: Entrypoint {
                transport: "process".to_string(),
                command: "dx".to_string(),
                args: Vec::new(),
                cwd: "${workspace.root}".to_string(),
                startup_timeout_ms: 90_000,
                shutdown_timeout_ms: 2_000,
            },
            transport: TransportContract {
                protocol: "dx-host-action".to_string(),
                framing: "argv".to_string(),
                encoding: "utf8".to_string(),
                max_message_bytes: 1_048_576,
                heartbeat_interval_ms: Some(0),
                supports_cancel: true,
            },
            security: SecurityPolicy {
                trust: "workspace".to_string(),
                signature: "development-unsigned".to_string(),
                checksum: None,
                sandbox: "host-mediated".to_string(),
                network: "deny-by-default".to_string(),
                secrets: "host-mediated".to_string(),
                redaction: "metadata-only".to_string(),
                stores_payloads: false,
                stores_process_output: false,
            },
            capabilities: vec![Capability {
                id: "workspace.read".to_string(),
                required: true,
                scope: vec!["workspace.root".to_string()],
                reason: "Read workspace metadata for command enablement.".to_string(),
            }],
            host_actions: vec![HostAction {
                id: "dx.vscode.show_status".to_string(),
                group: "status".to_string(),
                label: "Show DX Status".to_string(),
                description: "Run the DX status command.".to_string(),
                operation: "dx.status".to_string(),
                transport: "default".to_string(),
                input: "none".to_string(),
                output: "terminal".to_string(),
                risk_level: "low".to_string(),
                requires_user_approval: false,
                writes_receipts: false,
                required_capabilities: vec!["workspace.read".to_string()],
            }],
            receipts: vec![ReceiptContract {
                id: "host-action-index".to_string(),
                schema: "dx.extension.host_action_index".to_string(),
                latest_path:
                    ".dx/receipts/extensions/dx.vscode.command-center/host-action-index-latest.json"
                        .to_string(),
                retention_limit: 20,
                metadata_only: true,
            }],
        }
    }
}
