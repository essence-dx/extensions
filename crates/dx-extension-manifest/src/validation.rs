use std::collections::BTreeSet;

use crate::manifest::ExtensionManifest;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidationError {
    pub field: &'static str,
    pub message: String,
}

pub fn validate_extension_manifest(
    manifest: &ExtensionManifest,
) -> Result<(), Vec<ValidationError>> {
    let mut errors = Vec::new();

    expect_exact(
        &mut errors,
        "schema",
        &manifest.schema,
        "dx.extension.manifest",
    );
    if manifest.manifest_version == 0 {
        errors.push(ValidationError {
            field: "manifest_version",
            message: "manifest version must be at least 1".to_string(),
        });
    }

    expect_non_empty(&mut errors, "extension.id", &manifest.extension.id);
    expect_non_empty(&mut errors, "extension.name", &manifest.extension.name);
    expect_non_empty(
        &mut errors,
        "extension.publisher",
        &manifest.extension.publisher,
    );
    expect_non_empty(
        &mut errors,
        "extension.version",
        &manifest.extension.version,
    );
    expect_non_empty(
        &mut errors,
        "extension.license",
        &manifest.extension.license,
    );
    expect_non_empty(
        &mut errors,
        "compatibility.dx_min",
        &manifest.compatibility.dx_min,
    );
    expect_non_empty_list(
        &mut errors,
        "compatibility.hosts",
        &manifest.compatibility.hosts,
    );
    expect_non_empty_list(
        &mut errors,
        "compatibility.platforms",
        &manifest.compatibility.platforms,
    );
    expect_non_empty_list(
        &mut errors,
        "compatibility.architectures",
        &manifest.compatibility.architectures,
    );
    expect_known(
        &mut errors,
        "entrypoint.transport",
        &manifest.entrypoint.transport,
        &[
            "process",
            "stdio_json_rpc",
            "http",
            "native_messaging",
            "named_pipe",
            "host_script",
        ],
    );
    expect_non_empty(
        &mut errors,
        "entrypoint.command",
        &manifest.entrypoint.command,
    );
    expect_non_empty(&mut errors, "entrypoint.cwd", &manifest.entrypoint.cwd);
    if !manifest.entrypoint.args.is_empty() {
        errors.push(ValidationError {
            field: "entrypoint.args",
            message: "entrypoint args must be empty; host command plans own argv".to_string(),
        });
    }

    expect_non_empty(
        &mut errors,
        "transport.protocol",
        &manifest.transport.protocol,
    );
    expect_non_empty(
        &mut errors,
        "transport.framing",
        &manifest.transport.framing,
    );
    expect_exact(
        &mut errors,
        "transport.encoding",
        &manifest.transport.encoding,
        "utf8",
    );
    expect_non_empty(&mut errors, "security.trust", &manifest.security.trust);
    expect_non_empty(
        &mut errors,
        "security.signature",
        &manifest.security.signature,
    );
    if manifest.security.signature != "development-unsigned"
        && !has_non_empty_checksum(&manifest.security.checksum)
    {
        errors.push(ValidationError {
            field: "security.checksum",
            message: "signed extension manifests require a checksum".to_string(),
        });
    }
    expect_non_empty(&mut errors, "security.sandbox", &manifest.security.sandbox);
    expect_non_empty(&mut errors, "security.network", &manifest.security.network);
    expect_non_empty(&mut errors, "security.secrets", &manifest.security.secrets);
    expect_non_empty(
        &mut errors,
        "security.redaction",
        &manifest.security.redaction,
    );

    if manifest.capabilities.is_empty() {
        errors.push(ValidationError {
            field: "capabilities",
            message: "at least one capability is required".to_string(),
        });
    }

    let mut capability_ids = BTreeSet::new();
    for capability in &manifest.capabilities {
        expect_non_empty(&mut errors, "capabilities.id", &capability.id);
        expect_non_empty_list(&mut errors, "capabilities.scope", &capability.scope);
        expect_non_empty(&mut errors, "capabilities.reason", &capability.reason);

        if !capability_ids.insert(capability.id.clone()) {
            errors.push(ValidationError {
                field: "capabilities",
                message: format!("duplicate capability id: {}", capability.id),
            });
        }
    }

    let capability_ids: BTreeSet<&str> = manifest
        .capabilities
        .iter()
        .map(|capability| capability.id.as_str())
        .collect();
    let mut action_ids = BTreeSet::new();
    for action in &manifest.host_actions {
        expect_non_empty(&mut errors, "host_actions.id", &action.id);
        expect_non_empty(&mut errors, "host_actions.group", &action.group);
        expect_non_empty(&mut errors, "host_actions.label", &action.label);
        expect_non_empty(&mut errors, "host_actions.operation", &action.operation);
        expect_known(
            &mut errors,
            "host_actions.risk_level",
            &action.risk_level,
            &["low", "medium", "high"],
        );

        if !action_ids.insert(action.id.clone()) {
            errors.push(ValidationError {
                field: "host_actions",
                message: format!("duplicate host action id: {}", action.id),
            });
        }

        for required in &action.required_capabilities {
            if !capability_ids.contains(required.as_str()) {
                errors.push(ValidationError {
                    field: "host_actions.required_capabilities",
                    message: format!(
                        "host action {} requires undeclared capability {}",
                        action.id, required
                    ),
                });
            }
        }
    }

    if manifest.receipts.is_empty() {
        errors.push(ValidationError {
            field: "receipts",
            message: "at least one receipt contract is required".to_string(),
        });
    }

    let mut receipt_ids = BTreeSet::new();
    for receipt in &manifest.receipts {
        expect_non_empty(&mut errors, "receipts.id", &receipt.id);
        expect_non_empty(&mut errors, "receipts.schema", &receipt.schema);
        expect_non_empty(&mut errors, "receipts.latest_path", &receipt.latest_path);
        if !is_safe_receipt_latest_path(&manifest.extension.id, &receipt.latest_path) {
            errors.push(ValidationError {
                field: "receipts.latest_path",
                message:
                    "receipt latest_path must stay under .dx/receipts/extensions/{extension.id}/"
                        .to_string(),
            });
        }

        if !receipt.metadata_only {
            errors.push(ValidationError {
                field: "receipts.metadata_only",
                message: "extension receipts must be metadata-only".to_string(),
            });
        }

        if receipt.retention_limit == 0 {
            errors.push(ValidationError {
                field: "receipts.retention_limit",
                message: "retention limit must be at least 1".to_string(),
            });
        }

        if !receipt_ids.insert(receipt.id.clone()) {
            errors.push(ValidationError {
                field: "receipts",
                message: format!("duplicate receipt id: {}", receipt.id),
            });
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

pub fn validate_extension_manifest_for_release_package(
    manifest: &ExtensionManifest,
) -> Result<(), Vec<ValidationError>> {
    let mut errors = validate_extension_manifest(manifest)
        .err()
        .unwrap_or_default();

    if manifest.security.signature == "development-unsigned" {
        errors.push(ValidationError {
            field: "security.signature",
            message: "release packages must not use development-unsigned signatures".to_string(),
        });
    }

    if !has_non_empty_checksum(&manifest.security.checksum) {
        errors.push(ValidationError {
            field: "security.checksum",
            message: "release packages require a checksum".to_string(),
        });
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

fn expect_exact(
    errors: &mut Vec<ValidationError>,
    field: &'static str,
    value: &str,
    expected: &str,
) {
    if value != expected {
        errors.push(ValidationError {
            field,
            message: format!("expected {expected}, found {value}"),
        });
    }
}

fn expect_known(
    errors: &mut Vec<ValidationError>,
    field: &'static str,
    value: &str,
    allowed: &[&str],
) {
    if !allowed.contains(&value) {
        errors.push(ValidationError {
            field,
            message: format!("unsupported value: {value}"),
        });
    }
}

fn expect_non_empty(errors: &mut Vec<ValidationError>, field: &'static str, value: &str) {
    if value.trim().is_empty() {
        errors.push(ValidationError {
            field,
            message: "value must not be empty".to_string(),
        });
    }
}

fn expect_non_empty_list(
    errors: &mut Vec<ValidationError>,
    field: &'static str,
    values: &[String],
) {
    if values.is_empty() || values.iter().any(|value| value.trim().is_empty()) {
        errors.push(ValidationError {
            field,
            message: "list must include only non-empty values".to_string(),
        });
    }
}

fn has_non_empty_checksum(checksum: &Option<String>) -> bool {
    checksum
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
}

fn is_safe_receipt_latest_path(extension_id: &str, latest_path: &str) -> bool {
    let expected_prefix = format!(".dx/receipts/extensions/{extension_id}/");
    let path = latest_path.trim();

    path == latest_path
        && path.starts_with(&expected_prefix)
        && !path.contains('\\')
        && !path.contains("://")
        && !path.starts_with('/')
        && !path.starts_with('~')
        && !is_windows_absolute_path(path)
        && !path
            .split('/')
            .any(|segment| segment.is_empty() || segment == "." || segment == "..")
}

fn is_windows_absolute_path(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':'
}
