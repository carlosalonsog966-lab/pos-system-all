Param(
  [string]$BaseUrl,
  [string]$AdminUsername,
  [string]$AdminPassword,
  [int]$MaxToVerify = 3
)

$ErrorActionPreference = 'Stop'

# Paths
$RepoRoot = Split-Path -Path $PSScriptRoot -Parent
$CapturesDir = Join-Path $RepoRoot 'captures'
$LogsDir = Join-Path $RepoRoot 'logs'
$LogFile = Join-Path $LogsDir 'verification-final.txt'

function Ensure-Dirs {
  if (-not (Test-Path $CapturesDir)) { New-Item -Path $CapturesDir -ItemType Directory | Out-Null }
  if (-not (Test-Path $LogsDir)) { New-Item -Path $LogsDir -ItemType Directory | Out-Null }
}

function Write-Log([string]$Message) {
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$timestamp] $Message"
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

function Check-StatusArtifacts {
  $statusDir = Join-Path $RepoRoot 'pos-system/exports/status'
  $exportsDir = Join-Path $RepoRoot 'pos-system/exports'

  $checks = @(
    @{ Path = (Join-Path $statusDir 'index.html'); Label = 'status/index.html' },
    @{ Path = (Join-Path $statusDir 'endpoints.html'); Label = 'status/endpoints.html' },
    @{ Path = (Join-Path $exportsDir 'endpoints.yaml'); Label = 'exports/endpoints.yaml' },
    @{ Path = (Join-Path $exportsDir 'endpoints.csv'); Label = 'exports/endpoints.csv' },
    @{ Path = (Join-Path $exportsDir 'endpoints.jsonl'); Label = 'exports/endpoints.jsonl' },
    @{ Path = (Join-Path $statusDir 'contracts.html'); Label = 'status/contracts.html' },
    @{ Path = (Join-Path $statusDir 'contracts-diff.html'); Label = 'status/contracts-diff.html' }
  )

  Write-Log 'Verificando artefactos del status-dashboard...'
  foreach ($c in $checks) {
    $exists = Test-Path $c.Path
    $state = if ($exists) { 'OK' } else { 'MISSING' }
    Write-Log ("- ${state} ${c.Label}")
  }
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
  $content = 'Archivo de verificación generado automáticamente.'
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
  $base64 = [Convert]::ToBase64String($bytes)
  $body = @{ 
    filename = 'sample-verify.txt';
    mimeType = 'text/plain';
    dataBase64 = $base64;
    entityType = 'verification';
    entityId = 'script';
    metadata = @{ note = 'created by verify-files.ps1' } 
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
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $capturePath = Join-Path $CapturesDir "verify-$Id-$stamp.json"
  $json = $resp | ConvertTo-Json -Depth 5
  Set-Content -Path $capturePath -Value $json -Encoding utf8
  $resultText = if ($data.exists) { if ($data.match) { 'MATCH' } else { 'MISMATCH' } } else { 'MISSING' }
  Write-Log "ID=$Id path=$($data.path) checksumDb=$($data.checksumDb) checksumActual=$($data.checksumActual) resultado=$resultText"
}

try {
  Ensure-Dirs
  # Defaults from env or hardcoded
  if (-not $BaseUrl) { $BaseUrl = $env:POS_BASE_URL; if (-not $BaseUrl) { $BaseUrl = 'http://localhost:5656' } }
  if (-not $AdminUsername) {
    if ($env:POS_ADMIN_USERNAME) { $AdminUsername = $env:POS_ADMIN_USERNAME }
    elseif ($env:POS_ADMIN_EMAIL) { $AdminUsername = $env:POS_ADMIN_EMAIL }
    else { $AdminUsername = 'admin' }
  }
  if (-not $AdminPassword) { $AdminPassword = $env:POS_ADMIN_PASSWORD; if (-not $AdminPassword) { $AdminPassword = 'admin123' } }
  Write-Log '=== File Integrity Verification Script Started ==='
  Write-Log "BaseUrl=$BaseUrl"
  Check-StatusArtifacts
  $token = Get-Token
  $files = List-Files -Token $token

  if ($files.Count -eq 0) {
    $created = Upload-Sample -Token $token
    $files = List-Files -Token $token
  }

  $ids = @()
  foreach ($f in $files) {
    if ($ids.Count -ge $MaxToVerify) { break }
    if ($f.id) { $ids += $f.id }
  }

  if ($ids.Count -eq 0) {
    Write-Log 'No se encontraron IDs para verificar.'
  } else {
    Write-Log "Verificando IDs: $($ids -join ', ')"
    foreach ($id in $ids) { Verify-File -Token $token -Id $id }
  }

  Write-Log '=== File Integrity Verification Script Finished ==='
}
catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  throw
}
