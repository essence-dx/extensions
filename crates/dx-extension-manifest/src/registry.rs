use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ExtensionRegistry {
    pub schema: String,
    pub manifest_version: u32,
    #[serde(default)]
    pub extensions: Vec<RegistryEntry>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct RegistryEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub manifest: String,
    pub status: String,
    #[serde(default)]
    pub professional_targets: Vec<String>,
}
