. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:excel-adapter")
    Invoke-DxCommand "npm" @("run", "test:powerpoint-adapter")
    Invoke-DxCommand "npm" @("run", "test:word-adapter")
    Invoke-DxCommand "npm" @("run", "test:office-taskpane-asset-output")
    Invoke-DxCommand "npm" @("run", "test:office-sideload-manifest-output")
    Invoke-DxCommand "npm" @("run", "test:office-package-output-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-office-taskpane-assets.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-office-sideload-manifests.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-office-package-output-receipts.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.excel.command-center", "--verification-command", "npm run build:office-taskpane:j1")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.powerpoint.command-center", "--verification-command", "npm run build:office-taskpane:j1")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.word.command-center", "--verification-command", "npm run build:office-taskpane:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
