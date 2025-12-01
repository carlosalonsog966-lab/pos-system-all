Param(
  [string]$BaseUrl,
  [string]$AdminUsername,
  [string]$AdminPassword,
  [int]$MaxCount = 0,
  [string]$OutputCsvPath,
  [switch]$Append,
  [switch]$OnlyMismatches
)

$ErrorActionPreference = 'Stop'

# Paths
$RepoRoot = Split-Path -Path $PSScriptRoot -Parent
$ExportsDir = Join-Path $RepoRoot 'exports'
$LogsDir = Join-Path $RepoRoot 'logs'
if (-not $OutputCsvPath) { $OutputCsvPath = Join-Path $ExportsDir 'verification-report.csv' }
$LogFile = Join-Path $LogsDir 'verification-final.txt'

function Ensure-Dirs {
  foreach ($dir in @($ExportsDir, $LogsDir)) {
    if (-not (Test-Path $dir)) { New-Item -Path $dir -ItemType Directory | Out-Null }
  }
}

function Write-Log([string]$Message) {
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$timestamp] $Message"
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

function Get-Token {
  Write-Log "Solicitando token de acceso para '$AdminUsername' en $BaseUrl..."
  $loginBody = @{ username = $AdminUsername; password = $AdminPassword } | ConvertTo-Json
  $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType 'application/json' -Body $loginBody
  if (-not $resp.success) { throw "Login fallido: $($resp | ConvertTo-Json -Compress)" }
  $token = $resp.data.token
  if (-not $token) { throw 'Token no presente en respuesta de login' }
  Write-Log "Token adquirido correctamente."
  return $token
}

function List-Files([string]$Token) {
  $headers = @{ Authorization = "Bearer $Token" }
  $resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/files" -Headers $headers
  if (-not $resp.success) { throw "Listado fallido: $($resp | ConvertTo-Json -Compress)" }
  $files = @($resp.data)
  Write-Log "Archivos encontrados: $($files.Count)"
  return $files
}

function Upload-Sample([string]$Token) {
  Write-Log 'No hay archivos. Subiendo archivo de ejemplo...'
  $headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }
  $content = 'Archivo de verificación por lote.'
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
  $base64 = [Convert]::ToBase64String($bytes)
  $body = @{ 
    filename = 'sample-verify-batch.txt';
    mimeType = 'text/plain';
    dataBase64 = $base64;
    entityType = 'verification';
    entityId = 'batch-script';
    metadata = @{ note = 'created by verify-files-batch.ps1' } 
  } | ConvertTo-Json
  $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/files" -Headers $headers -Body $body
  if (-not $resp.success) { throw "Subida de ejemplo fallida: $($resp | ConvertTo-Json -Compress)" }
  Write-Log "Ejemplo subido: id=$($resp.data.id) filename=$($resp.data.filename)"
  return $resp.data
}

function Verify-File([string]$Token, [string]$Id) {
  $headers = @{ Authorization = "Bearer $Token" }
  $resp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/files/$Id/verify" -Headers $headers -ErrorAction Stop
  if (-not $resp.success) { throw "Verificación fallida para ${Id}: $($resp | ConvertTo-Json -Compress)" }
  $data = $resp.data
  $status = if ($data.exists) { if ($data.match) { 'MATCH' } else { 'MISMATCH' } } else { 'MISSING' }
  return [PSCustomObject]@{
    id = $data.id
    path = $data.path
    exists = $data.exists
    checksumDb = $data.checksumDb
    checksumActual = $data.checksumActual
    match = $data.match
    status = $status
  }
}

function Export-VerificationCsv([array]$rows, [string]$path, [switch]$append) {
  if (-not $rows -or $rows.Count -eq 0) {
    if ($append -and (Test-Path $path)) {
      return
    }
    $header = '"id","path","exists","checksumDb","checksumActual","match","status"'
    Set-Content -Path $path -Value $header -Encoding utf8
    return
  }
  $csv = $rows | ConvertTo-Csv -NoTypeInformation
  if ($append -and (Test-Path $path)) {
    $csvNoHeader = $csv | Select-Object -Skip 1
    Add-Content -Path $path -Value $csvNoHeader
  } else {
    Set-Content -Path $path -Value $csv -Encoding utf8
  }
}

try {
  Ensure-Dirs
  if (-not $BaseUrl) { $BaseUrl = $env:POS_BASE_URL; if (-not $BaseUrl) { $BaseUrl = 'http://localhost:5656' } }
  if (-not $AdminUsername) {
    if ($env:POS_ADMIN_USERNAME) { $AdminUsername = $env:POS_ADMIN_USERNAME }
    elseif ($env:POS_ADMIN_EMAIL) { $AdminUsername = $env:POS_ADMIN_EMAIL }
    else { $AdminUsername = 'admin' }
  }
  if (-not $AdminPassword) { $AdminPassword = $env:POS_ADMIN_PASSWORD; if (-not $AdminPassword) { $AdminPassword = 'admin123' } }

  Write-Log '=== Batch File Integrity Verification Started ==='
  Write-Log "BaseUrl=$BaseUrl"
  $startTime = Get-Date

  $token = Get-Token
  $files = List-Files -Token $token
  if ($files.Count -eq 0) {
    Upload-Sample -Token $token | Out-Null
    $files = List-Files -Token $token
  }

  if ($MaxCount -gt 0) {
    $files = $files | Select-Object -First $MaxCount
    Write-Log "Limitando a $MaxCount archivos para verificación."
  }

  $rows = @()
  $i = 0
  foreach ($f in $files) {
    $i++
    Write-Log "[$i/$($files.Count)] Verificando ID=$($f.id) ($($f.filename))"
    try {
      $row = Verify-File -Token $token -Id $f.id
      $rows += $row
      Write-Log "  -> status=$($row.status) path=$($row.path)"
    } catch {
      Write-Log "  -> ERROR verificando $($f.id): $($_.Exception.Message)"
      $rows += [PSCustomObject]@{
        id = $f.id; path = $f.path; exists = $false; checksumDb = $f.checksum; checksumActual = $null; match = $false; status = 'ERROR'
      }
    }
  }

  if ($OnlyMismatches) {
    $before = $rows.Count
    $rows = $rows | Where-Object { (-not $_.match) -or ($_.status -eq 'MISMATCH') -or (-not $_.exists) }
    Write-Log "Filtrando solo discrepancias: $($rows.Count) de $before filas."
  }

  # Exportar CSV en UTF-8 (con soporte de append)
  Export-VerificationCsv -rows $rows -path $OutputCsvPath -append:$Append
  Write-Log "Reporte CSV generado en: $OutputCsvPath"

  # Resumen por lote y exportación a JSON para observabilidad
  $total = $rows.Count
  $matches = ($rows | Where-Object { $_.status -eq 'MATCH' }).Count
  $mismatches = ($rows | Where-Object { $_.status -eq 'MISMATCH' }).Count
  $missing = ($rows | Where-Object { $_.status -eq 'MISSING' }).Count
  $errors = ($rows | Where-Object { $_.status -eq 'ERROR' }).Count
  $endTime = Get-Date
  $durationMs = [math]::Round((New-TimeSpan -Start $startTime -End $endTime).TotalMilliseconds)

  $summary = [PSCustomObject]@{
    timestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')
    baseUrl = $BaseUrl
    append = [bool]$Append
    onlyMismatches = [bool]$OnlyMismatches
    csvPath = $OutputCsvPath
    counts = [PSCustomObject]@{
      total = $total
      match = $matches
      mismatch = $mismatches
      missing = $missing
      error = $errors
    }
    durationMs = $durationMs
  }

  $summaryJson = $summary | ConvertTo-Json -Depth 6
  $summaryPath = Join-Path $ExportsDir 'verification-summary.json'
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $summaryPathStamped = Join-Path $ExportsDir ("verification-summary-" + $stamp + ".json")
  Set-Content -Path $summaryPath -Value $summaryJson -Encoding utf8
  Set-Content -Path $summaryPathStamped -Value $summaryJson -Encoding utf8
  Write-Log ("Resumen: total=" + $total + " match=" + $matches + " mismatch=" + $mismatches + " missing=" + $missing + " error=" + $errors + " durationMs=" + $durationMs)
  Write-Log ("Resumen JSON: " + $summaryPath + " (también: " + $summaryPathStamped + ")")
  Write-Log '=== Batch File Integrity Verification Finished ==='
}
catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  throw
}
