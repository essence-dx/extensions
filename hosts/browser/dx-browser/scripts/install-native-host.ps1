[CmdletBinding(SupportsShouldProcess = $true)]
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

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$hostName = "dev.dx.browser"
$packageRoot = Resolve-Path "$PSScriptRoot\.."
$resolvedNativeHostPath = Resolve-Path -LiteralPath $NativeHostPath -ErrorAction Stop

function Assert-ChromiumExtensionId {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Value,
        [Parameter(Mandatory = $true)]
        [string] $Label
    )

    if ($Value -eq "{{DX_BROWSER_EXTENSION_ID}}" -or -not ($Value -match "^[a-p]{32}$")) {
        throw "$Label must be an explicit 32-character Chromium extension id."
    }
}

function Write-ManifestFromTemplate {
    param(
        [Parameter(Mandatory = $true)]
        [string] $TemplatePath,
        [Parameter(Mandatory = $true)]
        [string] $TargetPath,
        [string] $ExtensionId = ""
    )

    $targetDirectory = Split-Path -Parent $TargetPath
    $content = Get-Content -LiteralPath $TemplatePath -Raw
    $content = $content.Replace("{{DX_NATIVE_HOST_PATH}}", $resolvedNativeHostPath.Path.Replace("\", "\\"))
    $content = $content.Replace("{{DX_BROWSER_EXTENSION_ID}}", $ExtensionId)
    $manifest = $content | ConvertFrom-Json

    if ($PSCmdlet.ShouldProcess($TargetPath, "Write DX browser native-host manifest")) {
        New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
        $json = $manifest | ConvertTo-Json -Depth 8
        [System.IO.File]::WriteAllText($TargetPath, $json, [System.Text.UTF8Encoding]::new($false))
    }
}

function Register-NativeHost {
    param(
        [Parameter(Mandatory = $true)]
        [string] $RegistryPath,
        [Parameter(Mandatory = $true)]
        [string] $ManifestPath
    )

    if ($ManifestOnly) {
        return
    }

    if ($PSCmdlet.ShouldProcess($RegistryPath, "Register DX browser native-host manifest")) {
        New-Item -Path $RegistryPath -Force | Out-Null
        Set-RegistryDefaultValue -RegistryPath $RegistryPath -Value $ManifestPath
    }
}

function Set-RegistryDefaultValue {
    param(
        [Parameter(Mandatory = $true)]
        [string] $RegistryPath,
        [Parameter(Mandatory = $true)]
        [string] $Value
    )

    $prefix = "HKCU:\"
    if (-not $RegistryPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "DX browser native-host install only supports HKCU registry paths."
    }

    $subKey = $RegistryPath.Substring($prefix.Length)
    $registryKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($subKey)
    if ($null -eq $registryKey) {
        throw "DX browser native-host registry key could not be created: $RegistryPath"
    }

    try {
        $registryKey.SetValue("", $Value, [Microsoft.Win32.RegistryValueKind]::String)
    }
    finally {
        $registryKey.Dispose()
    }
}

function Install-ChromiumHost {
    param(
        [Parameter(Mandatory = $true)]
        [string] $BrowserName,
        [Parameter(Mandatory = $true)]
        [string] $RegistryPath,
        [Parameter(Mandatory = $true)]
        [string] $ExtensionId
    )

    Assert-ChromiumExtensionId -Value $ExtensionId -Label "$BrowserName extension id"

    $manifestPath = Join-Path $InstallRoot "$($BrowserName.ToLowerInvariant())\$hostName.json"
    $templatePath = Join-Path $packageRoot "native-host\chromium\$hostName.template.json"

    Write-ManifestFromTemplate -TemplatePath $templatePath -TargetPath $manifestPath -ExtensionId $ExtensionId
    Register-NativeHost -RegistryPath $RegistryPath -ManifestPath $manifestPath
}

function Install-FirefoxHost {
    $manifestPath = Join-Path $FirefoxManifestRoot "$hostName.json"
    $templatePath = Join-Path $packageRoot "native-host\firefox\$hostName.template.json"

    Write-ManifestFromTemplate -TemplatePath $templatePath -TargetPath $manifestPath
    Register-NativeHost `
        -RegistryPath "HKCU:\Software\Mozilla\NativeMessagingHosts\dev.dx.browser" `
        -ManifestPath $manifestPath
}

if ($Browser -eq "Chrome" -or $Browser -eq "All") {
    Install-ChromiumHost `
        -BrowserName "Chrome" `
        -RegistryPath "HKCU:\Software\Google\Chrome\NativeMessagingHosts\dev.dx.browser" `
        -ExtensionId $ChromeExtensionId
}

if ($Browser -eq "Edge" -or $Browser -eq "All") {
    Install-ChromiumHost `
        -BrowserName "Edge" `
        -RegistryPath "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\dev.dx.browser" `
        -ExtensionId $EdgeExtensionId
}

if ($Browser -eq "Firefox" -or $Browser -eq "All") {
    Install-FirefoxHost
}

Write-Host "DX browser native-host manifests installed for $Browser."
