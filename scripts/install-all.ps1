# Install All Dependencies Script
# Installs npm dependencies for all projects

Write-Host "📦 Installing all dependencies..." -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot

$projects = @(
    @{ Name = "Backend Admin"; Path = "$rootDir\backend-admin" },
    @{ Name = "Backend User"; Path = "$rootDir\backend-user" },
    @{ Name = "Frontend Admin"; Path = "$rootDir\frontend-admin" },
    @{ Name = "Frontend User"; Path = "$rootDir\frontend-user" },
    @{ Name = "Database Scripts"; Path = "$rootDir\database" }
)

foreach ($project in $projects) {
    Write-Host "Installing $($project.Name)..." -ForegroundColor Yellow
    Push-Location $project.Path
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $($project.Name) - Done" -ForegroundColor Green
    }
    else {
        Write-Host "❌ $($project.Name) - Failed" -ForegroundColor Red
    }
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All dependencies installed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Configure MySQL (update passwords in .env files if needed)" -ForegroundColor Gray
Write-Host "  2. Run: .\scripts\seed-database.ps1" -ForegroundColor Gray
Write-Host "  3. Run: .\scripts\start-all.ps1" -ForegroundColor Gray
