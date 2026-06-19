use std::{
    env,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use crate::protocol::DxCliCommand;

pub const DX_BROWSER_NATIVE_HOST_DX_BIN_ENV: &str = "DX_BROWSER_NATIVE_HOST_DX_BIN";
pub const DX_BROWSER_NATIVE_HOST_WORKING_DIR_ENV: &str = "DX_BROWSER_NATIVE_HOST_WORKING_DIR";
const DEFAULT_DX_BINARY_PATH: &str = r"G:\Dx\bin\dx.exe";
const DEFAULT_DX_WORKING_DIR: &str = r"G:\Dx";
const DEFAULT_DX_TIMEOUT: Duration = Duration::from_secs(45);

#[derive(Debug, Clone)]
pub struct SystemDxCommandRunner {
    binary_path: PathBuf,
    working_dir: PathBuf,
    timeout: Duration,
}

impl SystemDxCommandRunner {
    pub fn from_environment() -> Result<Self, String> {
        let binary_path = env::var_os(DX_BROWSER_NATIVE_HOST_DX_BIN_ENV)
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(DEFAULT_DX_BINARY_PATH));
        let working_dir = env::var_os(DX_BROWSER_NATIVE_HOST_WORKING_DIR_ENV)
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(DEFAULT_DX_WORKING_DIR));

        Self::new(binary_path, working_dir, DEFAULT_DX_TIMEOUT)
    }

    pub fn new(
        binary_path: PathBuf,
        working_dir: PathBuf,
        timeout: Duration,
    ) -> Result<Self, String> {
        validate_dx_binary_path(&binary_path)?;
        validate_working_dir(&working_dir)?;

        Ok(Self {
            binary_path,
            working_dir,
            timeout,
        })
    }

    pub fn run(&self, command: &DxCliCommand) -> Result<(), String> {
        validate_command(command)?;

        let command_label = format_command(command);
        let mut child = Command::new(&self.binary_path)
            .args(&command.args)
            .current_dir(&self.working_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("DX CLI command failed: {command_label}: {error}"))?;

        let started_at = Instant::now();
        loop {
            if let Some(status) = child
                .try_wait()
                .map_err(|error| format!("DX CLI command failed: {command_label}: {error}"))?
            {
                if status.success() {
                    return Ok(());
                }

                return Err(format!("DX CLI command failed: {command_label}"));
            }

            if started_at.elapsed() >= self.timeout {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("DX CLI command timed out: {command_label}"));
            }

            thread::sleep(Duration::from_millis(25));
        }
    }
}

pub fn run_installed_dx_command(command: &DxCliCommand) -> Result<(), String> {
    SystemDxCommandRunner::from_environment()?.run(command)
}

fn validate_dx_binary_path(path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || path.file_name().and_then(|name| name.to_str()) != Some("dx.exe")
        || path.extension().and_then(|extension| extension.to_str()) != Some("exe")
    {
        return Err("DX browser native host must execute an absolute dx.exe binary".to_string());
    }

    if !path.is_file() {
        return Err(format!(
            "DX browser native host dx.exe does not exist: {}",
            path.display()
        ));
    }

    Ok(())
}

fn validate_working_dir(path: &Path) -> Result<(), String> {
    if !path.is_absolute() || !path.is_dir() {
        return Err(format!(
            "DX browser native host working directory is unavailable: {}",
            path.display()
        ));
    }

    Ok(())
}

fn validate_command(command: &DxCliCommand) -> Result<(), String> {
    if command.executable != "dx" {
        return Err("DX browser native host can only execute dx commands".to_string());
    }

    if command.args.is_empty() {
        return Err("DX browser native host command args are required".to_string());
    }

    for arg in &command.args {
        if arg.trim().is_empty() || arg.chars().any(is_shell_control_character) {
            return Err("DX browser native host command args must be shell-free".to_string());
        }
    }

    if !is_allowlisted_command(command) {
        return Err(format!(
            "DX browser native host command is not allowlisted: {}",
            format_command(command)
        ));
    }

    Ok(())
}

fn is_allowlisted_command(command: &DxCliCommand) -> bool {
    matches!(
        command.args.as_slice(),
        [arg] if matches!(arg.as_str(), "status" | "doctor")
    ) || matches!(
        command.args.as_slice(),
        [first, second, third]
            if first == "forge" && second == "packages" && third == "--json"
    ) || matches!(
        command.args.as_slice(),
        [first, second] if first == "graph" && second == "--json"
    )
}

fn is_shell_control_character(character: char) -> bool {
    matches!(character, ';' | '&' | '|' | '<' | '>' | '`' | '$')
}

fn format_command(command: &DxCliCommand) -> String {
    if command.args.is_empty() {
        return command.executable.clone();
    }

    format!("{} {}", command.executable, command.args.join(" "))
}
