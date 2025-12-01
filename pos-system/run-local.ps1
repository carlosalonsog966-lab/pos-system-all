<#
  Script: run-local.ps1
  Uso: Ejecuta frontend (Vite 5174) y backend (Node 5656) en sesiones separadas.
  Requisitos: Node.js y npm instalados.
  Ejecución: Haz doble clic o desde PowerShell: `./run-local.ps1`
#>

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $repoRoot 'pos-system/frontend'
$backendPath  = Join-Path $repoRoot 'pos-system/backend'

Write-Host "Arrancando entorno de desarrollo unificado..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","cd `$env:USERPROFILE; cd '$repoRoot/pos-system'; npm run dev" -WindowStyle Normal
Write-Host "Se abrirá el navegador automáticamente al estar listo." -ForegroundColor Green
