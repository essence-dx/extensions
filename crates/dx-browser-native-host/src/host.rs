use std::io::{Read, Write};

use crate::{
    command::run_installed_dx_command,
    protocol::{
        DX_BROWSER_EXTENSION_RECEIPT_PATH, DX_BROWSER_NATIVE_HOST_MAX_MESSAGE_BYTES,
        DX_BROWSER_NATIVE_HOST_PROTOCOL, DX_BROWSER_NATIVE_HOST_VERSION, DxCliCommand,
        NativeHostError, NativeHostRequest, NativeHostResponse,
    },
    read_native_message, write_native_message,
};

pub fn run_native_host<R: Read, W: Write>(
    reader: &mut R,
    writer: &mut W,
) -> Result<(), NativeHostError> {
    let Some(message) = read_native_message(reader, DX_BROWSER_NATIVE_HOST_MAX_MESSAGE_BYTES)?
    else {
        return Ok(());
    };

    let response = handle_native_message(&message)?;
    let body = serde_json::to_vec(&response)?;
    write_native_message(writer, &body)?;
    Ok(())
}

pub fn handle_native_message(body: &[u8]) -> Result<NativeHostResponse, NativeHostError> {
    let request: NativeHostRequest = serde_json::from_slice(body)?;
    Ok(respond_to_request(request))
}

pub fn respond_to_request(request: NativeHostRequest) -> NativeHostResponse {
    respond_to_request_with_command_runner(request, run_installed_dx_command)
}

pub fn respond_to_request_with_command_runner<F>(
    request: NativeHostRequest,
    run_command: F,
) -> NativeHostResponse
where
    F: FnOnce(&DxCliCommand) -> Result<(), String>,
{
    if request.protocol != DX_BROWSER_NATIVE_HOST_PROTOCOL {
        return error_response(
            request.request_id,
            format!(
                "Unsupported DX browser native-host protocol: {}",
                request.protocol
            ),
        );
    }

    if request.version != DX_BROWSER_NATIVE_HOST_VERSION {
        return error_response(
            request.request_id,
            format!(
                "Unsupported DX browser native-host protocol version: {}",
                request.version
            ),
        );
    }

    if !is_supported_operation(&request.operation) {
        return error_response(
            request.request_id,
            format!(
                "Unsupported DX browser native-host operation: {}",
                request.operation
            ),
        );
    }

    if !is_allowed_action_operation(&request.host_action_id, &request.operation) {
        return error_response(
            request.request_id,
            format!(
                "DX browser native-host action {} cannot run operation {}",
                request.host_action_id, request.operation
            ),
        );
    }

    let command = match validate_dx_cli_command(&request.operation, &request.command) {
        Ok(command) => command,
        Err(error) => return error_response(request.request_id, error),
    };

    if let Err(error) = run_command(&command) {
        return error_response(request.request_id, error);
    }

    success_response(request.request_id)
}

fn is_supported_operation(operation: &str) -> bool {
    matches!(
        operation,
        "dx.status" | "dx.doctor" | "dx.forge.packages.list" | "dx.graph.read"
    )
}

fn is_allowed_action_operation(host_action_id: &str, operation: &str) -> bool {
    matches!(
        (host_action_id, operation),
        ("dx.browser.show_status", "dx.status")
            | ("dx.browser.run_doctor", "dx.doctor")
            | ("dx.browser.list_forge_packages", "dx.forge.packages.list")
            | ("dx.browser.show_build_graph", "dx.graph.read")
    )
}

fn validate_dx_cli_command(
    operation: &str,
    command: &DxCliCommand,
) -> Result<DxCliCommand, String> {
    let expected = expected_dx_cli_command(operation)
        .ok_or_else(|| format!("Unsupported DX browser native-host operation: {operation}"))?;

    if command != &expected {
        return Err(format!(
            "DX browser native-host operation {operation} must use command: {} {}",
            expected.executable,
            expected.args.join(" ")
        ));
    }

    Ok(expected)
}

fn expected_dx_cli_command(operation: &str) -> Option<DxCliCommand> {
    match operation {
        "dx.status" => Some(DxCliCommand::new("dx", vec!["status".to_string()])),
        "dx.doctor" => Some(DxCliCommand::new("dx", vec!["doctor".to_string()])),
        "dx.forge.packages.list" => Some(DxCliCommand::new(
            "dx",
            vec![
                "forge".to_string(),
                "packages".to_string(),
                "--json".to_string(),
            ],
        )),
        "dx.graph.read" => Some(DxCliCommand::new(
            "dx",
            vec!["graph".to_string(), "--json".to_string()],
        )),
        _ => None,
    }
}

fn success_response(request_id: String) -> NativeHostResponse {
    NativeHostResponse {
        protocol: DX_BROWSER_NATIVE_HOST_PROTOCOL.to_string(),
        version: DX_BROWSER_NATIVE_HOST_VERSION,
        request_id,
        ok: true,
        error: None,
        receipt_path: Some(DX_BROWSER_EXTENSION_RECEIPT_PATH.to_string()),
    }
}

fn error_response(request_id: String, error: String) -> NativeHostResponse {
    NativeHostResponse {
        protocol: DX_BROWSER_NATIVE_HOST_PROTOCOL.to_string(),
        version: DX_BROWSER_NATIVE_HOST_VERSION,
        request_id,
        ok: false,
        error: Some(error),
        receipt_path: None,
    }
}
