. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:google-workspace-addon-adapter")
    Invoke-DxCommand "npm" @("run", "test:google-workspace-apps-script-output")
    Invoke-DxCommand "npm" @("run", "test:google-workspace-apps-script-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-google-workspace-apps-script-output.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-google-workspace-apps-script-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.google-workspace.command-center", "--verification-command", "npm run build:google-workspace-apps-script:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
