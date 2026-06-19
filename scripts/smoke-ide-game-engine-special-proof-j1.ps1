. "$PSScriptRoot\command-policy.ps1"

Set-DxSerialBuildEnvironment
Assert-DxDriveSpace -MinimumFreeGiB 1
Assert-NoCompetingHeavyProcess

if ([string]::IsNullOrWhiteSpace($env:DX_IDE_GAME_ENGINE_SPECIAL_PROOF_JSON)) {
    throw "DX_IDE_GAME_ENGINE_SPECIAL_PROOF_JSON must point to an IDE/game-engine special proof JSON file."
}

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    $env:DX_VERIFICATION_COMMAND = "npm run smoke:ide-game-engine-special-proof:j1"
    Invoke-DxCommand "npm" @("run", "test:ide-game-engine-special-proof-receipts")
    Invoke-DxCommand "node" @("--experimental-strip-types", "scripts/write-ide-game-engine-special-proof-receipts.ts")
    Invoke-DxCommand "npm" @("run", "check:generated-output-ignore")
}
finally {
    Remove-Item Env:\DX_VERIFICATION_COMMAND -ErrorAction SilentlyContinue
    Pop-Location
}
