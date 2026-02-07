# Seed Database Script  
# Populates the database with test data

Write-Host "🌱 Seeding database with test data..." -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot
$databaseDir = "$rootDir\database"

Push-Location $databaseDir

Write-Host "Running seed-test-data.js..." -ForegroundColor Yellow
node seed-test-data.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Database seeded successfully! ✅" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Test Credentials:" -ForegroundColor White
    Write-Host ""
    Write-Host "  ADMIN ACCOUNTS:" -ForegroundColor Yellow
    Write-Host "    admin@test.com / admin123 (Super Admin)" -ForegroundColor Gray
    Write-Host "    admin@system.com / Admin@123 (System Admin)" -ForegroundColor Gray
    Write-Host "    delhi.coord@test.com / coord123 (Coordinator)" -ForegroundColor Gray
    Write-Host "    mumbai.coord@test.com / coord123 (Coordinator)" -ForegroundColor Gray
    Write-Host "    bangalore.coord@test.com / coord123 (Coordinator)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  USER ACCOUNTS:" -ForegroundColor Yellow
    Write-Host "    aarav.sharma1@test.com / user123 (MI000001)" -ForegroundColor Gray
    Write-Host "    vivaan.patel2@test.com / user123 (MI000002)" -ForegroundColor Gray
    Write-Host "    ... (50 users total, MI000001, MI000050)" -ForegroundColor Gray
}
else {
    Write-Host "❌ Database seeding failed!" -ForegroundColor Red
}

Pop-Location
