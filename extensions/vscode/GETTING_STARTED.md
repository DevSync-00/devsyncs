# 🚀 Getting Started with DevSync VS Code Extension

Complete step-by-step guide to run the DevSync VS Code extension in a fully functional way.

---

## 📋 Prerequisites

Before starting, make sure you have:

- ✅ **Node.js** (v18 or higher) installed
- ✅ **VS Code** (v1.80.0 or higher) installed
- ✅ **npm** or **yarn** package manager
- ✅ **Git** (for cloning if needed)

---

## 📦 Step 1: Install Dependencies

### 1.1 Install Root Dependencies

```bash
# Navigate to project root
cd C:\DevSync\devsyncs

# Install root dependencies
npm install
```

### 1.2 Install CLI Dependencies

```bash
# Navigate to CLI package
cd packages\cli

# Install CLI dependencies
npm install
```

### 1.3 Install Extension Dependencies

```bash
# Navigate to extension directory
cd ..\..\extensions\vscode

# Install extension dependencies
npm install
```

---

## 🔨 Step 2: Build the CLI

The extension requires the CLI to be built before it can run commands.

```bash
# Make sure you're in the CLI directory
cd packages\cli

# Build the CLI
npm run build
```

**Expected Output:**
```
> @dev-sync/cli@0.1.0 build
> tsc

# No errors means success!
```

**Verify the build:**
```bash
# Check if dist/index.js exists
dir dist\index.js
```

If the file exists, the CLI is built successfully! ✅

---

## 🏗️ Step 3: Build the Extension

```bash
# Navigate to extension directory
cd extensions\vscode

# Build the extension
npm run compile
```

**Expected Output:**
```
> devsync@0.1.0 compile
> tsc -p ./

# No errors means success!
```

**Verify the build:**
```bash
# Check if out/extension.js exists
dir out\extension.js
```

If the file exists, the extension is built successfully! ✅

---

## 🎯 Step 4: Launch the Extension

### Option A: Using VS Code Debugger (Recommended)

1. **Open the extension folder in VS Code:**
   ```bash
   cd extensions\vscode
   code .
   ```

2. **Open Run and Debug panel:**
   - Press `F5`, OR
   - Click the "Run and Debug" icon in the sidebar (▶️), OR
   - Go to menu: **Run → Start Debugging**

3. **Select "Run Extension"** from the dropdown at the top

4. **Wait for compilation:**
   - VS Code will automatically compile if needed
   - A new VS Code window will open (Extension Development Host)

5. **The Extension Development Host window opens:**
   - This is a separate VS Code window with your extension loaded
   - You'll see `[Extension Development Host]` in the window title

### Option B: Using Command Line

```bash
# Navigate to extension directory
cd extensions\vscode

# Launch VS Code with extension development path
code --extensionDevelopmentPath=.

# Then press F5 in that VS Code window
```

---

## ✅ Step 5: Verify Extension is Running

In the **Extension Development Host** window:

1. **Check the Activity Bar:**
   - Look for the DevSync icon (database icon) in the left sidebar
   - If you see it, the extension is loaded! ✅

2. **Open the DevSync Sidebar:**
   - Click the DevSync icon in the Activity Bar
   - You should see the sidebar with:
     - 📁 Commands
     - 📁 Scan Results
     - 📁 Migrations
     - 📁 Configuration

3. **Check Output Channel:**
   - Go to **View → Output** (or `Ctrl+Shift+U`)
   - Select "DevSync CLI" from the dropdown
   - You should see: `DevSync extension is now active!`

---

## 🧪 Step 6: Test the Extension

### Test 1: Initialize a Project

1. **Open a workspace folder:**
   - In Extension Development Host: **File → Open Folder**
   - Select any folder (or create a test folder)

2. **Initialize DevSync:**
   - Click the DevSync icon in Activity Bar
   - Expand "Commands" section
   - Click "⚙️ Initialize Project"

3. **Expected Result:**
   - A `.devsync/config.json` file is created
   - Success message appears
   - Config file opens in editor

### Test 2: Scan Schema

**Prerequisites:** You need a Prisma schema or database connection

1. **Option A: With Prisma Schema:**
   - Create a `schema.prisma` file in your workspace
   - Add some models

2. **Option B: With Database Connection:**
   - Have a database connection string ready
   - Or set it in `.devsync/config.json`

3. **Run Scan:**
   - In DevSync sidebar, click "🔍 Scan Schema"
   - If database connection is needed, enter it when prompted
   - Watch the output in "DevSync CLI" output channel

4. **Expected Result:**
   - Scan completes
   - Results appear in "Scan Results" section
   - `.devsync/scan-results.json` file is created

### Test 3: Generate Migration

1. **After running a scan with mismatches:**
   - Click "🔧 Generate Migration" in sidebar
   - Enter database connection if prompted
   - Choose dry-run or generate file

2. **Expected Result:**
   - Migration file is generated in `.devsync/migrations/`
   - File opens in editor
   - Migration appears in "Migrations" section

---

## 🔄 Step 7: Development Workflow

### Watch Mode (Auto-recompile)

For active development, use watch mode:

1. **Terminal 1 - Watch Mode:**
   ```bash
   cd extensions\vscode
   npm run watch
   ```
   This will automatically recompile when you make changes.

2. **Terminal 2 - Launch Extension:**
   - Press `F5` in VS Code
   - Extension Development Host opens

3. **Make Changes:**
   - Edit files in `src/`
   - Watch mode recompiles automatically
   - Press `Ctrl+R` in Extension Development Host to reload

### Manual Rebuild

If not using watch mode:

```bash
cd extensions\vscode
npm run compile
```

Then reload the Extension Development Host window.

---

## 🐛 Troubleshooting

### Issue: "CLI not found" or "CLI not built"

**Solution:**
```bash
cd packages\cli
npm run build
```

Verify: `dir packages\cli\dist\index.js` should show the file exists.

---

### Issue: Extension doesn't appear in Activity Bar

**Solutions:**
1. **Check if extension compiled:**
   ```bash
   cd extensions\vscode
   npm run compile
   ```

2. **Check for errors:**
   - Open Output panel (`Ctrl+Shift+U`)
   - Look for TypeScript errors

3. **Reload Extension Development Host:**
   - Close and reopen the window
   - Or press `Ctrl+R` to reload

---

### Issue: "Cannot find module 'vscode'"

**Solution:**
```bash
cd extensions\vscode
npm install
```

---

### Issue: Commands don't work

**Check:**
1. Is the CLI built? (`packages/cli/dist/index.js` exists)
2. Are you in a workspace folder? (File → Open Folder)
3. Check Output channel for errors

---

### Issue: "Database connection failed"

**Solutions:**
1. **Verify connection string format:**
   ```
   postgresql://user:password@host:port/database
   ```

2. **Check if database is accessible:**
   - Test connection with `psql` or database client

3. **Set connection in config:**
   - Edit `.devsync/config.json`
   - Add `database.connectionString`

---

### Issue: Extension Development Host doesn't open

**Solutions:**
1. **Check launch.json exists:**
   - Should be at `extensions/vscode/.vscode/launch.json`

2. **Try manual launch:**
   ```bash
   code --extensionDevelopmentPath=extensions\vscode
   ```

3. **Check VS Code version:**
   - Requires VS Code 1.80.0 or higher

---

## 📝 Quick Reference

### Build Commands

```bash
# Build CLI
cd packages\cli
npm run build

# Build Extension
cd extensions\vscode
npm run compile

# Watch mode (auto-rebuild)
cd extensions\vscode
npm run watch
```

### Launch Commands

```bash
# Method 1: Press F5 in VS Code (recommended)

# Method 2: Command line
cd extensions\vscode
code --extensionDevelopmentPath=.
# Then press F5
```

### File Locations

- **CLI Source:** `packages/cli/src/`
- **CLI Build:** `packages/cli/dist/`
- **Extension Source:** `extensions/vscode/src/`
- **Extension Build:** `extensions/vscode/out/`
- **Config File:** `.devsync/config.json` (in workspace)
- **Scan Results:** `.devsync/scan-results.json`
- **Migrations:** `.devsync/migrations/*.sql`

---

## ✅ Checklist

Before running the extension, verify:

- [ ] Node.js installed (`node --version`)
- [ ] Root dependencies installed (`npm install` in root)
- [ ] CLI dependencies installed (`npm install` in `packages/cli`)
- [ ] Extension dependencies installed (`npm install` in `extensions/vscode`)
- [ ] CLI built (`npm run build` in `packages/cli`)
- [ ] Extension compiled (`npm run compile` in `extensions/vscode`)
- [ ] VS Code 1.80.0 or higher
- [ ] Workspace folder opened in Extension Development Host

---

## 🎉 Success Indicators

You'll know everything is working when:

1. ✅ Extension Development Host window opens
2. ✅ DevSync icon appears in Activity Bar
3. ✅ Sidebar shows all sections (Commands, Scan Results, etc.)
4. ✅ "Initialize Project" creates config file
5. ✅ "Scan Schema" runs without errors
6. ✅ Output channel shows CLI execution logs

---

## 📚 Next Steps

- Read the main [README.md](./README.md) for usage instructions
- Check [API documentation](../docs/API_REFERENCE.md) for advanced features
- Explore the sidebar features and commands
- Test with your own Prisma schemas and databases

---

## 💡 Tips

1. **Keep watch mode running** during development for faster iteration
2. **Use the Output channel** to debug CLI command execution
3. **Check the Problems panel** for TypeScript errors
4. **Reload extension** with `Ctrl+R` in Extension Development Host after changes
5. **Test in a separate workspace** to avoid conflicts

---

## 🆘 Need Help?

- Check the [main README](./README.md)
- Review [troubleshooting section](#-troubleshooting) above
- Check VS Code Developer Tools: **Help → Toggle Developer Tools**
- Look at Output channels for error messages

---

**Happy Coding! 🚀**

