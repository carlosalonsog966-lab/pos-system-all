# Pruebas de inventario (PowerShell)
# Uso: powershell -ExecutionPolicy Bypass -File scripts/test-inventory.ps1

param(
  [string]$Username = "admin",
  [string]$Password = "admin123"
)

$BaseUrl = if ($env:PORT) { "http://localhost:$($env:PORT)/api" } else { "http://localhost:5656/api" }
$BranchId = $env:BRANCH_ID

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

function Ensure-TestProduct {
  param(
    [string]$Token
  )
  $list = Invoke-ApiGet -Path "/products?limit=1" -Token $Token
  if ($list -and $list.data -and $list.data.Count -gt 0 -and $list.data[0].id) {
    return $list.data[0].id
  }

  $suffix = (Get-Date).ToFileTime().ToString().Substring(10)
  $body = @{ 
    code = "TEST-INV-$suffix";
    name = "Producto Inventario";
    description = "Creado para pruebas automáticas de inventario";
    category = "Otros";
    material = "Plata";
    purchasePrice = 50;
    salePrice = 80;
    stock = 5;
    minStock = 2;
    gender = "unisex";
  }
  $created = Invoke-ApiPost -Path "/products" -Token $Token -Body $body
  if (-not $created.data -or -not $created.data.id) { throw "Fallo al crear producto: $($created | ConvertTo-Json -Depth 6)" }
  return $created.data.id
}

try {
  Write-Host "Iniciando pruebas de inventario (PowerShell)" -ForegroundColor Cyan
  $token = Login -U $Username -P $Password
  Write-Host "Token obtenido" -ForegroundColor Green

  $productId = Ensure-TestProduct -Token $token
  Write-Host "Producto de prueba: $productId" -ForegroundColor Yellow

  # 1) Stats
  $stats = Invoke-ApiGet -Path "/inventory/stats?period=30d" -Token $token
  Write-Host "/inventory/stats OK" -ForegroundColor Green

  # 2) Reporte
  $start = (Get-Date).AddDays(-7).ToString("o")
  $end = (Get-Date).ToString("o")
  $report = Invoke-ApiGet -Path "/inventory/report?startDate=$([uri]::EscapeDataString($start))&endDate=$([uri]::EscapeDataString($end))" -Token $token
  Write-Host "/inventory/report OK" -ForegroundColor Green

  # 2.1) Salud de inventario
  $health = Invoke-ApiGet -Path "/inventory/health" -Token $token
  Write-Host "/inventory/health OK" -ForegroundColor Green

  # 2.2) Métricas de inventario
  $metrics = Invoke-ApiGet -Path "/inventory/metrics" -Token $token
  Write-Host "/inventory/metrics OK" -ForegroundColor Green

  # 2.3) Exportación CSV de alertas
  $csvResp = Invoke-ApiGetRaw -Path "/inventory/report?startDate=$([uri]::EscapeDataString($start))&endDate=$([uri]::EscapeDataString($end))&format=csv&dataset=alerts" -Token $token
  $csvText = $csvResp.Content
  if (-not ($csvText -match "productId,productCode,productName")) {
    throw "CSV de alertas no contiene cabeceras esperadas"
  }
  Write-Host "CSV /inventory/report?dataset=alerts OK" -ForegroundColor Green

  # 3) Low stock
  $low = Invoke-ApiGet -Path "/inventory/low-stock?limit=10" -Token $token
  Write-Host "/inventory/low-stock OK" -ForegroundColor Green

  # 4) Historial
  $hist = Invoke-ApiGet -Path "/inventory/products/$productId/history?page=1&limit=10" -Token $token
  Write-Host "/inventory/products/:id/history OK" -ForegroundColor Green

  # 5) Movimientos IN y OUT
  $inBody = @{ 
    productId = $productId; type = "in"; quantity = 3; reason = "Ingreso de prueba"; reference = "TEST-IN"; notes = "Prueba automática"; 
    idempotencyKey = "IN-$(Get-Date -Format yyyyMMddHHmmss)-$([System.Guid]::NewGuid().ToString().Substring(0,8))" 
  }
  $updIn = Invoke-ApiPost -Path "/inventory/update-stock" -Token $token -Body $inBody
  Write-Host "IN /inventory/update-stock OK" -ForegroundColor Green

  $outBody = @{ 
    productId = $productId; type = "out"; quantity = 2; reason = "Salida de prueba"; reference = "TEST-OUT"; notes = "Prueba automática"; 
    idempotencyKey = "OUT-$(Get-Date -Format yyyyMMddHHmmss)-$([System.Guid]::NewGuid().ToString().Substring(0,8))" 
  }
  $updOut = Invoke-ApiPost -Path "/inventory/update-stock" -Token $token -Body $outBody
  Write-Host "OUT /inventory/update-stock OK" -ForegroundColor Green

  # 6) Balance (opcional branchId)
  $balancePath = "/inventory/products/$productId/balance"
  if ($BranchId) { $balancePath = "$balancePath?branchId=$BranchId" }
  $balance = Invoke-ApiGet -Path $balancePath -Token $token
  Write-Host "/inventory/products/:id/balance OK" -ForegroundColor Green

  # 7) Reconciliar producto (opcional branchId)
  $reconcileProductBody = if ($BranchId) { @{ branchId = $BranchId } } else { $null }
  $reconcileProduct = Invoke-ApiPost -Path "/inventory/products/$productId/reconcile" -Token $token -Body $reconcileProductBody
  Write-Host "POST /inventory/products/:id/reconcile OK" -ForegroundColor Green

  # 8) Reconciliación global (opcional branchId)
  $reconcileAllBody = if ($BranchId) { @{ branchId = $BranchId } } else { $null }
  $reconcileAll = Invoke-ApiPost -Path "/inventory/reconcile" -Token $token -Body $reconcileAllBody
  Write-Host "POST /inventory/reconcile OK" -ForegroundColor Green

  Write-Host "Pruebas de inventario completadas" -ForegroundColor Cyan
  exit 0
}
catch {
  Write-Host "Error en pruebas de inventario: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails) { Write-Host ($_.ErrorDetails.Message) }
  exit 1
}
