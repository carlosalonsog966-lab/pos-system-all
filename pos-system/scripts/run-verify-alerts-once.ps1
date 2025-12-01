Param(
  [string]$NodePath
)

$ErrorActionPreference = 'Stop'

# Detectar ruta de Node si no se proporciona
if (-not $NodePath) {
  try {
    $NodePath = (Get-Command node).Source
  } catch {
    $NodePath = 'C:\Program Files\nodejs\node.exe'
  }
}

if (-not (Test-Path $NodePath)) {
  Write-Host "No se encontró Node en $NodePath. Instala Node o pasa -NodePath."
  exit 1
}

# Posicionar en la raíz de pos-system para que dotenv cargue .env correctamente
$RepoRoot = Split-Path -Path $PSScriptRoot -Parent
$PosRoot = $RepoRoot
Set-Location $PosRoot

$LauncherPath = Join-Path (Join-Path $PosRoot 'launcher') 'file-verification-alerts.js'
Write-Host "Ejecutando verificación 'once' con: $NodePath $LauncherPath --once"
& $NodePath $LauncherPath --once

