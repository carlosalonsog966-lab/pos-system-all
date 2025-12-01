Param(
  [string]$TargetPath = "../src",
  [switch]$DryRun
)

Write-Host "Cleaning compiled TS artifacts in" $TargetPath

$root = Resolve-Path -Path $TargetPath
$patterns = @('*.js','*.d.ts','*.d.ts.map','*.js.map')

$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $name = $_.Name
  $dir = $_.DirectoryName
  # Skip node_modules and dist/build directories
  if ($dir -match "node_modules" -or $dir -match "\\dist\\" -or $dir -match "\\build\\") { return $false }
  # Only match files that look like TS compile outputs alongside .ts sources
  foreach ($p in $patterns) {
    if ($name -like $p) { return $true }
  }
  return $false
}

if ($DryRun) {
  Write-Host "[DryRun] Would remove" $files.Count "files"
  $files | ForEach-Object { Write-Host $_.FullName }
} else {
  $removed = 0
  foreach ($f in $files) {
    try {
      Remove-Item -Path $f.FullName -Force -ErrorAction Stop
      $removed++
    } catch {
      Write-Warning "Failed to remove: $($f.FullName) -> $($_.Exception.Message)"
    }
  }
  Write-Host "Removed" $removed "compiled artifacts."
}

Write-Host "Done."
