param(
    [ValidateSet("chrome", "edge", "firefox", "Chrome", "Edge", "Firefox")]
    [string[]] $Target = @(),

    [switch] $AllowBuild
)

. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

function Get-SmokeTargets {
    if ($Target.Count -eq 0) {
        return @("chrome", "edge")
    }

    return @($Target | ForEach-Object { $_.ToLowerInvariant() } | Select-Object -Unique)
}

function Invoke-LiveBrowserLoadedProfileSmoke {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Targets
    )

    if ($Targets -contains "firefox") {
        throw "Firefox loaded-profile smoke requires DX_BROWSER_LOADED_PROFILE_PROOF_JSON because live Firefox automation is not wired to Chromium DevTools."
    }

    $captureReceipt = Read-JsonFile ".dx\receipts\extensions\dx.browser.command-center\extension-id-capture-latest.json"
    $chromeCapture = Get-OptionalCaptureForTarget -CaptureReceipt $captureReceipt -Target "chrome"
    $edgeCapture = Get-OptionalCaptureForTarget -CaptureReceipt $captureReceipt -Target "edge"
    Assert-RequestedCapturesExist -Targets $Targets -ChromeCapture $chromeCapture -EdgeCapture $edgeCapture
    $nativeHostPath = Resolve-NativeHostPath

    Ensure-NativeHostPackageReceipt `
        -NativeHostPath $nativeHostPath `
        -ChromeExtensionId (Get-CaptureExtensionId -Capture $chromeCapture) `
        -EdgeExtensionId (Get-CaptureExtensionId -Capture $edgeCapture) `
        -Targets $Targets

    $registrySnapshots = @{}
    foreach ($targetName in $Targets) {
        $registryPath = Get-NativeHostRegistryPath -Target $targetName
        $registrySnapshots[$targetName] = Get-NativeHostRegistrySnapshot -RegistryPath $registryPath
    }

    try {
        foreach ($targetName in $Targets) {
            Install-NativeHostForTarget `
                -Target $targetName `
                -NativeHostPath $nativeHostPath `
                -ChromeExtensionId (Get-CaptureExtensionId -Capture $chromeCapture) `
                -EdgeExtensionId (Get-CaptureExtensionId -Capture $edgeCapture)
        }

        $runnerArguments = @("--experimental-strip-types", "scripts/run-browser-loaded-profile-smoke.ts")
        foreach ($targetName in $Targets) {
            $runnerArguments += @("--target", $targetName)
        }

        Invoke-DxCommand "node" $runnerArguments
    }
    finally {
        foreach ($targetName in $Targets) {
            Restore-NativeHostRegistrySnapshot `
                -RegistryPath (Get-NativeHostRegistryPath -Target $targetName) `
                -Snapshot $registrySnapshots[$targetName]
        }
    }
}

function Read-JsonFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required browser loaded-profile receipt is missing: $Path"
    }

    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-OptionalCaptureForTarget {
    param(
        [Parameter(Mandatory = $true)]
        [object] $CaptureReceipt,
        [Parameter(Mandatory = $true)]
        [string] $Target
    )

    $capture = @($CaptureReceipt.captures | Where-Object { $_.target -eq $Target } | Select-Object -First 1)
    if ($capture.Count -eq 0) {
        return $null
    }

    return $capture[0]
}

function Assert-RequestedCapturesExist {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Targets,
        [object] $ChromeCapture,
        [object] $EdgeCapture
    )

    if (($Targets -contains "chrome") -and $null -eq $ChromeCapture) {
        throw "Browser extension ID capture is missing target: chrome"
    }

    if (($Targets -contains "edge") -and $null -eq $EdgeCapture) {
        throw "Browser extension ID capture is missing target: edge"
    }
}

function Get-CaptureExtensionId {
    param(
        [object] $Capture
    )

    if ($null -eq $Capture) {
        return ""
    }

    return [string]$Capture.extensionId
}

function Resolve-NativeHostPath {
    $receiptPath = ".dx\receipts\extensions\dx.browser.command-center\native-host-release-package-latest.json"
    if (Test-Path -LiteralPath $receiptPath) {
        $receipt = Read-JsonFile $receiptPath
        if ($receipt.nativeHost.executable.path -and (Test-Path -LiteralPath $receipt.nativeHost.executable.path)) {
            return (Resolve-Path -LiteralPath $receipt.nativeHost.executable.path).Path
        }
    }

    $candidatePath = "target\release\dx-browser-native-host.exe"
    if (-not (Test-Path -LiteralPath $candidatePath)) {
        if (-not (Test-BrowserSmokeBuildAllowed)) {
            throw "Browser loaded-profile smoke requires an existing native-host executable. Run npm run package:browser-native-host:j1 with captured Chrome and Edge extension IDs, or rerun this smoke with -AllowBuild or DX_BROWSER_SMOKE_ALLOW_BUILD=1 to permit the serialized native-host release build."
        }

        Invoke-DxCommand "cargo" @("build", "-j", "1", "--release", "-p", "dx-browser-native-host", "--bin", "dx-browser-native-host")
    }

    return (Resolve-Path -LiteralPath $candidatePath).Path
}

function Test-BrowserSmokeBuildAllowed {
    return [bool]$AllowBuild -or $env:DX_BROWSER_SMOKE_ALLOW_BUILD -eq "1"
}

function Ensure-NativeHostPackageReceipt {
    param(
        [Parameter(Mandatory = $true)]
        [string] $NativeHostPath,
        [string] $ChromeExtensionId = "",
        [string] $EdgeExtensionId = "",
        [Parameter(Mandatory = $true)]
        [string[]] $Targets
    )

    $receiptPath = ".dx\receipts\extensions\dx.browser.command-center\native-host-release-package-latest.json"
    if (
        (Test-Path -LiteralPath $receiptPath) -and
        (Test-NativeHostPackageReceiptMatches `
            -Path $receiptPath `
            -NativeHostPath $NativeHostPath `
            -ChromeExtensionId $ChromeExtensionId `
            -EdgeExtensionId $EdgeExtensionId `
            -Targets $Targets)
    ) {
        return
    }

    if ([string]::IsNullOrWhiteSpace($ChromeExtensionId) -or [string]::IsNullOrWhiteSpace($EdgeExtensionId)) {
        throw "Refreshing the combined browser native-host package requires both Chrome and Edge extension IDs."
    }

    Invoke-DxCommand "npm" @(
        "run",
        "package:browser-native-host:j1",
        "--",
        "-ChromeExtensionId",
        $ChromeExtensionId,
        "-EdgeExtensionId",
        $EdgeExtensionId,
        "-NativeHostPath",
        $NativeHostPath
    )
}

function Test-NativeHostPackageReceiptMatches {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path,
        [Parameter(Mandatory = $true)]
        [string] $NativeHostPath,
        [string] $ChromeExtensionId = "",
        [string] $EdgeExtensionId = "",
        [Parameter(Mandatory = $true)]
        [string[]] $Targets
    )

    $receipt = Read-JsonFile $Path

    if (-not (Test-NativeHostExecutableMatches -Receipt $receipt -NativeHostPath $NativeHostPath)) {
        return $false
    }

    if (-not (Test-NativeHostPackageOutputLinkCurrent -Receipt $receipt)) {
        return $false
    }

    if (-not (Test-NativeHostExtensionIdCaptureMatches `
        -Receipt $receipt `
        -ChromeExtensionId $ChromeExtensionId `
        -EdgeExtensionId $EdgeExtensionId)) {
        return $false
    }

    $chromeManifest = @($receipt.nativeHost.manifests | Where-Object { $_.target -eq "chrome" } | Select-Object -First 1)
    $edgeManifest = @($receipt.nativeHost.manifests | Where-Object { $_.target -eq "edge" } | Select-Object -First 1)

    if (($Targets -contains "chrome") -and ($chromeManifest.Count -eq 0 -or -not ($chromeManifest[0].allowedOrigins -contains "chrome-extension://$ChromeExtensionId/"))) {
        return $false
    }

    if (($Targets -contains "edge") -and ($edgeManifest.Count -eq 0 -or -not ($edgeManifest[0].allowedOrigins -contains "chrome-extension://$EdgeExtensionId/"))) {
        return $false
    }

    return `
        (($chromeManifest.Count -eq 0) -or (Test-Path -LiteralPath $chromeManifest[0].manifestPath)) -and `
        (($edgeManifest.Count -eq 0) -or (Test-Path -LiteralPath $edgeManifest[0].manifestPath))
}

function Test-NativeHostExecutableMatches {
    param(
        [Parameter(Mandatory = $true)]
        [object] $Receipt,
        [Parameter(Mandatory = $true)]
        [string] $NativeHostPath
    )

    $executablePath = [string]$Receipt.nativeHost.executable.path
    $expectedSha256 = [string]$Receipt.nativeHost.executable.sha256
    if (
        [string]::IsNullOrWhiteSpace($executablePath) -or
        [string]::IsNullOrWhiteSpace($expectedSha256) -or
        (-not (Test-Path -LiteralPath $executablePath)) -or
        (-not (Test-Path -LiteralPath $NativeHostPath))
    ) {
        return $false
    }

    $resolvedReceiptPath = (Resolve-Path -LiteralPath $executablePath).Path
    $resolvedNativeHostPath = (Resolve-Path -LiteralPath $NativeHostPath).Path
    if ($resolvedReceiptPath -ne $resolvedNativeHostPath) {
        return $false
    }

    return (Get-FileSha256 -Path $resolvedReceiptPath) -eq $expectedSha256
}

function Test-NativeHostPackageOutputLinkCurrent {
    param(
        [Parameter(Mandatory = $true)]
        [object] $Receipt
    )

    $packageOutputPath = [string]$Receipt.packageOutput.receiptPath
    $expectedSha256 = [string]$Receipt.packageOutput.receiptSha256
    $currentPackageOutputPath = ".dx\receipts\extensions\dx.browser.command-center\package-output-latest.json"
    if (
        [string]::IsNullOrWhiteSpace($packageOutputPath) -or
        [string]::IsNullOrWhiteSpace($expectedSha256) -or
        (-not (Test-Path -LiteralPath $packageOutputPath)) -or
        (-not (Test-Path -LiteralPath $currentPackageOutputPath))
    ) {
        return $false
    }

    $resolvedPackageOutputPath = (Resolve-Path -LiteralPath $packageOutputPath).Path
    $resolvedCurrentPackageOutputPath = (Resolve-Path -LiteralPath $currentPackageOutputPath).Path
    if ($resolvedPackageOutputPath -ne $resolvedCurrentPackageOutputPath) {
        return $false
    }

    return (Get-FileSha256 -Path $resolvedPackageOutputPath) -eq $expectedSha256
}

function Test-NativeHostExtensionIdCaptureMatches {
    param(
        [Parameter(Mandatory = $true)]
        [object] $Receipt,
        [string] $ChromeExtensionId = "",
        [string] $EdgeExtensionId = ""
    )

    $captureLink = $Receipt.extensionIdCapture
    $capturePath = [string]$captureLink.receiptPath
    $expectedSha256 = [string]$captureLink.receiptSha256
    if (
        [string]::IsNullOrWhiteSpace($capturePath) -or
        [string]::IsNullOrWhiteSpace($expectedSha256) -or
        [string]::IsNullOrWhiteSpace($ChromeExtensionId) -or
        [string]::IsNullOrWhiteSpace($EdgeExtensionId) -or
        $captureLink.chromeExtensionId -ne $ChromeExtensionId -or
        $captureLink.edgeExtensionId -ne $EdgeExtensionId -or
        (-not (Test-Path -LiteralPath $capturePath))
    ) {
        return $false
    }

    if ((Get-FileSha256 -Path $capturePath) -ne $expectedSha256) {
        return $false
    }

    $captureReceipt = Read-JsonFile $capturePath
    $chromeCapture = Get-OptionalCaptureForTarget -CaptureReceipt $captureReceipt -Target "chrome"
    $edgeCapture = Get-OptionalCaptureForTarget -CaptureReceipt $captureReceipt -Target "edge"

    return `
        ($null -ne $chromeCapture) -and `
        ($null -ne $edgeCapture) -and `
        ([string]$chromeCapture.extensionId -eq $ChromeExtensionId) -and `
        ([string]$edgeCapture.extensionId -eq $EdgeExtensionId)
}

function Get-FileSha256 {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Install-NativeHostForTarget {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Target,
        [Parameter(Mandatory = $true)]
        [string] $NativeHostPath,
        [string] $ChromeExtensionId = "",
        [string] $EdgeExtensionId = ""
    )

    $browser = if ($Target -eq "chrome") { "Chrome" } else { "Edge" }
    $installRoot = (Resolve-Path "hosts\browser\dx-browser\dist\native-host-package").Path
    $installArguments = @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "scripts\install-browser-native-host-j1.ps1",
        "-Browser",
        $browser,
        "-NativeHostPath",
        $NativeHostPath,
        "-InstallRoot",
        $installRoot
    )

    if (-not [string]::IsNullOrWhiteSpace($ChromeExtensionId)) {
        $installArguments += @("-ChromeExtensionId", $ChromeExtensionId)
    }

    if (-not [string]::IsNullOrWhiteSpace($EdgeExtensionId)) {
        $installArguments += @("-EdgeExtensionId", $EdgeExtensionId)
    }

    Invoke-DxCommand "powershell" $installArguments
}

function Get-NativeHostRegistryPath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Target
    )

    if ($Target -eq "chrome") {
        return "HKCU:\Software\Google\Chrome\NativeMessagingHosts\dev.dx.browser"
    }

    return "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\dev.dx.browser"
}

function Get-NativeHostRegistrySnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string] $RegistryPath
    )

    $subKey = Convert-HkcuRegistryPathToSubKey -RegistryPath $RegistryPath
    $registryKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($subKey)
    if ($null -eq $registryKey) {
        return @{
            Exists = $false
            DefaultValue = $null
        }
    }

    try {
        return @{
            Exists = $true
            DefaultValue = $registryKey.GetValue("", $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        }
    }
    finally {
        $registryKey.Dispose()
    }
}

function Restore-NativeHostRegistrySnapshot {
    param(
        [Parameter(Mandatory = $true)]
        [string] $RegistryPath,
        [Parameter(Mandatory = $true)]
        [hashtable] $Snapshot
    )

    if (-not [bool]$Snapshot.Exists) {
        if (Test-Path -LiteralPath $RegistryPath) {
            Remove-Item -LiteralPath $RegistryPath -Force -ErrorAction Stop
        }
        return
    }

    $subKey = Convert-HkcuRegistryPathToSubKey -RegistryPath $RegistryPath
    $registryKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($subKey)
    if ($null -eq $registryKey) {
        throw "DX browser native-host registry key could not be restored: $RegistryPath"
    }

    try {
        if ($null -eq $Snapshot.DefaultValue) {
            $registryKey.DeleteValue("", $false)
        }
        else {
            $registryKey.SetValue("", [string]$Snapshot.DefaultValue, [Microsoft.Win32.RegistryValueKind]::String)
        }
    }
    finally {
        $registryKey.Dispose()
    }
}

function Convert-HkcuRegistryPathToSubKey {
    param(
        [Parameter(Mandatory = $true)]
        [string] $RegistryPath
    )

    $prefix = "HKCU:\"
    if (-not $RegistryPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "DX browser loaded-profile smoke only supports HKCU registry paths."
    }

    return $RegistryPath.Substring($prefix.Length)
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:browser-loaded-profile:j1"
    Invoke-DxCommand "npm" @("run", "test:browser-loaded-profile-receipt")
    Invoke-DxCommand "npm" @("run", "test:browser-loaded-profile-proof-receipts")
    Invoke-DxCommand "npm" @("run", "test:browser-loaded-profile-smoke-runner")
    Invoke-DxCommand "npm" @("run", "write:browser-host-action-index-receipt:j1")

    if ([string]::IsNullOrWhiteSpace($env:DX_BROWSER_LOADED_PROFILE_PROOF_JSON)) {
        Invoke-LiveBrowserLoadedProfileSmoke -Targets (Get-SmokeTargets)
    }
    else {
        Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-browser-loaded-profile-proof-receipts.ts")
    }

    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
