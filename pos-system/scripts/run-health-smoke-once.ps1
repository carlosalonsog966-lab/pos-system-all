param(
  [string]$ExpectedOrigin,
  [switch]$StrictCors,
  [switch]$RefundSmoke
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir '..')
$LauncherJs = Join-Path $RepoRoot 'pos-system' 'launcher' 'run-health-smoke.js'

if ($ExpectedOrigin) { $env:EXPECTED_ORIGIN = $ExpectedOrigin }
if ($StrictCors) { $env:STRICT_CORS_CHECK = '1' }
if ($RefundSmoke) { $env:REFUND_SMOKE = '1' }

Push-Location $RepoRoot
try {
  Write-Host "[run-health-smoke-once] Ejecutando wrapper Node..."
  node $LauncherJs --once
} finally {
  Pop-Location
}

