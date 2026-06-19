[CmdletBinding()]
param(
    [ValidateSet("Chrome", "Edge", "Firefox", "All")]
    [string] $Browser = "All",
    [Parameter(Mandatory = $true)]
    [string] $NativeHostPath,
    [string] $ChromeExtensionId = "",
    [string] $EdgeExtensionId = "",
    [string] $InstallRoot = "$env:LOCALAPPDATA\DX\browser-native-host",
    [string] $FirefoxManifestRoot = "$env:APPDATA\Mozilla\NativeMessagingHosts",
    [switch] $ManifestOnly
)

. "$PSScriptRoot\command-policy.ps1"

$ErrorActionPreference = "Stop"
Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $scriptPath = (Resolve-Path "hosts\browser\dx-browser\scripts\install-native-host.ps1").Path
    $scriptArguments = @{
        Browser = $Browser
        NativeHostPath = $NativeHostPath
        ChromeExtensionId = $ChromeExtensionId
        EdgeExtensionId = $EdgeExtensionId
        InstallRoot = $InstallRoot
        FirefoxManifestRoot = $FirefoxManifestRoot
    }

    if ($ManifestOnly) {
        $scriptArguments.ManifestOnly = $true
    }

    & $scriptPath @scriptArguments
    if (-not $?) {
        throw "DX browser native-host install script failed."
    }
}
finally {
    Pop-Location
}
