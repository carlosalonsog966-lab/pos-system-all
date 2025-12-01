param(
  [switch]$Minimized
)

$scriptsDir = $PSScriptRoot
$posRoot = Split-Path $scriptsDir -Parent
$runDevPath = Join-Path $posRoot 'run-dev.ps1'

if (-not (Test-Path $runDevPath)) {
  Write-Error "[POS] No se encontró $runDevPath."
  exit 1
}

$startupPath = [Environment]::GetFolderPath('Startup')
if (-not (Test-Path $startupPath)) {
  Write-Error "[POS] No se encontró la carpeta de Inicio ($startupPath)."
  exit 1
}

$shortcutPath = Join-Path $startupPath 'POS-System-Dev.lnk'
$argMin = if ($Minimized) { '-Minimized' } else { '' }
$psArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$runDevPath`" $argMin"

try {
  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($shortcutPath)
  $sc.TargetPath = "powershell.exe"
  $sc.Arguments = $psArgs
  $sc.WorkingDirectory = $posRoot
  $sc.IconLocation = "powershell.exe,0"
  $sc.Description = "Arranca POS backend (5656) y frontend (5177) al iniciar sesión"
  $sc.Save()
  Write-Host "[POS] Atajo creado en Inicio: $shortcutPath" -ForegroundColor Green
  Write-Host "[POS] Ejecutable: powershell.exe $psArgs" -ForegroundColor Green
  Write-Host "[POS] Se arrancará automáticamente al iniciar sesión." -ForegroundColor Cyan
} catch {
  Write-Error "[POS] Error creando el atajo: $_"
  exit 1
}

