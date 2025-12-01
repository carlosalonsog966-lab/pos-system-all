param(
  [switch]$Minimized
)

function Ensure-TaskModule {
  if (-not (Get-Module -ListAvailable -Name ScheduledTasks)) {
    Write-Host "[POS] El módulo ScheduledTasks no está disponible." -ForegroundColor Yellow
  }
}

Ensure-TaskModule

$scriptsDir = $PSScriptRoot
$posRoot = Split-Path $scriptsDir -Parent
$runDevPath = Join-Path $posRoot 'run-dev.ps1'
$taskName = 'POS-System-Dev-Autostart'

if (-not (Test-Path $runDevPath)) {
  Write-Error "[POS] No se encontró $runDevPath. Asegúrate de ejecutar este script desde pos-system/scripts."
  exit 1
}

# Argumentos para ejecutar run-dev.ps1 al iniciar sesión
$argMin = if ($Minimized) { '-Minimized' } else { '' }
$psArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$runDevPath`" $argMin"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $psArgs
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Principal: usuario actual, menor privilegio para evitar prompt admin
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

try {
  # Si existe, reemplazar
  $existing = $null
  try { $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop } catch {}
  if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
  }

  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Description "Arranca POS backend (5656) y frontend (5177) al iniciar sesión" | Out-Null
  Write-Host "[POS] Tarea creada: $taskName" -ForegroundColor Green
  Write-Host "[POS] Ejecutable: powershell.exe $psArgs" -ForegroundColor Green
  Write-Host "[POS] Se arrancará automáticamente al iniciar sesión." -ForegroundColor Cyan
} catch {
  Write-Error "[POS] Error registrando la tarea: $_"
  exit 1
}
