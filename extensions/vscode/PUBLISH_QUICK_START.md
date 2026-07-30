# Quick Start: Publishing DevSync VS Code Extension

## Prerequisites Checklist

- [ ] Node.js installed (for npm)
- [ ] VS Code installed
- [ ] Microsoft/Azure account (for Marketplace)
- [ ] Extension code is ready

## Step-by-Step Publishing Guide

### Step 1: Install vsce (VS Code Extension CLI)

```bash
npm install -g @vscode/vsce
```

**If you get network errors:**
- Try again later
- Or use: `npm install -g @vscode/vsce --registry https://registry.npmjs.org/`
- Or install locally: `npm install @vscode/vsce` (then use `npx vsce`)

### Step 2: Create Publisher Account

1. **Go to VS Code Marketplace Publisher Portal:**
   - Visit: https://marketplace.visualstudio.com/manage
   - Sign in with your Microsoft/Azure account

2. **Create a New Publisher:**
   - Click "Create Publisher" or "New Publisher"
   - Enter publisher ID: `devsync` (must match `package.json`)
   - Enter publisher name: `DevSync` (or your preferred name)
   - Accept the terms
   - Click "Create"

### Step 3: Create Personal Access Token (PAT)

1. **Go to Azure DevOps:**
   - Visit: https://dev.azure.com/_users/settings/tokens
   - Or: https://dev.azure.com → Your Profile → Security → Personal Access Tokens

2. **Create New Token:**
   - Click "New Token" or "+ New Token"
   - Name: `VS Code Extension Publishing`
   - Organization: Select "All accessible organizations"
   - Expiration: Set to 1 year (or your preference)
   - Scopes: Select **"Marketplace (Manage)"**
   - Click "Create"
   - **IMPORTANT:** Copy the token immediately (you won't see it again!)

### Step 4: Prepare Your Extension

1. **Navigate to extension directory:**
   ```bash
   cd extensions/vscode
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Compile TypeScript:**
   ```bash
   npm run compile
   ```

4. **Verify package.json:**
   - Check `publisher` field matches your publisher ID (`devsync`)
   - Check `version` is correct (currently `0.1.0`)
   - Verify all required fields are present

### Step 5: Package the Extension

```bash
npm run package
```

This creates a `.vsix` file (e.g., `devsync-0.1.0.vsix`).

**Test the package locally (optional):**
```bash
code --install-extension devsync-0.1.0.vsix
```

### Step 6: Publish to Marketplace

**Option A: Publish with PAT (Recommended)**
```bash
vsce publish -p <your-personal-access-token>
```

**Option B: Publish and let vsce prompt for token**
```bash
vsce publish
```
(It will prompt you for the token)

**Option C: Publish to Open VSX (Cursor, Antigravity, and compatible editors)**
```bash
npx ovsx publish devsync-<version>.vsix -p <your-open-vsx-token>
```

### Step 7: Verify Publication

1. **Check Marketplace:**
   - Visit: https://marketplace.visualstudio.com/vscode
   - Search for "DevSync"
   - Your extension should appear within a few minutes

2. **Check Publisher Portal:**
   - Visit: https://marketplace.visualstudio.com/manage
   - You should see your extension listed

## Updating the Extension

When you want to publish an update:

1. **Update version in package.json:**
   ```json
   "version": "0.1.1"  // Increment: patch (0.1.1), minor (0.2.0), or major (1.0.0)
   ```

2. **Update CHANGELOG.md:**
   - Add new version section
   - Document changes

3. **Build and publish:**
   ```bash
   npm run compile
   npm run package
   vsce publish -p <your-token>
   ```

## Troubleshooting

### Error: "Publisher not found"
- **Solution:** Make sure you created the publisher account at https://marketplace.visualstudio.com/manage
- Verify the publisher ID in `package.json` matches exactly

### Error: "Invalid Personal Access Token"
- **Solution:** 
  - Verify token has "Marketplace (Manage)" scope
  - Check token hasn't expired
  - Create a new token if needed

### Error: "Extension ID already exists"
- **Solution:** 
  - The extension ID is `publisher.name` (e.g., `devsync.devsync`)
  - If it exists, you're updating an existing extension (this is normal for updates)
  - If you want a new extension, change the `name` in `package.json`

### Error: "Network timeout" when installing vsce
- **Solution:**
  - Try again later
  - Use a different network
  - Install locally: `npm install @vscode/vsce` then use `npx vsce`

### Extension doesn't appear in Marketplace
- **Solution:**
  - Wait 5-10 minutes (publication can take time)
  - Check publisher portal for any errors
  - Verify extension was published successfully (check vsce output)

## Quick Reference Commands

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Navigate to extension
cd extensions/vscode

# Install dependencies
npm install

# Compile
npm run compile

# Package
npm run package

# Publish
vsce publish -p <YOUR_TOKEN>

# Test locally
code --install-extension devsync-0.1.0.vsix

# Uninstall test version
code --uninstall-extension devsync.devsync
```

## Important Notes

1. **Publisher ID:** Must match exactly between `package.json` and your Marketplace publisher account
2. **Version:** Must increment for each update (semantic versioning recommended)
3. **CHANGELOG.md:** Should be updated for each release
4. **Token Security:** Never commit your PAT to git. Use environment variables or enter when prompted.

## Next Steps After Publishing

1. ✅ Share the Marketplace link with users
2. ✅ Update your README with installation instructions
3. ✅ Monitor Marketplace for reviews and issues
4. ✅ Plan next version updates

---

**Ready to publish?** Follow the steps above! 🚀

