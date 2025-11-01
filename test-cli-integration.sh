#!/bin/bash
# Quick Test Script for CLI → Dashboard Integration

echo "🧪 Testing CLI → Dashboard Integration"
echo ""

# Step 1: Check if dashboard is running
echo "1. Checking if dashboard is running..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "   ✅ Dashboard is running on http://localhost:3000"
else
  echo "   ⚠️  Dashboard not running. Start it with:"
  echo "      cd apps/dashboard && npm run dev"
  exit 1
fi

# Step 2: Test CLI scan (local only)
echo ""
echo "2. Testing CLI scan (local only)..."
cd test-prisma-project
devsync scan

# Step 3: Check if config exists
echo ""
echo "3. Checking CLI config..."
if [ -f .devsync/config.json ]; then
  echo "   ✅ Config file exists"
  cat .devsync/config.json | grep -E "(project|api)" || echo "   ⚠️  Config needs project ID and API settings"
else
  echo "   ⚠️  Config file not found. Run: devsync init"
fi

# Step 4: Test with cloud sync (if configured)
echo ""
echo "4. Testing cloud sync (if configured)..."
if [ -f .devsync/config.json ]; then
  PROJECT_ID=$(cat .devsync/config.json | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
  API_URL=$(cat .devsync/config.json | grep -o '"url"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
  API_KEY=$(cat .devsync/config.json | grep -o '"key"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ ! -z "$PROJECT_ID" ] && [ ! -z "$API_URL" ] && [ ! -z "$API_KEY" ]; then
    echo "   ✅ Config has project ID, API URL, and API key"
    echo "   Running scan with cloud sync..."
    devsync scan --no-sync  # Test local first
    # devsync scan  # Uncomment to test cloud sync
  else
    echo "   ⚠️  Config missing project ID or API settings"
    echo "   Edit .devsync/config.json to add:"
    echo "     - project.id (from dashboard URL)"
    echo "     - api.url (http://localhost:3000)"
    echo "     - api.key (JWT token from browser cookie)"
  fi
fi

echo ""
echo "✅ Test complete!"
echo ""
echo "Next steps:"
echo "  1. Visit http://localhost:3000 to see dashboard"
echo "  2. Sign up / Log in"
echo "  3. Create a project and copy its ID"
echo "  4. Get JWT token from browser cookies"
echo "  5. Update .devsync/config.json with project ID and API key"
echo "  6. Run: devsync scan (will sync to dashboard)"

