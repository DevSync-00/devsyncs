# Devsync AI - Testing Checklist

**Use this checklist to validate the Devsync AI implementation after Phase 1-8 completion.**

---

## ✅ Pre-Testing Setup

- [ ] CLI built successfully (`cd packages/cli && npm run build`)
- [ ] VS Code extension compiles (`cd extensions/vscode && npm run compile`)
- [ ] Node.js version compatible (check `package.json` engines)
- [ ] Dependencies installed (`npm install` in both CLI and extension)

---

## 🧪 CLI Testing

### Basic Commands

- [ ] **Init Command**
  ```bash
  devsync init
  ```
  - [ ] Creates `.devsync/config.json`
  - [ ] Config has safe defaults (`writeAccess: false`)
  - [ ] Handles existing config gracefully

- [ ] **Scan Command**
  ```bash
  devsync scan
  ```
  - [ ] Scans project directory
  - [ ] Detects connection strings (if present)
  - [ ] Detects schema files (Prisma, SQL, etc.)
  - [ ] Detects ORM configurations
  - [ ] Shows table output correctly
  - [ ] JSON output works (`--format json`)
  - [ ] Blocks `--allow-db-writes` flag

- [ ] **Status Command**
  ```bash
  devsync status
  devsync status --db postgresql://...
  ```
  - [ ] Works without DB connection
  - [ ] Works with DB connection
  - [ ] Shows schema readiness
  - [ ] Shows conflict summary (if conflicts exist)
  - [ ] JSON output works (`--format json`)
  - [ ] Handles missing schemas gracefully

- [ ] **Fix Command** (Preview Only)
  ```bash
  devsync fix --db postgresql://...
  ```
  - [ ] Requires `--db` option
  - [ ] Generates migration file
  - [ ] Preview-only (no writes)
  - [ ] Works without AI (`--api-key` optional)
  - [ ] Works with AI (if `--api-key` provided)
  - [ ] JSON output works (`--format json`)
  - [ ] `--output` saves migration file

- [ ] **Apply Command** (Blocked)
  ```bash
  devsync apply
  ```
  - [ ] Shows blocked message
  - [ ] Does not perform any writes
  - [ ] Provides helpful error message

---

## 🗄️ Database Testing

### PostgreSQL (Primary)

- [ ] **Connection**
  - [ ] Connects to PostgreSQL database
  - [ ] Reads schema (read-only)
  - [ ] Handles connection errors gracefully

- [ ] **Schema Extraction**
  - [ ] Extracts tables
  - [ ] Extracts columns with types
  - [ ] Extracts indexes
  - [ ] Extracts constraints
  - [ ] Handles special characters in names

- [ ] **Conflict Detection**
  - [ ] Detects missing tables
  - [ ] Detects missing columns
  - [ ] Detects type mismatches
  - [ ] Detects nullable mismatches
  - [ ] Classifies risk levels correctly

### Test Scenarios

- [ ] **Empty Database** - New project, no tables
- [ ] **Matching Schemas** - Code and DB in sync
- [ ] **Schema Drift** - Code ahead of DB
- [ ] **DB Ahead** - DB has extra tables/columns
- [ ] **Type Mismatches** - Same column, different types
- [ ] **Nullable Mismatches** - Nullable vs NOT NULL

---

## 📁 Schema File Testing

### Prisma Schema

- [ ] Detects `schema.prisma` file
- [ ] Parses Prisma schema correctly
- [ ] Extracts models/tables
- [ ] Extracts field types
- [ ] Handles relations
- [ ] Compares with database correctly

### SQL Migrations

- [ ] Detects SQL migration files
- [ ] Parses CREATE TABLE statements
- [ ] Extracts table definitions
- [ ] Compares with database correctly

### TypeORM

- [ ] Detects TypeORM entities
- [ ] Parses entity decorators
- [ ] Extracts column definitions
- [ ] Handles relations

### Raw SQL Files

- [ ] Detects .sql files
- [ ] Attempts to parse schema definitions
- [ ] Reports findings

---

## 🤖 AI Integration Testing

### OpenAI

- [ ] Connects to OpenAI API (with valid key)
- [ ] Generates structured explanations
- [ ] Provides conflict explanations
- [ ] Includes impact assessments
- [ ] Handles API errors gracefully

### Anthropic

- [ ] Connects to Anthropic API (with valid key)
- [ ] Generates structured explanations
- [ ] Handles API errors gracefully

### Ollama (Local)

- [ ] Connects to local Ollama instance
- [ ] Uses specified model
- [ ] Generates explanations
- [ ] Handles connection errors

### Without AI

- [ ] Works without `--api-key`
- [ ] Still generates migrations
- [ ] Provides basic conflict detection

---

## 🔒 Safety Testing

### Read-Only Enforcement

- [ ] `scan` command never writes to DB
- [ ] `status` command never writes to DB
- [ ] `fix` command never writes to DB by default
- [ ] Database connections are read-only

### Preview-Only Fixes

- [ ] `fix` command generates files only
- [ ] No automatic application
- [ ] Migration files are valid SQL
- [ ] Rollback scripts included (if applicable)

### Error Handling

- [ ] Handles invalid connection strings
- [ ] Handles database connection failures
- [ ] Handles missing schema files
- [ ] Handles invalid schema syntax
- [ ] Provides helpful error messages

### Confirmation Workflows

- [ ] VS Code extension shows confirmations
- [ ] Dangerous operations require explicit opt-in
- [ ] Clear warnings for database writes
- [ ] Preview shown before application

---

## 📊 Output Format Testing

### Table Format

- [ ] Readable output in terminal
- [ ] Proper formatting and colors
- [ ] All information displayed
- [ ] Handles long outputs

### JSON Format

- [ ] Valid JSON output
- [ ] All data included
- [ ] Structured correctly
- [ ] Can be parsed programmatically

---

## 🔌 VS Code Extension Testing

### Installation

- [ ] Extension loads in VS Code
- [ ] Sidebar appears
- [ ] Commands available in Command Palette

### Commands

- [ ] `DevSync: Scan Schema` works
- [ ] `DevSync: Check Status` works
- [ ] `DevSync: Propose Fixes` works
- [ ] Commands show progress
- [ ] Commands show results

### Safety UI

- [ ] Confirmation dialogs appear
- [ ] Database write warnings shown
- [ ] Mode selection works (Dry Run, Generate, Apply)
- [ ] Multiple confirmations for dangerous operations

### Integration

- [ ] CLI commands execute correctly
- [ ] Output displayed in output channel
- [ ] Errors shown to user
- [ ] Status updates in sidebar

---

## 🎯 End-to-End Testing

### Complete Workflow 1: New Project

1. [ ] `devsync init` - Creates config
2. [ ] `devsync scan` - Detects schema files
3. [ ] `devsync status` - Shows schema readiness
4. [ ] `devsync status --db ...` - Shows conflicts (if any)
5. [ ] `devsync fix --db ...` - Generates migration
6. [ ] Review migration file
7. [ ] Apply migration manually
8. [ ] `devsync status --db ...` - Confirms no conflicts

### Complete Workflow 2: Existing Project

1. [ ] `devsync status --db ...` - Detects conflicts
2. [ ] `devsync fix --db ... --api-key ...` - AI-powered fixes
3. [ ] Review AI explanations
4. [ ] Review migration file
5. [ ] Apply migration
6. [ ] Verify sync status

### Complete Workflow 3: CI/CD Integration

1. [ ] `devsync scan --format json` - JSON output
2. [ ] `devsync status --format json --db ...` - JSON status
3. [ ] Parse JSON programmatically
4. [ ] Fail build on conflicts (if configured)
5. [ ] Generate migration artifacts

---

## 📈 Performance Testing

- [ ] Large codebase scanning (< 30 seconds for typical project)
- [ ] Large database scanning (< 60 seconds for 100 tables)
- [ ] Schema extraction performance
- [ ] Conflict detection performance
- [ ] AI reasoning response time (if using AI)

---

## 🐛 Edge Cases

### File System

- [ ] Handles very deep directory structures
- [ ] Handles special characters in paths
- [ ] Handles symlinks correctly
- [ ] Respects .gitignore and .devsyncignore

### Database

- [ ] Handles large schemas (100+ tables)
- [ ] Handles special characters in names
- [ ] Handles reserved keywords
- [ ] Handles multiple schemas (if supported)

### Schema Types

- [ ] Handles missing schema files gracefully
- [ ] Handles invalid schema syntax
- [ ] Handles mixed schema types in same project
- [ ] Handles unsupported schema types

---

## ✅ Validation Checklist

### Code Quality

- [ ] TypeScript compiles without errors
- [ ] No linter errors (run `npm run lint` if available)
- [ ] All imports resolve correctly
- [ ] Type definitions correct

### Documentation

- [ ] README files up to date
- [ ] Command help text accurate
- [ ] Error messages helpful
- [ ] Safety warnings clear

### Charter Compliance

- [ ] Read-only by default ✅
- [ ] Explicit opt-in for writes ✅
- [ ] Preview-only fixes ✅
- [ ] User-provided API keys only ✅
- [ ] Structured outputs ✅
- [ ] Safety guarantees enforced ✅

---

## 📝 Test Results Template

```
Test Date: ___________
Tester: ___________
Environment: ___________

CLI Version: ___________
Node Version: ___________

Results:
- [ ] All basic commands work
- [ ] Database connections work
- [ ] Schema detection works
- [ ] Conflict detection works
- [ ] AI integration works (if tested)
- [ ] Safety features work
- [ ] VS Code extension works (if tested)

Issues Found:
1. ___________
2. ___________

Notes:
___________
```

---

## 🚀 Next Steps After Testing

1. **Document any issues found**
2. **Fix critical bugs**
3. **Update documentation based on findings**
4. **Prepare for production use**
5. **Consider performance optimizations**

---

**Happy Testing!** 🧪

