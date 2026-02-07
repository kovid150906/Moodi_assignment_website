# Test API Script
# Tests all API endpoints to verify system functionality

Write-Host "🧪 Running API Tests..." -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot
$scriptsDir = "$rootDir\scripts"

node "$scriptsDir\test-api.js"
