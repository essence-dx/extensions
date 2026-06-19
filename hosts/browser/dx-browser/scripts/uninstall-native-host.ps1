[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet("Chrome", "Edge", "Firefox", "All")]
    [string] $Browser = "All",
    [string] $InstallRoot = "$env:LOCALAPPDATA\DX\browser-native-host"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$hostName = "dev.dx.browser"

function Remove-ManifestFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if ((Test-Path -LiteralPath $Path) -and $PSCmdlet.ShouldProcess($Path, "Remove DX browser native-host manifest")) {
        Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
    }
}

function Remove-NativeHostRegistration {
    param(
        [Parameter(Mandatory = $true)]
        [string] $RegistryPath
    )

    if ((Test-Path -LiteralPath $RegistryPath) -and $PSCmdlet.ShouldProcess($RegistryPath, "Remove DX browser native-host registration")) {
        Remove-Item -LiteralPath $RegistryPath -Force -ErrorAction Stop
    }
}

function Uninstall-ChromiumHost {
    param(
        [Parameter(Mandatory = $true)]
        [string] $BrowserName,
        [Parameter(Mandatory = $true)]
        [string] $RegistryPath
    )

    Remove-ManifestFile -Path (Join-Path $InstallRoot "$($BrowserName.ToLowerInvariant())\$hostName.json")
    Remove-NativeHostRegistration -RegistryPath $RegistryPath
}

function Uninstall-FirefoxHost {
    Remove-ManifestFile -Path (Join-Path $env:APPDATA "Mozilla\NativeMessagingHosts\$hostName.json")
    Remove-NativeHostRegistration -RegistryPath "HKCU:\Software\Mozilla\NativeMessagingHosts\dev.dx.browser"
}

if ($Browser -eq "Chrome" -or $Browser -eq "All") {
    Uninstall-ChromiumHost `
        -BrowserName "Chrome" `
        -RegistryPath "HKCU:\Software\Google\Chrome\NativeMessagingHosts\dev.dx.browser"
}

if ($Browser -eq "Edge" -or $Browser -eq "All") {
    Uninstall-ChromiumHost `
        -BrowserName "Edge" `
        -RegistryPath "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\dev.dx.browser"
}

if ($Browser -eq "Firefox" -or $Browser -eq "All") {
    Uninstall-FirefoxHost
}

Write-Host "DX browser native-host manifests removed for $Browser."
