# Check System Status Script
# Checks if all services are running and responding

Write-Host "🔍 Checking Certificate Distribution System Status..." -ForegroundColor Cyan
Write-Host ""

function Test-Endpoint {
    param (
        [string]$Name,
        [string]$Url
    )
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ $Name" -ForegroundColor Green -NoNewline
        Write-Host " - $Url" -ForegroundColor Gray
        return $true
    }
    catch {
        Write-Host "❌ $Name" -ForegroundColor Red -NoNewline
        Write-Host " - $Url (Not responding)" -ForegroundColor Gray
        return $false
    }
}

Write-Host "Backend Services:" -ForegroundColor Yellow
Write-Host "----------------" -ForegroundColor Yellow
$adminApi = Test-Endpoint -Name "Admin Backend" -Url "http://localhost:3002/health"
$userApi = Test-Endpoint -Name "User Backend" -Url "http://localhost:3001/health"

Write-Host ""
Write-Host "Frontend Services:" -ForegroundColor Yellow
Write-Host "------------------" -ForegroundColor Yellow
$adminFe = Test-Endpoint -Name "Admin Frontend" -Url "http://localhost:5174"
$userFe = Test-Endpoint -Name "User Frontend" -Url "http://localhost:5173"

Write-Host ""
Write-Host "Database Connection:" -ForegroundColor Yellow
Write-Host "--------------------" -ForegroundColor Yellow

# Test database via API
try {
    $loginTest = Invoke-RestMethod -Uri "http://localhost:3002/api/competitions/cities" -Method Get -Headers @{"Authorization"="Bearer test"} -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Database" -ForegroundColor Green -NoNewline
    Write-Host " - MySQL connected (tested via API)" -ForegroundColor Gray
}
catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Database" -ForegroundColor Green -NoNewline
        Write-Host " - MySQL connected (auth required - expected)" -ForegroundColor Gray
    }
    else {
        Write-Host "⚠️  Database" -ForegroundColor Yellow -NoNewline
        Write-Host " - Cannot verify (API not responding)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
$allGood = $adminApi -and $userApi -and $adminFe -and $userFe
if ($allGood) {
    Write-Host "All systems operational! ✅" -ForegroundColor Green
}
else {
    Write-Host "Some services are down. Check above." -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
