. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:obsidian-adapter")
    Invoke-DxCommand "npm" @("run", "test:obsidian-build-output")
    Invoke-DxCommand "npm" @("run", "test:obsidian-package-output-receipt")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-obsidian-plugin.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-obsidian-package-output-receipt.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.obsidian.command-center", "--verification-command", "npm run build:obsidian:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
