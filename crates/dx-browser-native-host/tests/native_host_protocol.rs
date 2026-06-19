use std::{
    env,
    ffi::OsString,
    fs::{create_dir_all, remove_dir_all, write},
    io::Cursor,
    path::PathBuf,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use dx_browser_native_host::{
    BrowserHostContext, DX_BROWSER_NATIVE_HOST_DX_BIN_ENV, DX_BROWSER_NATIVE_HOST_WORKING_DIR_ENV,
    DxCliCommand, NativeHostError, NativeHostRequest, NativeHostResponse, SystemDxCommandRunner,
    read_native_message, respond_to_request, respond_to_request_with_command_runner,
    write_native_message,
};

static ENVIRONMENT_LOCK: Mutex<()> = Mutex::new(());

fn status_request() -> NativeHostRequest {
    NativeHostRequest {
        protocol: "dx.browser.native-host".to_string(),
        version: 1,
        request_id: "req-status-1".to_string(),
        host_action_id: "dx.browser.show_status".to_string(),
        operation: "dx.status".to_string(),
        command: DxCliCommand::new("dx", vec!["status".to_string()]),
        context: BrowserHostContext {
            active_tab_url: Some("https://example.test/workspace".to_string()),
            active_tab_title: Some("DX Workspace".to_string()),
        },
    }
}

fn forge_packages_request() -> NativeHostRequest {
    NativeHostRequest {
        protocol: "dx.browser.native-host".to_string(),
        version: 1,
        request_id: "req-forge-packages-1".to_string(),
        host_action_id: "dx.browser.list_forge_packages".to_string(),
        operation: "dx.forge.packages.list".to_string(),
        command: DxCliCommand::new(
            "dx",
            vec![
                "forge".to_string(),
                "packages".to_string(),
                "--json".to_string(),
            ],
        ),
        context: BrowserHostContext {
            active_tab_url: Some("https://example.test/forge".to_string()),
            active_tab_title: Some("DX Forge".to_string()),
        },
    }
}

fn build_graph_request() -> NativeHostRequest {
    NativeHostRequest {
        protocol: "dx.browser.native-host".to_string(),
        version: 1,
        request_id: "req-build-graph-1".to_string(),
        host_action_id: "dx.browser.show_build_graph".to_string(),
        operation: "dx.graph.read".to_string(),
        command: DxCliCommand::new("dx", vec!["graph".to_string(), "--json".to_string()]),
        context: BrowserHostContext::default(),
    }
}

#[test]
fn command_must_match_the_declared_operation() {
    let mut request = status_request();
    request.command = DxCliCommand::new("dx", vec!["doctor".to_string()]);

    let response = respond_to_request(request);

    assert!(!response.ok);
    assert_eq!(
        response.error.as_deref(),
        Some("DX browser native-host operation dx.status must use command: dx status")
    );
}

#[test]
fn forge_packages_command_must_match_the_declared_operation() {
    let mut request = forge_packages_request();
    request.command = DxCliCommand::new("dx", vec!["forge".to_string(), "packages".to_string()]);

    let response = respond_to_request(request);

    assert!(!response.ok);
    assert_eq!(
        response.error.as_deref(),
        Some(
            "DX browser native-host operation dx.forge.packages.list must use command: dx forge packages --json"
        )
    );
}

#[test]
fn build_graph_command_must_match_the_declared_operation() {
    let mut request = build_graph_request();
    request.command = DxCliCommand::new("dx", vec!["graph".to_string()]);

    let response = respond_to_request(request);

    assert!(!response.ok);
    assert_eq!(
        response.error.as_deref(),
        Some("DX browser native-host operation dx.graph.read must use command: dx graph --json")
    );
}

#[test]
fn approved_status_request_executes_the_dx_cli_command_before_success() {
    let mut executed_command = None;

    let response = respond_to_request_with_command_runner(status_request(), |command| {
        executed_command = Some(command.clone());
        Ok(())
    });

    assert!(response.ok);
    assert_eq!(
        executed_command,
        Some(DxCliCommand::new("dx", vec!["status".to_string()]))
    );
}

#[test]
fn approved_forge_packages_request_executes_fixed_json_command_before_success() {
    let mut executed_command = None;

    let response = respond_to_request_with_command_runner(forge_packages_request(), |command| {
        executed_command = Some(command.clone());
        Ok(())
    });

    assert!(response.ok);
    assert_eq!(
        executed_command,
        Some(DxCliCommand::new(
            "dx",
            vec![
                "forge".to_string(),
                "packages".to_string(),
                "--json".to_string(),
            ],
        ))
    );
}

#[test]
fn approved_build_graph_request_executes_fixed_json_command_before_success() {
    let mut executed_command = None;

    let response = respond_to_request_with_command_runner(build_graph_request(), |command| {
        executed_command = Some(command.clone());
        Ok(())
    });

    assert!(response.ok);
    assert_eq!(
        executed_command,
        Some(DxCliCommand::new(
            "dx",
            vec!["graph".to_string(), "--json".to_string()],
        ))
    );
}

#[test]
fn approved_request_executes_the_expected_dx_command_not_the_request_owned_instance() {
    let mut request = status_request();
    request.command = DxCliCommand::new("dx", vec!["status".to_string()]);
    let mut executed_command = None;

    let response = respond_to_request_with_command_runner(request, |command| {
        executed_command = Some(command.clone());
        Ok(())
    });

    assert!(response.ok);
    assert_eq!(
        executed_command,
        Some(DxCliCommand::new("dx", vec!["status".to_string()]))
    );
}

#[test]
fn command_runner_failure_returns_typed_error_response_without_receipt() {
    let response = respond_to_request_with_command_runner(status_request(), |_command| {
        Err("DX CLI command failed: dx status".to_string())
    });

    assert!(!response.ok);
    assert_eq!(
        response.error.as_deref(),
        Some("DX CLI command failed: dx status")
    );
    assert!(response.receipt_path.is_none());
}

#[test]
fn system_runner_rejects_dx_powershell_wrapper() {
    let error = SystemDxCommandRunner::new(
        PathBuf::from(r"G:\Dx\cli\dx.ps1"),
        PathBuf::from(r"G:\Dx"),
        Duration::from_secs(1),
    )
    .expect_err("PowerShell wrapper must be rejected");

    assert_eq!(
        error,
        "DX browser native host must execute an absolute dx.exe binary"
    );
}

#[test]
fn system_runner_rejects_relative_dx_binary_path() {
    let error = SystemDxCommandRunner::new(
        PathBuf::from("dx.exe"),
        PathBuf::from(r"G:\Dx"),
        Duration::from_secs(1),
    )
    .expect_err("relative dx.exe path must be rejected");

    assert_eq!(
        error,
        "DX browser native host must execute an absolute dx.exe binary"
    );
}

#[test]
fn system_runner_rejects_relative_working_directory() {
    let fixture = temporary_dx_binary_fixture("relative-working-directory");
    let error = SystemDxCommandRunner::new(
        fixture.binary_path.clone(),
        PathBuf::from("workspace"),
        Duration::from_secs(1),
    )
    .expect_err("relative working directory must be rejected");

    assert_eq!(
        error,
        "DX browser native host working directory is unavailable: workspace"
    );
}

#[test]
fn system_runner_rejects_missing_working_directory() {
    let fixture = temporary_dx_binary_fixture("missing-working-directory");
    let missing_working_dir = fixture.root.join("missing-workspace");
    let error = SystemDxCommandRunner::new(
        fixture.binary_path.clone(),
        missing_working_dir.clone(),
        Duration::from_secs(1),
    )
    .expect_err("missing working directory must be rejected");

    assert_eq!(
        error,
        format!(
            "DX browser native host working directory is unavailable: {}",
            missing_working_dir.display()
        )
    );
}

#[test]
fn system_runner_from_environment_rejects_missing_working_directory_env() {
    let _guard = ENVIRONMENT_LOCK.lock().expect("environment lock");
    let fixture = temporary_dx_binary_fixture("missing-working-directory-env");
    let missing_working_dir = fixture.root.join("missing-env-workspace");
    let previous_binary_path = env::var_os(DX_BROWSER_NATIVE_HOST_DX_BIN_ENV);
    let previous_working_dir = env::var_os(DX_BROWSER_NATIVE_HOST_WORKING_DIR_ENV);

    set_env_var(
        DX_BROWSER_NATIVE_HOST_DX_BIN_ENV,
        fixture.binary_path.as_os_str(),
    );
    set_env_var(
        DX_BROWSER_NATIVE_HOST_WORKING_DIR_ENV,
        missing_working_dir.as_os_str(),
    );
    let result = SystemDxCommandRunner::from_environment();
    restore_env_var(DX_BROWSER_NATIVE_HOST_DX_BIN_ENV, previous_binary_path);
    restore_env_var(DX_BROWSER_NATIVE_HOST_WORKING_DIR_ENV, previous_working_dir);

    let error = result.expect_err("missing env working directory must be rejected");
    assert_eq!(
        error,
        format!(
            "DX browser native host working directory is unavailable: {}",
            missing_working_dir.display()
        )
    );
}

#[test]
fn system_runner_rejects_unapproved_dx_command_args() {
    let fixture = temporary_dx_binary_fixture("unapproved-command");
    let runner = SystemDxCommandRunner::new(
        fixture.binary_path.clone(),
        fixture.working_dir.clone(),
        Duration::from_secs(1),
    )
    .expect("test dx.exe runner");

    let error = runner
        .run(&DxCliCommand::new("dx", vec!["build".to_string()]))
        .expect_err("dx build must not be allowed from the browser native host");

    assert_eq!(
        error,
        "DX browser native host command is not allowlisted: dx build"
    );
}

#[test]
fn system_runner_rejects_near_miss_json_read_command_args() {
    let fixture = temporary_dx_binary_fixture("near-miss-json-read-command");
    let runner = SystemDxCommandRunner::new(
        fixture.binary_path.clone(),
        fixture.working_dir.clone(),
        Duration::from_secs(1),
    )
    .expect("test dx.exe runner");

    let error = runner
        .run(&DxCliCommand::new(
            "dx",
            vec!["forge".to_string(), "packages".to_string()],
        ))
        .expect_err("near-miss forge package list must not be allowed");

    assert_eq!(
        error,
        "DX browser native host command is not allowlisted: dx forge packages"
    );
}

#[test]
fn native_message_round_trip_uses_little_endian_length_prefix() {
    let body = br#"{"protocol":"dx.browser.native-host","version":1}"#;
    let mut output = Vec::new();

    write_native_message(&mut output, body).expect("message written");

    assert_eq!(&output[..4], &(body.len() as u32).to_le_bytes());
    assert_eq!(&output[4..], body);

    let decoded = read_native_message(&mut Cursor::new(output), 1024)
        .expect("message read")
        .expect("message present");
    assert_eq!(decoded, body);
}

#[test]
fn oversized_native_message_is_rejected_before_allocation() {
    let mut input = Cursor::new((1025_u32).to_le_bytes().to_vec());

    let error = read_native_message(&mut input, 1024).expect_err("oversized rejected");

    assert_eq!(
        error,
        NativeHostError::MessageTooLarge {
            size: 1025,
            max: 1024
        }
    );
}

#[test]
fn status_request_returns_typed_success_response_without_payloads() {
    let response = respond_to_request_with_command_runner(status_request(), |_command| Ok(()));

    assert_eq!(
        response,
        NativeHostResponse {
            protocol: "dx.browser.native-host".to_string(),
            version: 1,
            request_id: "req-status-1".to_string(),
            ok: true,
            error: None,
            receipt_path: Some(
                ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
                    .to_string(),
            ),
        }
    );
}

#[test]
fn json_read_requests_return_typed_success_response_without_payloads() {
    let forge_response =
        respond_to_request_with_command_runner(forge_packages_request(), |_command| Ok(()));
    let graph_response =
        respond_to_request_with_command_runner(build_graph_request(), |_command| Ok(()));

    assert_eq!(
        forge_response,
        NativeHostResponse {
            protocol: "dx.browser.native-host".to_string(),
            version: 1,
            request_id: "req-forge-packages-1".to_string(),
            ok: true,
            error: None,
            receipt_path: Some(
                ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
                    .to_string(),
            ),
        }
    );
    assert_eq!(
        graph_response,
        NativeHostResponse {
            protocol: "dx.browser.native-host".to_string(),
            version: 1,
            request_id: "req-build-graph-1".to_string(),
            ok: true,
            error: None,
            receipt_path: Some(
                ".dx/receipts/extensions/dx.browser.command-center/host-action-index-latest.json"
                    .to_string(),
            ),
        }
    );
}

#[test]
fn unsupported_operation_returns_typed_error_response() {
    let mut request = status_request();
    request.operation = "workspace.delete".to_string();

    let response = respond_to_request(request);

    assert_eq!(response.protocol, "dx.browser.native-host");
    assert_eq!(response.version, 1);
    assert_eq!(response.request_id, "req-status-1");
    assert!(!response.ok);
    assert_eq!(
        response.error.as_deref(),
        Some("Unsupported DX browser native-host operation: workspace.delete")
    );
    assert!(response.receipt_path.is_none());
}

#[test]
fn operation_must_match_the_declared_host_action() {
    let mut request = status_request();
    request.host_action_id = "dx.browser.run_doctor".to_string();

    let response = respond_to_request(request);

    assert!(!response.ok);
    assert_eq!(
        response.error.as_deref(),
        Some("DX browser native-host action dx.browser.run_doctor cannot run operation dx.status")
    );
}

struct TemporaryDxBinaryFixture {
    root: PathBuf,
    binary_path: PathBuf,
    working_dir: PathBuf,
}

impl Drop for TemporaryDxBinaryFixture {
    fn drop(&mut self) {
        let _ = remove_dir_all(&self.root);
    }
}

fn temporary_dx_binary_fixture(name: &str) -> TemporaryDxBinaryFixture {
    let unique_id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock after Unix epoch")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("dx-browser-native-host-{name}-{unique_id}"));
    let working_dir = root.join("workspace");
    let binary_path = root.join("bin").join("dx.exe");

    create_dir_all(&working_dir).expect("temporary working directory created");
    create_dir_all(binary_path.parent().expect("temporary binary directory"))
        .expect("temporary binary directory created");
    write(&binary_path, b"test dx executable").expect("temporary dx.exe created");

    TemporaryDxBinaryFixture {
        root,
        binary_path,
        working_dir,
    }
}

fn set_env_var(key: &str, value: &std::ffi::OsStr) {
    unsafe {
        env::set_var(key, value);
    }
}

fn restore_env_var(key: &str, value: Option<OsString>) {
    unsafe {
        match value {
            Some(value) => env::set_var(key, value),
            None => env::remove_var(key),
        }
    }
}
