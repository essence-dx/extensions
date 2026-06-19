#!/usr/bin/env bash
set -euo pipefail

browser="all"
native_host_path=""
chrome_extension_id=""
edge_extension_id=""
install_root=""
firefox_manifest_root=""
manifest_only=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --browser)
      browser="$2"
      shift 2
      ;;
    --native-host-path)
      native_host_path="$2"
      shift 2
      ;;
    --chrome-extension-id)
      chrome_extension_id="$2"
      shift 2
      ;;
    --edge-extension-id)
      edge_extension_id="$2"
      shift 2
      ;;
    --install-root)
      install_root="$2"
      shift 2
      ;;
    --firefox-manifest-root)
      firefox_manifest_root="$2"
      shift 2
      ;;
    --manifest-only)
      manifest_only=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "$script_dir/.." && pwd)"
host_name="dev.dx.browser"

if [ -z "$native_host_path" ] || [ ! -f "$native_host_path" ]; then
  echo "--native-host-path must point to an existing native host executable" >&2
  exit 2
fi

assert_absolute_path() {
  local value="$1"
  local label="$2"
  case "$value" in
    /*) ;;
    *)
      echo "$label must be absolute" >&2
      exit 2
      ;;
  esac
}

assert_absolute_path "$native_host_path" "--native-host-path"

if [ "$manifest_only" -eq 1 ]; then
  if [ -z "$install_root" ] || [ -z "$firefox_manifest_root" ]; then
    echo "--manifest-only requires --install-root and --firefox-manifest-root" >&2
    exit 2
  fi

  assert_absolute_path "$install_root" "--install-root"
  assert_absolute_path "$firefox_manifest_root" "--firefox-manifest-root"
fi

validate_chromium_extension_id() {
  local value="$1"
  local label="$2"
  if [[ ! "$value" =~ ^[a-p]{32}$ ]]; then
    echo "$label must be an explicit 32-character Chromium extension id" >&2
    exit 2
  fi
}

json_escape() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]).slice(1, -1))' "$1"
}

write_manifest() {
  local template_path="$1"
  local target_path="$2"
  local extension_id="${3:-}"
  local escaped_path
  local escaped_extension_id

  escaped_path="$(json_escape "$native_host_path")"
  escaped_extension_id="$(json_escape "$extension_id")"

  mkdir -p "$(dirname "$target_path")"
  sed \
    -e "s#{{DX_NATIVE_HOST_PATH}}#$escaped_path#g" \
    -e "s#{{DX_BROWSER_EXTENSION_ID}}#$escaped_extension_id#g" \
    "$template_path" > "$target_path"
}

install_chromium_host() {
  local target_path="$1"
  local extension_id="$2"
  validate_chromium_extension_id "$extension_id" "Chromium extension id"
  write_manifest "$package_root/native-host/chromium/$host_name.template.json" "$target_path" "$extension_id"
}

install_firefox_host() {
  local target_path="$1"
  write_manifest "$package_root/native-host/firefox/$host_name.template.json" "$target_path"
}

if [ "$manifest_only" -eq 1 ]; then
  chrome_manifest="$install_root/chrome/$host_name.json"
  edge_manifest="$install_root/edge/$host_name.json"
  firefox_manifest="$firefox_manifest_root/$host_name.json"
else
  case "$(uname -s)" in
    Darwin)
      chrome_manifest="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/$host_name.json"
      edge_manifest="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts/$host_name.json"
      firefox_manifest="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/$host_name.json"
      ;;
    Linux)
      chrome_manifest="$HOME/.config/google-chrome/NativeMessagingHosts/$host_name.json"
      edge_manifest="$HOME/.config/microsoft-edge/NativeMessagingHosts/$host_name.json"
      firefox_manifest="$HOME/.mozilla/native-messaging-hosts/$host_name.json"
      ;;
    *)
      echo "Unsupported platform for this installer" >&2
      exit 2
      ;;
  esac
fi

if [ "$browser" = "chrome" ] || [ "$browser" = "all" ]; then
  install_chromium_host "$chrome_manifest" "$chrome_extension_id"
fi

if [ "$browser" = "edge" ] || [ "$browser" = "all" ]; then
  install_chromium_host "$edge_manifest" "$edge_extension_id"
fi

if [ "$browser" = "firefox" ] || [ "$browser" = "all" ]; then
  install_firefox_host "$firefox_manifest"
fi

echo "DX browser native-host manifests installed for $browser."
