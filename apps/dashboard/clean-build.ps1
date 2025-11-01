# Clean build script for Next.js
Write-Host "Cleaning Next.js build cache..." -ForegroundColor Yellow

# Remove build artifacts
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✓ Removed .next directory" -ForegroundColor Green
}

if (Test-Path "node_modules/.cache") {
    Remove-Item -Recurse -Force "node_modules/.cache"
    Write-Host "✓ Removed node_modules cache" -ForegroundColor Green
}

Write-Host "`nStarting development server..." -ForegroundColor Yellow
npm run dev

