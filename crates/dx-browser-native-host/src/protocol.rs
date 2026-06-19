use std::{fmt, io};

use serde::{Deserialize, Serialize};

pub const DX_BROWSER_NATIVE_HOST_PROTOCOL: &str = "dx.browser.native-host";
pub const DX_BROWSER_NATIVE_HOST_VERSION: u32 = 1;
pub const DX_BROWSER_NATIVE_HOST_MAX_MESSAGE_BYTES: u32 = 1_048_576;
pub const DX_BROWSER_EXTENSION_RECEIPT_PATH: &str =
    ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json";

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeHostRequest {
    pub protocol: String,
    pub version: u32,
    pub request_id: String,
    pub host_action_id: String,
    pub operation: String,
    pub command: DxCliCommand,
    pub context: BrowserHostContext,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DxCliCommand {
    pub executable: String,
    pub args: Vec<String>,
}

impl DxCliCommand {
    pub fn new(executable: &str, args: Vec<String>) -> Self {
        Self {
            executable: executable.to_string(),
            args,
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserHostContext {
    pub active_tab_url: Option<String>,
    pub active_tab_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeHostResponse {
    pub protocol: String,
    pub version: u32,
    pub request_id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receipt_path: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum NativeHostError {
    InvalidJson(String),
    Io(String),
    MessageTooLarge { size: u32, max: u32 },
}

impl fmt::Display for NativeHostError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson(message) => write!(formatter, "invalid native-host JSON: {message}"),
            Self::Io(message) => write!(formatter, "native-host I/O failed: {message}"),
            Self::MessageTooLarge { size, max } => {
                write!(
                    formatter,
                    "native-host message is {size} bytes; maximum is {max}"
                )
            }
        }
    }
}

impl std::error::Error for NativeHostError {}

impl From<io::Error> for NativeHostError {
    fn from(error: io::Error) -> Self {
        Self::Io(error.to_string())
    }
}

impl From<serde_json::Error> for NativeHostError {
    fn from(error: serde_json::Error) -> Self {
        Self::InvalidJson(error.to_string())
    }
}
