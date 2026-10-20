# Run manually in your terminal. Key input is hidden and never echoed or committed.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$targetFile = Join-Path $repoRoot '.local/local-dev/deepseek.env'
New-Item -ItemType Directory -Force -Path (Split-Path $targetFile -Parent) | Out-Null
if (Test-Path -LiteralPath $targetFile) { throw 'deepseek.env already exists. Edit the existing private file; this script will not overwrite it.' }
$secureKey = Read-Host 'DeepSeek API key (hidden)' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $keyText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    if ($keyText -notmatch '^[A-Za-z0-9_-]{10,}$') { throw 'Invalid API key format' }
    # Keep activation explicit until current provider prices and exchange-rate ceilings are checked.
    $privateContent = "DEEPSEEK_API_KEY=$keyText`nLOCAL_DEEPSEEK=false`nDEEPSEEK_PRICE_CEILING_CONFIRMED=false`n"
    [IO.File]::WriteAllText($targetFile, $privateContent)
    Write-Host 'Private key saved. AI remains disabled until LOCAL_DEEPSEEK and the pricing-review flag are explicitly enabled. See docs/backend-implementation/09-local-full-flow.md.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    $keyText = $null
    $privateContent = $null
}
