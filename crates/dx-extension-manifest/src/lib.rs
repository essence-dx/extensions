pub mod manifest;
pub mod registry;
pub mod validation;

pub use manifest::{
    Capability, Compatibility, Entrypoint, ExtensionIdentity, ExtensionManifest, HostAction,
    ReceiptContract, SecurityPolicy, TransportContract,
};
pub use registry::{ExtensionRegistry, RegistryEntry};
pub use validation::{
    ValidationError, validate_extension_manifest, validate_extension_manifest_for_release_package,
};

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use crate::{
        Capability, ExtensionManifest, registry::ExtensionRegistry, validate_extension_manifest,
        validate_extension_manifest_for_release_package,
    };

    fn workspace_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
    }

    #[test]
    fn vscode_manifest_is_valid() {
        let manifest_path = workspace_root()
            .join("hosts")
            .join("vscode")
            .join("dx-vscode")
            .join("dx.extension.toml");
        let source = std::fs::read_to_string(manifest_path).expect("manifest source");
        let manifest: ExtensionManifest = toml::from_str(&source).expect("manifest toml");

        validate_extension_manifest(&manifest).expect("valid manifest");
        assert_eq!(manifest.extension.id, "dx.vscode.command-center");
        assert!(
            manifest
                .compatibility
                .hosts
                .iter()
                .any(|host| host == "vscode")
        );
    }

    #[test]
    fn browser_manifest_is_valid() {
        let manifest_path = workspace_root()
            .join("hosts")
            .join("browser")
            .join("dx-browser")
            .join("dx.extension.toml");
        let source = std::fs::read_to_string(manifest_path).expect("manifest source");
        let manifest: ExtensionManifest = toml::from_str(&source).expect("manifest toml");

        validate_extension_manifest(&manifest).expect("valid manifest");
        assert_eq!(manifest.extension.id, "dx.browser.command-center");
        assert_eq!(manifest.entrypoint.transport, "native_messaging");
        assert!(
            manifest
                .capabilities
                .iter()
                .any(|capability| capability.id == "nativeMessaging.dx")
        );
    }

    #[test]
    fn registry_contains_vscode_manifest() {
        let registry_path = workspace_root()
            .join("registry")
            .join("official-extensions.toml");
        let source = std::fs::read_to_string(registry_path).expect("registry source");
        let registry: ExtensionRegistry = toml::from_str(&source).expect("registry toml");

        assert!(
            registry
                .extensions
                .iter()
                .any(|entry| entry.id == "dx.vscode.command-center"
                    && entry.manifest == "hosts/vscode/dx-vscode/dx.extension.toml")
        );
    }

    #[test]
    fn registry_contains_browser_manifest() {
        let registry_path = workspace_root()
            .join("registry")
            .join("official-extensions.toml");
        let source = std::fs::read_to_string(registry_path).expect("registry source");
        let registry: ExtensionRegistry = toml::from_str(&source).expect("registry toml");

        assert!(
            registry
                .extensions
                .iter()
                .any(|entry| entry.id == "dx.browser.command-center"
                    && entry.manifest == "hosts/browser/dx-browser/dx.extension.toml")
        );
    }

    #[test]
    fn validation_rejects_duplicate_capabilities() {
        let mut manifest = ExtensionManifest::example_for_tests();
        manifest.capabilities.push(Capability {
            id: "workspace.read".to_string(),
            required: true,
            scope: vec!["workspace.root".to_string()],
            reason: "Duplicate capability".to_string(),
        });

        let errors = validate_extension_manifest(&manifest).expect_err("duplicate rejected");
        assert!(errors.iter().any(|error| error.field == "capabilities"));
    }

    #[test]
    fn validation_rejects_missing_receipts() {
        let mut manifest = ExtensionManifest::example_for_tests();
        manifest.receipts.clear();

        let errors = validate_extension_manifest(&manifest).expect_err("receipts required");
        assert!(errors.iter().any(|error| error.field == "receipts"));
    }

    #[test]
    fn validation_rejects_entrypoint_args() {
        let mut manifest = ExtensionManifest::example_for_tests();
        manifest.entrypoint.args = vec!["doctor".to_string()];

        let errors = validate_extension_manifest(&manifest).expect_err("entrypoint args rejected");
        assert!(errors.iter().any(|error| error.field == "entrypoint.args"));
    }

    #[test]
    fn validation_accepts_host_script_transport() {
        let mut manifest = ExtensionManifest::example_for_tests();
        manifest.entrypoint.transport = "host_script".to_string();
        manifest.entrypoint.command = "resolve-scripting".to_string();

        validate_extension_manifest(&manifest).expect("host_script transport should be valid");
    }

    #[test]
    fn validation_rejects_unsafe_receipt_paths() {
        for latest_path in [
            "C:/Users/Computer/.dx/receipts/extensions/dx.vscode.command-center/latest.json",
            "https://example.test/receipt.json",
            ".dx\\receipts\\extensions\\dx.vscode.command-center\\latest.json",
            ".dx/receipts/extensions/dx.vscode.command-center/../secret.json",
            ".dx/receipts/extensions/other.extension/latest.json",
        ] {
            let mut manifest = ExtensionManifest::example_for_tests();
            manifest.receipts[0].latest_path = latest_path.to_string();

            let errors =
                validate_extension_manifest(&manifest).expect_err("unsafe receipt path rejected");
            assert!(
                errors
                    .iter()
                    .any(|error| error.field == "receipts.latest_path"),
                "expected receipts.latest_path error for {latest_path}"
            );
        }
    }

    #[test]
    fn validation_rejects_non_metadata_receipts() {
        let mut manifest = ExtensionManifest::example_for_tests();
        manifest.receipts[0].metadata_only = false;

        let errors =
            validate_extension_manifest(&manifest).expect_err("non-metadata receipt rejected");
        assert!(
            errors
                .iter()
                .any(|error| error.field == "receipts.metadata_only")
        );
    }

    #[test]
    fn validation_requires_checksum_for_signed_release_signature() {
        let mut manifest = ExtensionManifest::example_for_tests();
        manifest.security.signature = "sigstore-bundle".to_string();

        let errors = validate_extension_manifest(&manifest).expect_err("checksum required");
        assert!(
            errors
                .iter()
                .any(|error| error.field == "security.checksum")
        );
    }

    #[test]
    fn release_validation_rejects_unsigned_package_policy() {
        let manifest = ExtensionManifest::example_for_tests();

        let errors = validate_extension_manifest_for_release_package(&manifest)
            .expect_err("unsigned release package rejected");
        assert!(
            errors
                .iter()
                .any(|error| error.field == "security.signature")
        );
    }
}
