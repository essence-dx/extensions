. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_GOOGLE_WORKSPACE_DEPLOYMENT_PROOF_JSON)) {
    throw "DX_GOOGLE_WORKSPACE_DEPLOYMENT_PROOF_JSON must point to a Google Workspace deployment proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:google-workspace-deployment:j1"
    Invoke-DxCommand "npm" @("run", "test:google-workspace-deployment-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-google-workspace-deployment-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
