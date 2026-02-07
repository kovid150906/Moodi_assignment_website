# Backup Database Script
# Creates a SQL dump of the certificate_system database

Write-Host "💾 Backing up database..." -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot
$backupDir = "$rootDir\backups"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\certificate_system_$timestamp.sql"

# Create backup directory if it doesn't exist
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

# MySQL credentials (update these if different)
$mysqlUser = "root"
$mysqlPassword = "kb@8370007067"
$database = "certificate_system"

Write-Host "Database: $database" -ForegroundColor Gray
Write-Host "Output: $backupFile" -ForegroundColor Gray
Write-Host ""

try {
    # Try to run mysqldump
    $env:MYSQL_PWD = $mysqlPassword
    mysqldump -u $mysqlUser $database > $backupFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $size = (Get-Item $backupFile).Length / 1KB
        Write-Host "✅ Backup created successfully!" -ForegroundColor Green
        Write-Host "   Size: $([math]::Round($size, 2)) KB" -ForegroundColor Gray
    }
    else {
        Write-Host "❌ Backup failed!" -ForegroundColor Red
        Write-Host "   Make sure mysqldump is in your PATH" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host "   Make sure MySQL is installed and mysqldump is in your PATH" -ForegroundColor Yellow
}
finally {
    $env:MYSQL_PWD = ""
}
