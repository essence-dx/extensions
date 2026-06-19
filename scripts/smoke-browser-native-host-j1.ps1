[CmdletBinding()]
param(
    [Parameter()]
    [string] $NativeHostPath,

    [Parameter()]
    [string] $DxBinaryPath = "G:\Dx\bin\dx.exe",

    [Parameter()]
    [string] $DxWorkingDirectoryPath
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

function New-DxBrowserNativeHostForgeWorkspace {
    param(
        [Parameter(Mandatory = $true)]
        [string] $DxBinaryPath
    )

    $workspacePath = Join-Path ([System.IO.Path]::GetTempPath()) "dx-browser-native-host-forge-$([System.Guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $workspacePath | Out-Null

    try {
        Invoke-DxCommand $DxBinaryPath @("forge", "init", $workspacePath) | Out-Null

        $packageDirectory = Join-Path $workspacePath ".forge\packages"
        New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null

        $manifest = @'
{
  "schema": "forge.package_manifest",
  "format": 1,
  "packages": [],
  "remotes": [],
  "media": []
}
'@
        $manifestPath = Join-Path $packageDirectory "manifest.json"
        $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($manifestPath, $manifest, $utf8WithoutBom)
        Push-Location $workspacePath
        try {
            Invoke-DxCommand $DxBinaryPath @("forge", "packages", "--json") | Out-Null
        }
        finally {
            Pop-Location
        }

        return (Resolve-Path $workspacePath).Path
    }
    catch {
        Remove-DxBrowserNativeHostForgeWorkspace -WorkspacePath $workspacePath
        throw
    }
}

function Remove-DxBrowserNativeHostForgeWorkspace {
    param(
        [Parameter()]
        [string] $WorkspacePath
    )

    if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
        return
    }

    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    $candidate = [System.IO.Path]::GetFullPath($WorkspacePath)
    if (-not $candidate.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove browser native-host Forge workspace outside temp: $WorkspacePath"
    }

    Remove-Item -LiteralPath $WorkspacePath -Recurse -Force -ErrorAction SilentlyContinue
}

if (
    [string]::IsNullOrWhiteSpace($DxBinaryPath) -or
    -not [System.IO.Path]::IsPathRooted($DxBinaryPath) -or
    [System.IO.Path]::GetFileName($DxBinaryPath) -ne "dx.exe"
) {
    throw "DxBinaryPath must point to an absolute dx.exe binary."
}

$createdWorkingDirectoryPath = $null
if ([string]::IsNullOrWhiteSpace($DxWorkingDirectoryPath)) {
    $createdWorkingDirectoryPath = New-DxBrowserNativeHostForgeWorkspace -DxBinaryPath $DxBinaryPath
    $resolvedWorkingDirectoryPath = $createdWorkingDirectoryPath
}
else {
    if (
        -not [System.IO.Path]::IsPathRooted($DxWorkingDirectoryPath) -or
        -not (Test-Path -LiteralPath $DxWorkingDirectoryPath -PathType Container)
    ) {
        throw "DxWorkingDirectoryPath must point to an existing absolute directory."
    }

    $resolvedWorkingDirectoryPath = (Resolve-Path $DxWorkingDirectoryPath).Path
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    if ([string]::IsNullOrWhiteSpace($NativeHostPath)) {
        Invoke-DxCommand "cargo" @("build", "-j", "1", "-p", "dx-browser-native-host", "--bin", "dx-browser-native-host")
        $resolvedNativeHostPath = Resolve-Path "target\debug\dx-browser-native-host.exe"
    }
    else {
        $resolvedNativeHostPath = Resolve-Path $NativeHostPath
    }

    $previousNativeHostPath = $env:DX_BROWSER_NATIVE_HOST_BIN
    $previousDxBinaryPath = $env:DX_BROWSER_NATIVE_HOST_DX_BIN
    $previousDxWorkingDirectoryPath = $env:DX_BROWSER_NATIVE_HOST_WORKING_DIR
    $env:DX_BROWSER_NATIVE_HOST_BIN = $resolvedNativeHostPath.Path
    $env:DX_BROWSER_NATIVE_HOST_DX_BIN = (Resolve-Path $DxBinaryPath).Path
    $env:DX_BROWSER_NATIVE_HOST_WORKING_DIR = $resolvedWorkingDirectoryPath

    try {
        Invoke-DxCommand "npm" @("run", "write:browser-host-action-index-receipt:j1")
        Invoke-DxCommand "npm" @("--workspace", "dx-browser", "run", "test:native-host-binary-smoke")
        Invoke-DxCommand "npm" @("--workspace", "dx-browser", "run", "test:loaded-browser-dispatch-smoke")
    }
    finally {
        if ($null -eq $previousNativeHostPath) {
            Remove-Item Env:\DX_BROWSER_NATIVE_HOST_BIN -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_BROWSER_NATIVE_HOST_BIN = $previousNativeHostPath
        }

        if ($null -eq $previousDxBinaryPath) {
            Remove-Item Env:\DX_BROWSER_NATIVE_HOST_DX_BIN -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_BROWSER_NATIVE_HOST_DX_BIN = $previousDxBinaryPath
        }

        if ($null -eq $previousDxWorkingDirectoryPath) {
            Remove-Item Env:\DX_BROWSER_NATIVE_HOST_WORKING_DIR -ErrorAction SilentlyContinue
        }
        else {
            $env:DX_BROWSER_NATIVE_HOST_WORKING_DIR = $previousDxWorkingDirectoryPath
        }
    }
}
finally {
    Pop-Location
    Remove-DxBrowserNativeHostForgeWorkspace -WorkspacePath $createdWorkingDirectoryPath
}
