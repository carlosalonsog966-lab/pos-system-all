Write-Host "Kill script: closing web servers on ports 3000 and 3001" -ForegroundColor Cyan

function Stop-PortProcess {
  param([int]$Port)
  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
      foreach ($c in $connections) {
        $pid = $c.OwningProcess
        try {
          $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
          if ($proc) {
            Write-Host ("Stopping PID {0} ({1}) on port {2}" -f $pid, $proc.ProcessName, $Port) -ForegroundColor Yellow
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
          }
        } catch {}
      }
    } else {
      Write-Host ("No listeners on port {0}" -f $Port) -ForegroundColor Green
    }
  } catch {
    Write-Host ("Cannot inspect port {0}" -f $Port) -ForegroundColor DarkYellow
  }
}

Stop-PortProcess -Port 3000
Stop-PortProcess -Port 3001

Write-Host "Kill script done" -ForegroundColor Green
