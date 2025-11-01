# Publishing DevSync VSCode Extension

## Prerequisites

1. **Install vsce** (VSCode Extension CLI):
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Azure DevOps Account** (for publishing)
   - Create account at: https://dev.azure.com
   - Create a Personal Access Token (PAT) with Marketplace (publish) permissions

## Building the Extension

### 1. Compile TypeScript

```bash
cd extensions/vscode
npm install
npm run compile
```

### 2. Run Tests (Optional but Recommended)

```bash
npm test
```

### 3. Package Extension

```bash
npm run package
```

This creates a `.vsix` file (e.g., `devsync-0.1.0.vsix`).

## Publishing to Marketplace

### Option 1: VS Code Marketplace (Recommended)

1. **Create Publisher Account**:
   - Go to: https://marketplace.visualstudio.com/manage
   - Sign in with Microsoft/Azure account
   - Create a new publisher

2. **Create Personal Access Token**:
   - Go to: https://dev.azure.com/_users/settings/tokens
   - Create new token with "Marketplace (Manage)" scope
   - Copy the token

3. **Publish**:
   ```bash
   vsce publish -p <your-personal-access-token>
   ```

### Option 2: Open VSX Registry (Alternative)

1. **Create Account**:
   - Go to: https://open-vsx.org/
   - Sign up for an account

2. **Publish**:
   ```bash
   vsce publish -p <your-token> --registry https://open-vsx.org
   ```

## Manual Installation (for Testing)

### Install from .vsix File

```bash
code --install-extension devsync-0.1.0.vsix
```

### Uninstall

```bash
code --uninstall-extension devsync.devsync
```

## Updating the Extension

1. **Update Version**:
   - Update `version` in `package.json`
   - Follow semantic versioning: MAJOR.MINOR.PATCH

2. **Update CHANGELOG.md**:
   - Document changes in CHANGELOG.md

3. **Build and Publish**:
   ```bash
   npm run compile
   npm run package
   vsce publish -p <token>
   ```

## Version Numbers

Follow semantic versioning:
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

Example: `0.1.0` → `0.1.1` (patch) → `0.2.0` (minor) → `1.0.0` (major)

## Checklist Before Publishing

- [ ] All tests pass
- [ ] README.md is complete
- [ ] CHANGELOG.md is updated
- [ ] Version number is updated
- [ ] Icon and screenshots are added (if applicable)
- [ ] Extension manifest is correct
- [ ] All dependencies are included
- [ ] Extension builds without errors

## Troubleshooting

### Error: "Publisher not found"

**Solution**: Create publisher account at https://marketplace.visualstudio.com/manage

### Error: "Invalid Personal Access Token"

**Solution**: 
1. Verify token has "Marketplace (Manage)" scope
2. Check token hasn't expired
3. Create a new token if needed

### Error: "Extension ID already exists"

**Solution**: 
1. Use a unique extension ID in package.json
2. Or publish as an update to existing extension

### Extension doesn't activate

**Solution**:
1. Check activation events in package.json
2. Verify extension is properly installed
3. Check VSCode Developer Tools console for errors

## Publishing Checklist

- [ ] Extension builds successfully
- [ ] All tests pass
- [ ] README.md is complete
- [ ] CHANGELOG.md is updated
- [ ] Version updated in package.json
- [ ] Personal Access Token ready
- [ ] Publisher account created
- [ ] Extension packaged (.vsix created)
- [ ] Ready to publish!

---

**Ready to publish?** Run `vsce publish -p <your-token>` 🚀

