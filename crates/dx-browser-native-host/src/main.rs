use std::collections::HashMap;
use std::path::PathBuf;

pub struct ExtensionsDxConfig {
    pub workspace_root: PathBuf,
    pub sr_dir: PathBuf,
    pub receipts_dir: PathBuf,
}

impl ExtensionsDxConfig {
    pub fn load() -> Self {
        let raw = load_raw_config();
        let ws = raw.unwrap_or_else(|| PathBuf::from("."));
        let ws = if ws.is_relative() {
            std::env::current_dir().unwrap_or_default().join(&ws)
        } else {
            ws
        };
        let sr = ws.join(".dx").join("serializer");
        let receipts = ws.join(".dx").join("receipts").join("extensions");
        Self { workspace_root: ws, sr_dir: sr, receipts_dir: receipts }
    }

    pub fn ensure_dirs(&self) {
        let _ = std::fs::create_dir_all(&self.sr_dir);
        let _ = std::fs::create_dir_all(&self.receipts_dir);
    }

    pub fn sr_path(&self, name: &str) -> PathBuf {
        self.sr_dir.join(format!("{name}.sr"))
    }

    pub fn write_sr(&self, name: &str, entries: &[(&str, &str)]) -> std::io::Result<()> {
        let path = self.sr_path(name);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut buf: Vec<u8> = Vec::new();
        for (key, value) in entries {
            write!(buf, "{key}=")?;
            write_llm_value(&mut buf, value)?;
            buf.push(b'\n');
        }
        let tmp = path.with_extension("sr.tmp");
        std::fs::write(&tmp, &buf)?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }

    pub fn read_status(&self, name: &str) -> Option<HashMap<String, String>> {
        let path = self.sr_path(name);
        let source = std::fs::read_to_string(&path).ok()?;
        let mut map = HashMap::new();
        for line in source.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                map.insert(k.trim().to_string(), v.trim().to_string());
            }
        }
        Some(map)
    }
}

fn write_llm_value(buf: &mut Vec<u8>, value: &str) -> std::io::Result<()> {
    if value.is_empty() {
        buf.push(b'"');
        buf.push(b'"');
        return Ok(());
    }
    let needs_quoting = value.contains('"')
        || value.contains('\\')
        || value.contains('\n')
        || value.contains('\r')
        || value.starts_with('"')
        || value.contains(' ')
        || value.contains('\t')
        || value.contains('#');
    if needs_quoting {
        buf.push(b'"');
        for ch in value.chars() {
            match ch {
                '"' | '\\' => {
                    buf.push(b'\\');
                    buf.push(ch as u8);
                }
                '\n' => buf.extend_from_slice(b"\\n"),
                '\r' => buf.extend_from_slice(b"\\r"),
                '\t' => buf.extend_from_slice(b"\\t"),
                _ => buf.extend(ch.encode_utf8(&mut [0; 4]).as_bytes()),
            }
        }
        buf.push(b'"');
    } else {
        buf.extend_from_slice(value.as_bytes());
    }
    Ok(())
}

fn load_raw_config() -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    for ancestor in cwd.ancestors() {
        let candidate = ancestor.join("dx");
        if candidate.is_file() {
            let source = std::fs::read_to_string(&candidate).ok()?;
            let first = source.lines().find(|l| {
                let t = l.trim().trim_start_matches('\u{feff}');
                !t.is_empty() && !t.starts_with('#')
            })?;
            if !first.starts_with("project(") && !first.starts_with("contract(")
                && !first.starts_with("runtime(") && !first.starts_with("www(")
                && !(first.contains('[') && first.contains('('))
            {
                return Some(ancestor.to_path_buf());
            }
        }
    }
    None
}

fn main() {
    let _config = ExtensionsDxConfig::load();
    _config.ensure_dirs();
    let mut stdin = std::io::stdin().lock();
    let mut stdout = std::io::stdout().lock();

    if let Err(error) = dx_browser_native_host::run_native_host(&mut stdin, &mut stdout) {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
