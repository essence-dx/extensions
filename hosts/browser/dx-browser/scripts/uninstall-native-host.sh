#!/usr/bin/env bash
set -euo pipefail

browser="all"
install_root=""
firefox_manifest_root=""
manifest_only=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --browser)
      browser="$2"
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

host_name="dev.dx.browser"

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

if [ "$manifest_only" -eq 1 ]; then
  if [ -z "$install_root" ] || [ -z "$firefox_manifest_root" ]; then
    echo "--manifest-only requires --install-root and --firefox-manifest-root" >&2
    exit 2
  fi

  assert_absolute_path "$install_root" "--install-root"
  assert_absolute_path "$firefox_manifest_root" "--firefox-manifest-root"
fi

remove_manifest() {
  local manifest_path="$1"
  if [ -f "$manifest_path" ]; then
    rm -f "$manifest_path"
  fi
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
      echo "Unsupported platform for this uninstaller" >&2
      exit 2
      ;;
  esac
fi

if [ "$browser" = "chrome" ] || [ "$browser" = "all" ]; then
  remove_manifest "$chrome_manifest"
fi

if [ "$browser" = "edge" ] || [ "$browser" = "all" ]; then
  remove_manifest "$edge_manifest"
fi

if [ "$browser" = "firefox" ] || [ "$browser" = "all" ]; then
  remove_manifest "$firefox_manifest"
fi

echo "DX browser native-host manifests removed for $browser."
