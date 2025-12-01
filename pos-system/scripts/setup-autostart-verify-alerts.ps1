Param(
  [string]$NodePath
)

$ErrorActionPreference = 'Stop'

if (-not $NodePath) {
  try { $NodePath = (Get-Command node).Source } catch { Write-Error 'No se encontró node en PATH. Proporcione -NodePath.'; exit 1 }
}

$ScriptPath = Join-Path (Split-Path -Path $PSScriptRoot -Parent) 'launcher/file-verification-alerts.js'
if (-not (Test-Path $ScriptPath)) { Write-Error "Script de alerts no encontrado: $ScriptPath"; exit 1 }

$Value = '"' + $NodePath + '" ' + '"' + $ScriptPath + '"'
$RegPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
New-Item -Path $RegPath -Force | Out-Null
New-ItemProperty -Path $RegPath -Name 'POSVerifyAlerts' -Value $Value -PropertyType String -Force | Out-Null
Write-Host "AutoStart configurado en HKCU Run: POSVerifyAlerts -> $Value"
