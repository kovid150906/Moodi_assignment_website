# Reset Database Script
# Drops and recreates the database with fresh schema

Write-Host "⚠️  DATABASE RESET WARNING" -ForegroundColor Red
Write-Host "This will DELETE ALL DATA in the certificate_system database!" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Are you sure you want to continue? (type 'yes' to confirm)"

if ($confirm -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor Gray
    exit
}

$rootDir = Split-Path -Parent $PSScriptRoot
$databaseDir = "$rootDir\database"

Push-Location $databaseDir

Write-Host ""
Write-Host "🗑️  Resetting database..." -ForegroundColor Cyan

node reset-db.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Database reset complete!" -ForegroundColor Green
    Write-Host ""
    
    $seedNow = Read-Host "Would you like to seed test data now? (y/n)"
    if ($seedNow -eq "y" -or $seedNow -eq "Y") {
        Write-Host ""
        node seed-test-data.js
        Write-Host ""
        Write-Host "✅ Test data seeded!" -ForegroundColor Green
    }
}
else {
    Write-Host "❌ Database reset failed!" -ForegroundColor Red
}

Pop-Location
