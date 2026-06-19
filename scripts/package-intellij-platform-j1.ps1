. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:intellij-platform-plugin-adapter")
    Invoke-DxCommand "npm" @("run", "test:intellij-platform-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-intellij-platform-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.intellij-platform.command-center", "--verification-command", "npm run package:intellij-platform:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
