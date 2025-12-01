# Pruebas de ventas (PowerShell)
# Uso: powershell -ExecutionPolicy Bypass -File scripts/test-sales.ps1

param(
  [string]$Username = "admin",
  [string]$Password = "admin123"
)

$BaseUrl = if ($env:PORT) { "http://localhost:$($env:PORT)/api" } else { "http://localhost:5656/api" }

function Invoke-ApiGet {
  param(
    [string]$Path,
    [string]$Token
  )
  $headers = @{ Authorization = "Bearer $Token" }
  return Invoke-RestMethod -Uri "$BaseUrl$Path" -Headers $headers -Method Get -ErrorAction Stop
}

function Invoke-ApiGetRaw {
  param(
    [string]$Path,
    [string]$Token
  )
  $headers = @{ Authorization = "Bearer $Token" }
  return Invoke-WebRequest -Uri "$BaseUrl$Path" -Headers $headers -Method Get -ErrorAction Stop
}

function Invoke-ApiPost {
  param(
    [string]$Path,
    [string]$Token,
    [object]$Body
  )
  $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
  $json = if ($Body) { $Body | ConvertTo-Json -Depth 8 } else { $null }
  return Invoke-RestMethod -Uri "$BaseUrl$Path" -Headers $headers -Method Post -Body $json -ErrorAction Stop
}

function Login {
  param(
    [string]$U,
    [string]$P
  )
  $body = @{ username = $U; password = $P } | ConvertTo-Json
  $res = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop
  $token = $res.token
  if (-not $token) { $token = $res.accessToken }
  if (-not $token) { $token = $res.access_token }
  if (-not $token -and $res.data) { $token = $res.data.token }
  if (-not $token) { throw "No se encontró token en respuesta de login: $($res | ConvertTo-Json -Depth 6)" }
  return $token
}

try {
  Write-Host "Iniciando pruebas de ventas (PowerShell)" -ForegroundColor Cyan
  $token = Login -U $Username -P $Password
  Write-Host "Token obtenido" -ForegroundColor Green

  # 1) Salud de ventas
  $health = Invoke-ApiGet -Path "/sales/health" -Token $token
  if ($health.status -ne "ok") { throw "Salud de ventas no es ok" }
  Write-Host "/sales/health OK (dbLatencyMs=$($health.dbLatencyMs))" -ForegroundColor Green

  # 2) Métricas de ventas (últimos 7 días)
  $metrics = Invoke-ApiGet -Path "/sales/metrics?days=7" -Token $token
  if (-not $metrics.summary) { throw "Métricas de ventas sin summary" }
  Write-Host "/sales/metrics OK (avgTicket=$([math]::Round($metrics.summary.averageTicket,2)))" -ForegroundColor Green

  # 3) Exportación CSV de ventas por periodo
  $start = (Get-Date).AddDays(-7).ToString("o")
  $end = (Get-Date).ToString("o")
  $csvResp = Invoke-ApiGetRaw -Path "/reports/export/csv?reportType=sales&dataset=byPeriod&startDate=$([uri]::EscapeDataString($start))&endDate=$([uri]::EscapeDataString($end))&groupBy=day" -Token $token
  $csvText = $csvResp.Content
  if (-not ($csvText -match "period,sales,count,total")) {
    throw "CSV de ventas no contiene cabeceras esperadas"
  }
  Write-Host "CSV /reports/export/csv?reportType=sales OK" -ForegroundColor Green

  Write-Host "Pruebas de ventas completadas" -ForegroundColor Cyan
  exit 0
}
catch {
  Write-Host "Error en pruebas de ventas: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails) { Write-Host ($_.ErrorDetails.Message) }
  exit 1
}

