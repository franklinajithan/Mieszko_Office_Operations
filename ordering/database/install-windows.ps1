param(
  [string]$Database = "mieszko_ordering",
  [string]$DbUser = "postgres",
  [string]$Psql = "psql"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$setup = Join-Path $root "MIESZKO_ORDERING_FULL_SETUP.sql"
$verify = Join-Path $root "VERIFY_SETUP.sql"
if (-not (Test-Path $setup) -or -not (Test-Path $verify)) { throw "SQL files not found in $root" }
Write-Host "Installing Mieszko ordering schema into database '$Database'..."
& $Psql -X -v ON_ERROR_STOP=1 -U $DbUser -d $Database -f $setup
if ($LASTEXITCODE -ne 0) { throw "Database installation failed (exit $LASTEXITCODE)." }
Write-Host "Verifying schema..."
& $Psql -X -v ON_ERROR_STOP=1 -U $DbUser -d $Database -f $verify
if ($LASTEXITCODE -ne 0) { throw "Database verification failed (exit $LASTEXITCODE)." }
Write-Host "Schema installation and verification completed."
