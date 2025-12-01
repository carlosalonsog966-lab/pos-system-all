param(
  [switch]$Once,
  [switch]$StrictCors,
  [string]$ExpectedOrigin,
  [switch]$NoRefundSmoke
)

# Navegar al directorio pos-system
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
Set-Location $rootDir

function Get-ExpectedOriginDefault {
  param()
  $backendEnvPath = Join-Path $rootDir 'backend/.env'
  if (Test-Path $backendEnvPath) {
    try {
      $lines = Get-Content $backendEnvPath -ErrorAction SilentlyContinue
      foreach ($line in $lines) {
        if ($line -match '^\s*FRONTEND_URL\s*=\s*(.+)$') {
          $val = $Matches[1].Trim()
          # Remover comillas envolventes si existen
          $val = $val -replace '^\s*"(.*)"\s*$', '$1'
          $val = $val -replace "^\s*'(.*)'\s*$", '$1'
          try {
            $uri = [Uri]$val
            return ("{0}://{1}" -f $uri.Scheme, $uri.Authority)
          } catch {
            return ($val -replace '/+$','')
          }
        }
      }
    } catch {}
  }
  return 'http://localhost:5175'
}

# Defaults
if (-not $PSBoundParameters.ContainsKey('StrictCors')) { $StrictCors = $true }
if (-not $PSBoundParameters.ContainsKey('ExpectedOrigin')) {
  if ($env:EXPECTED_ORIGIN) { $ExpectedOrigin = $env:EXPECTED_ORIGIN }
  else { $ExpectedOrigin = Get-ExpectedOriginDefault }
}

# Variables de entorno para health-e2e
$env:EXPECTED_ORIGIN = $ExpectedOrigin
$env:STRICT_CORS_CHECK = if ($StrictCors) { '1' } else { '0' }
if (-not $NoRefundSmoke) { $env:REFUND_SMOKE = '1' } else { $env:REFUND_SMOKE = '0' }

Write-Host ("[run-health-smoke] EXPECTED_ORIGIN=" + $env:EXPECTED_ORIGIN + " STRICT_CORS_CHECK=" + $env:STRICT_CORS_CHECK + " REFUND_SMOKE=" + $env:REFUND_SMOKE)
Write-Host "[run-health-smoke] Ejecutando health-e2e..."
node launcher/health-e2e.js
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  Write-Error "[run-health-smoke] Health E2E FALLÓ (exit $exitCode). Ver capturas en 'captures/'."
} else {
  Write-Host "[run-health-smoke] OK"
}

if ($Once) { exit $exitCode }

# Modo loop: ejecutar cada hora si no se pasa -Once
while ($true) {
  Start-Sleep -Seconds 3600
  Write-Host "[run-health-smoke] Ejecutando nuevamente..."
  node launcher/health-e2e.js
}
