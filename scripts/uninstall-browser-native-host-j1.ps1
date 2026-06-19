[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet("Chrome", "Edge", "Firefox", "All")]
    [string] $Browser = "All",
    [string] $InstallRoot = "$env:LOCALAPPDATA\DX\browser-native-host"
)

. "$PSScriptRoot\command-policy.ps1"

$ErrorActionPreference = "Stop"
Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

$scriptPath = Resolve-Path "$PSScriptRoot\..\hosts\browser\dx-browser\scripts\uninstall-native-host.ps1"
$scriptArguments = @("-Browser", $Browser, "-InstallRoot", $InstallRoot)
if ($WhatIfPreference) {
    $scriptArguments += "-WhatIf"
}

& $scriptPath @scriptArguments
if (-not $?) {
    throw "DX browser native-host uninstall script failed."
}
