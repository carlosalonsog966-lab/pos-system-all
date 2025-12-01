Param(
  [Parameter(Mandatory = $true)] [string] $RepoSlug,
  [Parameter(Mandatory = $false)] [string] $SlackWebhook,
  [Parameter(Mandatory = $false)] [string] $GithubToken
)

Write-Host "Configurando CI para repo: $RepoSlug" -ForegroundColor Cyan

if (-not $GithubToken) { $GithubToken = $env:GH_TOKEN }

# Verificar GitHub CLI (si está disponible)
$ghInstalled = $false
if (Get-Command gh -ErrorAction SilentlyContinue) { $ghInstalled = $true }
else { Write-Host "GitHub CLI no está instalado; usaré la API REST si hay token." -ForegroundColor Yellow }

if ($ghInstalled) {
  # Configurar repo por defecto para gh
  try {
    gh repo set-default $RepoSlug | Out-Null
    Write-Host "Repo por defecto configurado en gh: $RepoSlug" -ForegroundColor Green
  } catch {
    Write-Host "No se pudo establecer el repo por defecto en gh. Continuando..." -ForegroundColor Yellow
  }
}

# Añadir secreto de Slack si se proporciona (requiere gh)
if ($SlackWebhook) {
  if ($ghInstalled) {
    try {
      gh secret set VERIFY_SLACK_WEBHOOK_URL -b "$SlackWebhook" --repo $RepoSlug
      Write-Host "Secreto VERIFY_SLACK_WEBHOOK_URL añadido al repo." -ForegroundColor Green
    } catch {
      Write-Host "No se pudo añadir el secreto de Slack. Verifica permisos en el repo." -ForegroundColor Red
    }
  } elseif ($GithubToken) {
    Write-Host "Añadir secreto de Slack vía API REST requiere cifrado libsodium; realiza este paso desde la UI o instala gh." -ForegroundColor Yellow
  } else {
    Write-Host "No hay gh ni token; omitiendo la creación del secreto de Slack." -ForegroundColor Yellow
  }
} else {
  Write-Host "No se proporcionó SlackWebhook. Puedes añadirlo luego desde UI o con gh." -ForegroundColor Yellow
}

# Actualizar badges del README con el RepoSlug
try {
  $readmePath = Join-Path (Split-Path $PSCommandPath -Parent | Split-Path -Parent) 'README.md'
  if (Test-Path $readmePath) {
    $content = Get-Content $readmePath -Raw -ErrorAction Stop
    $updated = $content -replace 'https://github.com/OWNER/REPO', "https://github.com/$RepoSlug"
    if ($updated -ne $content) {
      Set-Content -Path $readmePath -Value $updated -Encoding UTF8
      Write-Host "README.md: badges actualizados con $RepoSlug" -ForegroundColor Green
    } else {
      Write-Host "README.md: ya estaba usando $RepoSlug o no se encontraron placeholders." -ForegroundColor Yellow
    }
  }
} catch {
  Write-Host "No se pudo actualizar el README: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Configurar protección de rama main con checks requeridos
try {
  $payload = @{ 
    required_status_checks = @{ 
      strict = $true; 
      contexts = @("Health Smoke CI", "Verify Alerts CI") 
    };
    enforce_admins = $true;
    required_pull_request_reviews = @{ 
      dismiss_stale_reviews = $true; 
      required_approving_review_count = 1 
    };
    restrictions = $null 
  } | ConvertTo-Json -Depth 6

  if ($ghInstalled) {
    $tmpFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tmpFile -Value $payload -Encoding UTF8
    gh api -X PUT "repos/$RepoSlug/branches/main/protection" -H "Accept: application/vnd.github+json" --input $tmpFile | Out-Null
    Remove-Item $tmpFile -Force
    Write-Host "Protección de rama 'main' actualizada (gh)." -ForegroundColor Green
  } elseif ($GithubToken) {
    $headers = @{ 
      Authorization = "Bearer $GithubToken";
      Accept = "application/vnd.github+json";
      'User-Agent' = "pos-setup-ci-script"
    }
    Invoke-RestMethod -Method Put -Uri "https://api.github.com/repos/$RepoSlug/branches/main/protection" -Headers $headers -Body $payload | Out-Null
    Write-Host "Protección de rama 'main' actualizada (REST)." -ForegroundColor Green
  } else {
    Write-Host "Sin gh y sin token, no es posible configurar protección de rama." -ForegroundColor Red
  }
} catch {
  Write-Host "No se pudo configurar la protección de rama. Verifica permisos del token y el slug del repo." -ForegroundColor Yellow
}

# Abrir páginas útiles del repo en el navegador
Write-Host "Abriendo configuración de protección de rama y workflows en el navegador..." -ForegroundColor Cyan
Start-Process "https://github.com/$RepoSlug/settings/branches"
Start-Process "https://github.com/$RepoSlug/actions/workflows/health-smoke.yml"
Start-Process "https://github.com/$RepoSlug/actions/workflows/verify-alerts.yml"

Write-Host "Checklist:" -ForegroundColor Cyan
Write-Host "1) En Branch protection, marca como required los checks de 'Health Smoke CI' y 'Verify Alerts CI'."
Write-Host "2) Verifica que los triggers (PR y push a main) están funcionando; puedes lanzar 'Run workflow' desde las páginas abiertas."
Write-Host "3) Revisa los artefactos publicados tras la ejecución." 

Write-Host "Listo. Si compartes el Slack webhook, este script ya lo dejó configurado." -ForegroundColor Green
