$ErrorActionPreference = "Stop"

# Paths
$BackendRoot = Split-Path -Path $PSScriptRoot -Parent
$DbPath = Join-Path $BackendRoot "data\pos_system.db"
$BackupsDir = Join-Path $BackendRoot "data\backups"

if (-not (Test-Path $BackupsDir)) {
  New-Item -ItemType Directory -Path $BackupsDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$Dest = Join-Path $BackupsDir ("pos_system_" + $timestamp + ".sqlite")

Copy-Item -Path $DbPath -Destination $Dest -Force
Write-Host ("Backup creado: " + $Dest)
