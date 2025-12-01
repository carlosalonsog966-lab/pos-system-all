param(
  [string]$TaskName = 'POS Health Smoke',
  [string]$Schedule = 'Daily',
  [string]$StartTime = '09:00'
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Runner = Join-Path $ScriptDir 'run-health-smoke-once.ps1'

if (-not (Test-Path $Runner)) {
  Write-Error "Runner no encontrado: $Runner"
  exit 1
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`""

try {
  $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
} catch {
  $Principal = $null
}

switch ($Schedule) {
  'Daily' { $trigger = New-ScheduledTaskTrigger -Daily -At $StartTime }
  'Hourly' { $trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddHours(1)) }
  default { $trigger = New-ScheduledTaskTrigger -Daily -At $StartTime }
}

if ($Principal -ne $null) {
  Register-ScheduledTask -Action $action -Trigger $trigger -TaskName $TaskName -Principal $Principal -Description 'Ejecuta smoke de salud con CORS estricto' -Force | Out-Null
} else {
  Register-ScheduledTask -Action $action -Trigger $trigger -TaskName $TaskName -Description 'Ejecuta smoke de salud con CORS estricto' -Force | Out-Null
}
Write-Host "Tarea programada '$TaskName' registrada."
