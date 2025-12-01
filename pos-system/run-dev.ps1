param(
  [switch]$Minimized
)

# Ruta base del proyecto (este script vive en pos-system/)
$posRoot = $PSScriptRoot
$backendDir = Join-Path $posRoot 'backend'
$frontendDir = Join-Path $posRoot 'frontend'
$sqlitePath = Join-Path (Join-Path $backendDir 'offline') 'db.sqlite'

Write-Host "[POS] Arrancando backend (puerto 5656) y frontend (puerto 5177)" -ForegroundColor Cyan

# Comando para backend: establece entorno y ejecuta nodemon/ts-node via npm run dev
$backendCmd = @(
  "cd `"$backendDir`"",
  "$env:NODE_ENV='development'",
  "$env:DB_DIALECT='sqlite'",
  "$env:SQLITE_STORAGE='${sqlitePath}'",
  "npm run dev"
) -join '; '

# Comando para frontend: inicia Vite en 5177
$frontendCmd = @(
  "cd `"$frontendDir`"",
  "npm run dev"
) -join '; '

$windowStyle = if ($Minimized) { 'Minimized' } else { 'Normal' }

# Iniciar backend en una ventana de PowerShell separada
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $backendCmd -WorkingDirectory $backendDir -WindowStyle $windowStyle | Out-Null
Write-Host "[POS] Backend iniciando en http://localhost:5656/" -ForegroundColor Green

# Iniciar frontend en otra ventana de PowerShell
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $frontendCmd -WorkingDirectory $frontendDir -WindowStyle $windowStyle | Out-Null
Write-Host "[POS] Frontend iniciando en http://localhost:5177/" -ForegroundColor Green

Write-Host "[POS] Listo. Puedes abrir http://localhost:5177/" -ForegroundColor Cyan

