# Mieszko Ordering local API launcher. Run in PowerShell from any directory.
param([string]$DbHost = "127.0.0.1", [int]$DbPort = 5432, [string]$Database = "mieszko_office", [string]$DbUser = "postgres")
$ErrorActionPreference = "Stop"
function New-RandomHexToken {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is missing. Install Node.js LTS first." }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw "npm is missing. Install Node.js LTS first." }
$secure = Read-Host "Enter local PostgreSQL password for $DbUser (not saved)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$encodedUser = [Uri]::EscapeDataString($DbUser)
$encodedPassword = [Uri]::EscapeDataString($password)
Remove-Variable password -ErrorAction SilentlyContinue
$env:ORDERING_DATABASE_URL = "postgresql://${encodedUser}:${encodedPassword}@${DbHost}:${DbPort}/${Database}"
$env:ORDERING_API_PORT = "4317"
$env:ORDERING_API_TOKEN = New-RandomHexToken
$env:ORDERING_APPROVAL_TOKEN = New-RandomHexToken
Write-Host "Installing local API dependencies..."
& npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
Write-Host "Testing database connection through API..."
$proc = Start-Process -FilePath (Get-Command node).Source -ArgumentList "server.mjs" -WorkingDirectory $here -PassThru -NoNewWindow
try {
  $ready = $false
  for ($i=0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if ($proc.HasExited) { throw "API exited early. Review the server error above." }
    try {
      $result = Invoke-RestMethod -Uri "http://127.0.0.1:4317/health" -Headers @{Authorization="Bearer $env:ORDERING_API_TOKEN"} -TimeoutSec 2
      if ($result.ok) { $ready = $true; break }
    } catch {}
  }
  if (-not $ready) { throw "Database connection check failed. Check PostgreSQL service, password and port." }
  Write-Host "SUCCESS: Local ordering API connected to PostgreSQL database $Database." -ForegroundColor Green
  Write-Host "API running at http://127.0.0.1:4317 (localhost only). Press Ctrl+C to stop."
  while (-not $proc.HasExited) { Start-Sleep -Seconds 2 }
} finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue }
  Remove-Item Env:ORDERING_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:ORDERING_API_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:ORDERING_APPROVAL_TOKEN -ErrorAction SilentlyContinue
}
