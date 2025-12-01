Param(
  [string]$ApiBaseUrl = "http://localhost:5656/api",
  [string]$Username = "admin",
  [string]$Password = "admin123"
)

Write-Host "CSV Smoke (PowerShell) base=$ApiBaseUrl"

function Invoke-JsonPost($Url, $Body) {
  return Invoke-WebRequest -Uri $Url -Method POST -ContentType 'application/json' -Body ($Body | ConvertTo-Json) -UseBasicParsing
}

function Get-Token() {
  try {
    $resp = Invoke-JsonPost "$ApiBaseUrl/auth/login" @{ username = $Username; password = $Password }
    $json = $resp.Content | ConvertFrom-Json
    $token = $json.token
    if (-not $token) { $token = $json.accessToken }
    if (-not $token) { $token = $json.access_token }
    if (-not $token) { $token = $json.data.token }
    return $token
  } catch {
    Write-Error "Login failed: $($_.Exception.Message)"
    return $null
  }
}

$token = Get-Token
if (-not $token) { exit 1 }
Write-Host "Token acquired: $($token.Substring(0,12))..."

function Test-CsvEndpoint($Name, $Path, $RequiresAuth=$true) {
  $Url = ("$ApiBaseUrl$Path")
  $Headers = @{}
  if ($RequiresAuth) { $Headers['Authorization'] = "Bearer $token" }
  try {
    $resp = Invoke-WebRequest -Uri $Url -Headers $Headers -Method GET -UseBasicParsing
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($resp.Content)
    $hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    $ct = $resp.Headers['Content-Type']
    $cl = $resp.Headers['Content-Length']
    $cc = $resp.Headers['Cache-Control']
    $pragma = $resp.Headers['Pragma']
    $expires = $resp.Headers['Expires']
    $xcto = $resp.Headers['X-Content-Type-Options']
    $cd = $resp.Headers['Content-Disposition']
    $lengthMatches = $null
    if ($cl) { $lengthMatches = ([int]$cl -eq $bytes.Length) }
    $ok = ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300 -and ($ct -like 'text/csv*') -and $hasBOM -and ($cc -like '*no-cache*') -and ($xcto -eq 'nosniff'))
    $emoji = if ($ok) { '✅' } else { '❌' }
    Write-Host "`n$emoji $Name ($($resp.StatusCode))`nURL: $Url"
    Write-Host "- BOM: " ($hasBOM ? 'present (EF BB BF)' : 'missing')
    Write-Host "- Content-Type: $ct"
    Write-Host "- Content-Length: $cl " ($lengthMatches -eq $true ? '(matches)' : ($lengthMatches -eq $false ? '(mismatch)' : ''))
    Write-Host "- Cache-Control: $cc"
    Write-Host "- Pragma: $pragma"
    Write-Host "- Expires: $expires"
    Write-Host "- X-Content-Type-Options: $xcto"
    Write-Host "- Content-Disposition: $cd"
    return $ok
  } catch {
    Write-Error "Request failed for $Name: $($_.Exception.Message)"
    return $false
  }
}

$results = @(
  (Test-CsvEndpoint 'Audit refunds CSV' '/audit/refunds/export.csv' $true),
  (Test-CsvEndpoint 'Sales export CSV' '/sales/export/csv' $true),
  (Test-CsvEndpoint 'Inventory report (summary) CSV' '/inventory/report?format=csv&dataset=summary' $true),
  (Test-CsvEndpoint 'Files integrity CSV' '/files/integrity/export/csv' $true),
  (Test-CsvEndpoint 'Endpoints catalog CSV' '/meta/endpoints?format=csv&download=1' $false)
)

if ($results -contains $false) {
  Write-Error "`nCSV Smoke completed with failure(s)."
  exit 1
}

Write-Host "`nCSV Smoke passed: all checks OK."
exit 0

