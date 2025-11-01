# Quick Test Script for CLI → Dashboard Integration (PowerShell)

Write-Host "🧪 Testing CLI → Dashboard Integration" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if dashboard is running
Write-Host "1. Checking if dashboard is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✅ Dashboard is running on http://localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Dashboard not running. Start it with:" -ForegroundColor Yellow
    Write-Host "      cd apps/dashboard && npm run dev" -ForegroundColor Gray
    exit 1
}

# Step 2: Test CLI scan (local only)
Write-Host ""
Write-Host "2. Testing CLI scan (local only)..." -ForegroundColor Yellow
Push-Location test-prisma-project
try {
    npx devsync scan
} catch {
    Write-Host "   ⚠️  CLI scan failed. Make sure CLI is built: cd packages/cli && npm run build" -ForegroundColor Yellow
}
Pop-Location

# Step 3: Check if config exists
Write-Host ""
Write-Host "3. Checking CLI config..." -ForegroundColor Yellow
$configPath = "test-prisma-project\.devsync\config.json"
if (Test-Path $configPath) {
    Write-Host "   ✅ Config file exists" -ForegroundColor Green
    $config = Get-Content $configPath | ConvertFrom-Json
    
    $hasProjectId = $config.project.id -and $config.project.id -ne ""
    $hasApiUrl = $config.api.url -and $config.api.url -ne ""
    $hasApiKey = $config.api.key -and $config.api.key -ne ""
    
    if ($hasProjectId -and $hasApiUrl -and $hasApiKey) {
        Write-Host "   ✅ Config has project ID, API URL, and API key" -ForegroundColor Green
        Write-Host "   Project ID: $($config.project.id)" -ForegroundColor Gray
        Write-Host "   API URL: $($config.api.url)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Config needs project ID and API settings" -ForegroundColor Yellow
        Write-Host "   Edit $configPath to add:" -ForegroundColor Gray
        Write-Host "     - project.id (from dashboard URL)" -ForegroundColor Gray
        Write-Host "     - api.url (http://localhost:3000)" -ForegroundColor Gray
        Write-Host "     - api.key (JWT token from browser cookie)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ⚠️  Config file not found. Run: cd test-prisma-project && devsync init" -ForegroundColor Yellow
}

# Step 4: Test with cloud sync (if configured)
Write-Host ""
Write-Host "4. Ready to test cloud sync!" -ForegroundColor Yellow
Write-Host "   If config is set up, run:" -ForegroundColor Gray
Write-Host "     cd test-prisma-project" -ForegroundColor Gray
Write-Host "     devsync scan" -ForegroundColor Gray

Write-Host ""
Write-Host "✅ Test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Visit http://localhost:3000 to see dashboard" -ForegroundColor White
Write-Host "  2. Sign up / Log in" -ForegroundColor White
Write-Host "  3. Create a project and copy its ID from the URL" -ForegroundColor White
Write-Host "  4. Get JWT token from browser cookies (DevTools > Application > Cookies)" -ForegroundColor White
Write-Host "  5. Update test-prisma-project\.devsync\config.json with project ID and API key" -ForegroundColor White
Write-Host "  6. Run: cd test-prisma-project && devsync scan" -ForegroundColor White

