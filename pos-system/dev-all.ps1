$ErrorActionPreference = "Stop"
$frontend = "c:\Users\Panda\Music\SISTEMA POS\SISTEMA\pos-system\frontend"
$backend = "c:\Users\Panda\Music\SISTEMA POS\SISTEMA\pos-system\backend"
$root = "c:\Users\Panda\Music\SISTEMA POS\SISTEMA\pos-system"

function Test-HttpReady {
  param(
    [string]$Url,
    [int]$MaxAttempts = 40,
    [int]$InitialDelayMs = 500,
    [int]$MaxDelayMs = 5000
  )
  $attempt = 0
  $delay = $InitialDelayMs
  while ($attempt -lt $MaxAttempts) {
    try {
      $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { return $true }
    } catch {}
    Start-Sleep -Milliseconds $delay
    $attempt++
    $delay = [Math]::Min([int]($delay * 1.6), $MaxDelayMs)
  }
  return $false
}

Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command npm run dev" -WorkingDirectory $backend
if (-not (Test-HttpReady -Url "http://localhost:5757/api/health")) { throw "Backend no disponible en http://localhost:5757/api/health" }

Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command npm run dev" -WorkingDirectory $frontend
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command npm run build" -WorkingDirectory $frontend
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command npm run preview" -WorkingDirectory $frontend
if (-not (Test-HttpReady -Url "http://localhost:5176/")) { throw "Preview no disponible en http://localhost:5176/" }

Start-Process -FilePath "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command npx tauri dev" -WorkingDirectory $root
