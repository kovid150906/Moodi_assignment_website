# Start All Services Script
# This script starts all backend and frontend services for the Certificate Distribution System

Write-Host "🚀 Starting Certificate Distribution System..." -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot

# Start Backend Admin (Port 3002)
Write-Host "Starting Admin Backend on port 3002..." -ForegroundColor Yellow
$adminBackend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\backend-admin'; npm run dev" -PassThru
Write-Host "✅ Admin Backend started (PID: $($adminBackend.Id))" -ForegroundColor Green

Start-Sleep -Seconds 2

# Start Backend User (Port 3001)
Write-Host "Starting User Backend on port 3001..." -ForegroundColor Yellow
$userBackend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\backend-user'; npm run dev" -PassThru
Write-Host "✅ User Backend started (PID: $($userBackend.Id))" -ForegroundColor Green

Start-Sleep -Seconds 2

# Start Frontend Admin (Port 5174)
Write-Host "Starting Admin Frontend on port 5174..." -ForegroundColor Yellow
$adminFrontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\frontend-admin'; npm run dev" -PassThru
Write-Host "✅ Admin Frontend started (PID: $($adminFrontend.Id))" -ForegroundColor Green

Start-Sleep -Seconds 2

# Start Frontend User (Port 5173)
Write-Host "Starting User Frontend on port 5173..." -ForegroundColor Yellow
$userFrontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\frontend-user'; npm run dev" -PassThru
Write-Host "✅ User Frontend started (PID: $($userFrontend.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All services started successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor White
Write-Host "  User Portal:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Admin Portal:   http://localhost:5174" -ForegroundColor Cyan
Write-Host "  User API:       http://localhost:3001" -ForegroundColor Gray
Write-Host "  Admin API:      http://localhost:3002" -ForegroundColor Gray
Write-Host ""
Write-Host "Default Credentials:" -ForegroundColor White
Write-Host "  Admin:  admin@test.com / admin123" -ForegroundColor Yellow
Write-Host "  User:   aarav.sharma1@test.com / user123" -ForegroundColor Yellow
Write-Host ""
