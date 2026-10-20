param([switch]$PrepareOnly, [switch]$Check)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodeExecutable = $nodeCommand.Source }
else {
    $candidates = @(
        (Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'),
        (Join-Path $env:LOCALAPPDATA 'nvm/v24.19.0/node.exe')
    )
    $nodeExecutable = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $nodeExecutable) { throw 'Node 22+ belum ditemukan. Gunakan Node 24 yang terpasang sebelum menjalankan launcher.' }
Push-Location $repoRoot
try {
    if ($Check) { & $nodeExecutable scripts/local/smoke.mjs }
    elseif ($PrepareOnly) { & $nodeExecutable scripts/local-dev.mjs --prepare-only }
    else { & $nodeExecutable scripts/local-dev.mjs }
    $launcherExit = $LASTEXITCODE
} finally { Pop-Location }
exit $launcherExit
