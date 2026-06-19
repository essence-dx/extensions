[CmdletBinding()]
param(
    [string] $ChromeExtensionId = "",

    [string] $EdgeExtensionId = "",

    [string] $NativeHostPath = "",

    [ValidateSet("windows", "macos", "linux")]
    [string] $TargetOs = "windows",

    [ValidateSet("x64", "arm64")]
    [string] $TargetArch = "x64",

    [string] $PackageOutputReceiptPath = ".dx\receipts\extensions\dx.browser.command-center\package-output-latest.json"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
if ([string]::IsNullOrWhiteSpace($NativeHostPath)) {
    Assert-DxDriveSpace -MinimumFreeGiB 3
}
else {
    Assert-DxDriveSpace -MinimumFreeGiB 1
}
Assert-NoCompetingHeavyProcess

function Resolve-BrowserExtensionIdCapture {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ReceiptPath,

        [string] $ChromeExtensionId = "",

        [string] $EdgeExtensionId = ""
    )

    $unblockCommand = "npm run capture:browser-extension-ids:j1 -- --timeout-ms 30000"
    $missingCaptureMessage = "Browser native-host package requires a complete Chrome and Edge extension-ID capture before the release build. Run: $unblockCommand"

    if (-not (Test-Path -LiteralPath $ReceiptPath -PathType Leaf)) {
        throw $missingCaptureMessage
    }

    $receipt = Get-Content -Raw -LiteralPath $ReceiptPath | ConvertFrom-Json
    $captures = @($receipt.captures)
    $chromeCapture = $captures | Where-Object { $_.target -eq "chrome" } | Select-Object -First 1
    $edgeCapture = $captures | Where-Object { $_.target -eq "edge" } | Select-Object -First 1

    if ($null -eq $chromeCapture -or $null -eq $edgeCapture) {
        throw $missingCaptureMessage
    }

    if (
        [string]::IsNullOrWhiteSpace([string]$chromeCapture.extensionId) -or
        [string]::IsNullOrWhiteSpace([string]$edgeCapture.extensionId)
    ) {
        throw $missingCaptureMessage
    }

    if (-not [string]::IsNullOrWhiteSpace($ChromeExtensionId) -and $chromeCapture.extensionId -ne $ChromeExtensionId) {
        throw "Browser native-host package ChromeExtensionId must match the captured Chrome extension ID."
    }

    if (-not [string]::IsNullOrWhiteSpace($EdgeExtensionId) -and $edgeCapture.extensionId -ne $EdgeExtensionId) {
        throw "Browser native-host package EdgeExtensionId must match the captured Edge extension ID."
    }

    return [pscustomobject]@{
        ChromeExtensionId = [string]$chromeCapture.extensionId
        EdgeExtensionId = [string]$edgeCapture.extensionId
    }
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $extensionIdCaptureReceiptPath = ".dx\receipts\extensions\dx.browser.command-center\extension-id-capture-latest.json"
    $resolvedExtensionIds = Resolve-BrowserExtensionIdCapture `
        -ReceiptPath $extensionIdCaptureReceiptPath `
        -ChromeExtensionId $ChromeExtensionId `
        -EdgeExtensionId $EdgeExtensionId

    if ([string]::IsNullOrWhiteSpace($NativeHostPath)) {
        Invoke-DxCommand "cargo" @("build", "-j", "1", "--release", "-p", "dx-browser-native-host", "--bin", "dx-browser-native-host")
        $resolvedNativeHostPath = Resolve-Path "target\release\dx-browser-native-host.exe"
    }
    else {
        $resolvedNativeHostPath = Resolve-Path -LiteralPath $NativeHostPath
    }

    $resolvedPackageOutputReceiptPath = Resolve-Path -LiteralPath $PackageOutputReceiptPath
    $resolvedExtensionIdCaptureReceiptPath = Resolve-Path -LiteralPath $extensionIdCaptureReceiptPath
    $manifestRoot = Join-Path (Resolve-Path ".").Path "hosts\browser\dx-browser\dist\native-host-package"
    $firefoxManifestRoot = Join-Path $manifestRoot "firefox"

    $installScriptPath = (Resolve-Path "hosts\browser\dx-browser\scripts\install-native-host.ps1").Path
    & $installScriptPath `
        -Browser "All" `
        -NativeHostPath $resolvedNativeHostPath.Path `
        -ChromeExtensionId $resolvedExtensionIds.ChromeExtensionId `
        -EdgeExtensionId $resolvedExtensionIds.EdgeExtensionId `
        -InstallRoot $manifestRoot `
        -FirefoxManifestRoot $firefoxManifestRoot `
        -ManifestOnly

    if (-not $?) {
        throw "DX browser native-host manifest package install failed."
    }

    $proofRoot = Join-Path (Resolve-Path ".").Path ".tmp"
    New-Item -ItemType Directory -Force -Path $proofRoot | Out-Null
    $proofPath = Join-Path $proofRoot "browser-native-host-package-proof.json"
    $proof = [ordered]@{
        targetOs = $TargetOs
        targetArch = $TargetArch
        hostName = "dev.dx.browser"
        nativeHostBinaryPath = $resolvedNativeHostPath.Path
        packageOutputReceiptPath = $resolvedPackageOutputReceiptPath.Path
        extensionIdCaptureReceiptPath = $resolvedExtensionIdCaptureReceiptPath.Path
        manifestPaths = [ordered]@{
            chrome = (Resolve-Path -LiteralPath (Join-Path $manifestRoot "chrome\dev.dx.browser.json")).Path
            edge = (Resolve-Path -LiteralPath (Join-Path $manifestRoot "edge\dev.dx.browser.json")).Path
            firefox = (Resolve-Path -LiteralPath (Join-Path $firefoxManifestRoot "dev.dx.browser.json")).Path
        }
    }

    [System.IO.File]::WriteAllText(
        $proofPath,
        ($proof | ConvertTo-Json -Depth 8),
        [System.Text.UTF8Encoding]::new($false)
    )

    $previousProofPath = $env:DX_BROWSER_NATIVE_HOST_PACKAGE_PROOF_JSON
    $previousVerificationCommand = $env:DX_VERIFICATION_COMMAND
    $env:DX_BROWSER_NATIVE_HOST_PACKAGE_PROOF_JSON = $proofPath
    $env:DX_VERIFICATION_COMMAND = "npm run package:browser-native-host:j1"

    try {
        Invoke-DxCommand "npm" @("run", "test:browser-native-host-package-receipt")
        Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-browser-native-host-package-receipt.ts")
        Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
    }
    finally {
        if ($null -eq $previousProofPath) {
            Remove-Item Env:\DX_BROWSER_NATIVE_HOST_PACKAGE_PROOF_JSON -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_BROWSER_NATIVE_HOST_PACKAGE_PROOF_JSON = $previousProofPath
        }

        if ($null -eq $previousVerificationCommand) {
            Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_VERIFICATION_COMMAND = $previousVerificationCommand
        }
    }
}
finally {
    Pop-Location
}
