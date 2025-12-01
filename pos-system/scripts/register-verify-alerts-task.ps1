Param(
  [string]$NodePath,
  [int]$IntervalMinutes = 15
)

$ErrorActionPreference = 'Stop'

# Detectar ruta de node si no se proporciona
if (-not $NodePath) {
  try {
    $NodePath = (Get-Command node).Source
  } catch {
    Write-Host 'No se encontró node en PATH. Proporcione -NodePath.'
    exit 1
  }
}

$RepoRoot = Split-Path -Path $PSScriptRoot -Parent
$ScriptPath = Join-Path (Join-Path $RepoRoot 'launcher') 'file-verification-alerts.js'
$TaskName = 'POS_VerifyAlerts'
$StartBoundary = (Get-Date).ToString('s')
try {
  $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
} catch {
  # Fallback simple si el cmdlet no está disponible
  $Principal = $null
}

# Crear acción: node launcher/file-verification-alerts.js
$Action = New-ScheduledTaskAction -Execute $NodePath -Argument "`"$ScriptPath`""

# Trigger al iniciar sesión y repetición cada $IntervalMinutes
${Trigger1} = New-ScheduledTaskTrigger -AtLogOn
# Intento de crear un trigger con repetición cada N minutos (si el cmdlet existe)
$triggers = @($Trigger1)
try {
  $Trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1)
  # En algunos entornos este cmdlet no existe; si falla, usamos solo el trigger de logon
  $Trigger2.Repetition = New-ScheduledTaskRepetition -Interval (New-TimeSpan -Minutes $IntervalMinutes) -Duration ([TimeSpan]::MaxValue)
  $triggers += $Trigger2
} catch {
  Write-Host "Aviso: no se pudo configurar la repetición por ScheduledTask. Se iniciará al iniciar sesión y el script manejará la repetición interna."
}

# Registrar tarea en el Programador de Tareas (carpeta raíz, permisos limitados del usuario)
try {
  if ($Principal -ne $null) {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $triggers -Principal $Principal -Description 'Verificación periódica de integridad de archivos (POS)' -Force | Out-Null
  } else {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $triggers -Description 'Verificación periódica de integridad de archivos (POS)' -User $env:USERNAME -Force | Out-Null
  }
  Write-Host "Tarea registrada: $TaskName (logon + repetición si disponible; intervalo=$IntervalMinutes min)"
} catch {
  Write-Host "Error registrando tarea: $($_.Exception.Message)"
  exit 1
}
