. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:canva-adapter")
    Invoke-DxCommand "npm" @("run", "test:canva-build-output")
    Invoke-DxCommand "npm" @("run", "test:figma-canva-package-output-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-canva-app.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-figma-canva-package-output-receipts.ts", "--host", "canva")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.canva.command-center", "--verification-command", "npm run build:canva:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
