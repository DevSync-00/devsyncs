# Development Setup Guide

Complete guide to setting up your development environment for DevSync.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Building the Extension](#building-the-extension)
4. [Running Tests](#running-tests)
5. [Debugging](#debugging)
6. [Development Workflow](#development-workflow)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js**: Version 18.0.0 or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify: `node --version`

- **npm**: Version 9.0.0 or higher (comes with Node.js)
  - Verify: `npm --version`

- **TypeScript**: Version 5.0.0 or higher
  - Installed as dev dependency
  - Verify: `npx tsc --version`

- **VS Code**: Version 1.80.0 or higher
  - Download from [code.visualstudio.com](https://code.visualstudio.com/)
  - Required for extension development

### Optional Tools

- **Git**: For version control
- **Docker**: For testing database integrations
- **PostgreSQL**: For local database testing
- **Prisma**: For schema management

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/devsync/devsync.git
cd devsync/extensions/vscode
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- TypeScript and type definitions
- VS Code extension API types
- Testing frameworks (Mocha, @vscode/test-electron)
- Build tools and utilities

### 3. Verify Installation

```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Check npm version
npm --version   # Should be >= 9.0.0

# Verify dependencies installed
npm list --depth=0
```

## Building the Extension

### Compile TypeScript

```bash
npm run compile
```

This compiles TypeScript files from `src/` to `out/`.

### Watch Mode

For automatic compilation during development:

```bash
npm run watch
```

This watches for file changes and recompiles automatically.

### Build Output

- **Source**: `src/**/*.ts`
- **Output**: `out/**/*.js`
- **Source Maps**: `out/**/*.js.map`

## Running Tests

### Run All Tests

```bash
npm test
```

This:
1. Compiles TypeScript
2. Compiles test files
3. Runs all tests using Mocha

### Run Tests in Watch Mode

```bash
npm run test-watch
```

### Run Specific Test Suites

```bash
# Unit tests only
npm test -- --grep "Unit"

# Integration tests only
npm test -- --grep "Integration"

# UI tests only
npm test -- --grep "UI"
```

### Test Coverage

```bash
# Generate coverage report
npm run test:coverage
```

## Debugging

### Debug Configuration

VS Code debug configurations are in `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "npm: compile"
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}", "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "npm: compile-tests"
    }
  ]
}
```

### Debugging Steps

1. **Set Breakpoints**:
   - Open source files in `src/`
   - Click in the gutter to set breakpoints

2. **Start Debugging**:
   - Press `F5` or click "Run and Debug"
   - Select "Run Extension"
   - A new VS Code window opens (Extension Development Host)

3. **Test Extension**:
   - Use the extension in the new window
   - Breakpoints will hit in the original window
   - Use debug console to inspect variables

### Debugging Tests

1. **Set Breakpoints in Tests**:
   - Open test files in `src/test/`
   - Set breakpoints

2. **Start Test Debugging**:
   - Press `F5`
   - Select "Extension Tests"
   - Tests run and breakpoints hit

### Debug Console

Use the Debug Console to:
- Inspect variables
- Evaluate expressions
- View call stack
- Check breakpoints

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

- Edit files in `src/`
- Add tests in `src/test/`
- Update documentation

### 3. Test Changes

```bash
# Compile
npm run compile

# Run tests
npm test

# Run linting
npm run lint

# Check formatting
npm run format:check
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Tests
- `refactor:` - Refactoring
- `chore:` - Maintenance

### 5. Create Pull Request

- Push to GitHub
- Create pull request
- Follow [Contribution Guidelines](CONTRIBUTING.md)

## Project Structure

```
extensions/vscode/
├── src/                    # Source code
│   ├── extension.ts        # Extension entry point
│   ├── commands.ts         # Command handlers
│   ├── di/                 # Dependency injection
│   ├── services/           # Business logic
│   ├── ui/                 # UI components
│   └── ...
├── out/                    # Compiled output
├── src/test/              # Tests
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   ├── ui/                # UI tests
│   └── ...
├── docs/                  # Documentation
├── webview/               # Webview assets
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript config
└── tsconfig.test.json     # Test TypeScript config
```

## Environment Variables

### Development

Create `.env` file (not committed):

```env
DEVSYNC_API_URL=http://localhost:3000
DEVSYNC_API_KEY=dev-key
DEVSYNC_PROJECT_ID=dev-project
DATABASE_URL=postgresql://user:pass@localhost:5432/devdb
```

### Testing

Test environment variables in `src/test/utils/testHelpers.ts`:

```typescript
export const TEST_ENV = {
  API_URL: process.env.TEST_API_URL || 'http://localhost:3000',
  API_KEY: process.env.TEST_API_KEY || 'test-key',
  // ...
};
```

## Code Quality

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Formatting

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

### Type Checking

```bash
# Type check without emitting
npx tsc --noEmit
```

### Quality Checks

```bash
# Run all quality checks
npm run quality
```

This runs:
- Linting
- Formatting check
- Type checking
- Tests

## Hot Reload

### Extension Development Host

When debugging:
1. Make changes to source files
2. Run `npm run compile` (or use watch mode)
3. Press `Ctrl+R` in Extension Development Host to reload

### Webview Development

For webview changes:
1. Edit files in `webview/`
2. Reload webview in Extension Development Host
3. Or restart extension debugging

## Troubleshooting

### Common Issues

#### Extension Not Loading

**Problem**: Extension doesn't activate in Extension Development Host

**Solutions**:
1. Check `package.json` activation events
2. Verify `main` points to correct file
3. Check Output panel for errors
4. Ensure TypeScript compiled successfully

#### Tests Not Running

**Problem**: Tests fail or don't run

**Solutions**:
1. Run `npm run compile-tests`
2. Check test file paths
3. Verify test configuration
4. Check for TypeScript errors

#### Type Errors

**Problem**: TypeScript compilation errors

**Solutions**:
1. Run `npm run compile` to see all errors
2. Check `tsconfig.json` configuration
3. Verify type definitions installed
4. Update VS Code TypeScript version if needed

#### Module Not Found

**Problem**: Cannot find module errors

**Solutions**:
1. Run `npm install` to ensure dependencies installed
2. Check `package.json` dependencies
3. Verify import paths are correct
4. Check `tsconfig.json` paths configuration

### Getting Help

- **Check Logs**: View Output panel in VS Code
- **GitHub Issues**: Search for similar issues
- **Documentation**: Check other docs in `docs/developer/`
- **Ask Questions**: Create GitHub Discussion

## Next Steps

- Read [Architecture Overview](ARCHITECTURE.md)
- Review [Code Style Guide](CODE_STYLE.md)
- Check [Contribution Guidelines](CONTRIBUTING.md)
- Explore [API Reference](API_REFERENCE.md)

---

**Need Help?** Check [Troubleshooting](#troubleshooting) or [Contact the Team](https://devsync.ai/contact).

