. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 3
Assert-NoCompetingHeavyProcess

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    Invoke-DxCommand "npm" @("run", "test:photoshop-adapter")
    Invoke-DxCommand "npm" @("run", "test:premiere-pro-adapter")
    Invoke-DxCommand "npm" @("run", "test:indesign-adapter")
    Invoke-DxCommand "npm" @("run", "test:adobe-uxp-package-output")
    Invoke-DxCommand "npm" @("run", "test:adobe-uxp-package-output-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/build-adobe-uxp-package.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-adobe-uxp-package-output-receipts.ts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.photoshop.command-center", "--verification-command", "npm run build:adobe-uxp:j1")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.premiere-pro.command-center", "--verification-command", "npm run build:adobe-uxp:j1")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-loaded-host-preflight-receipts.ts", "--adapter-id", "dx.indesign.command-center", "--verification-command", "npm run build:adobe-uxp:j1")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Pop-Location
}
