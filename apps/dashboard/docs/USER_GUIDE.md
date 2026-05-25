# Dev-Sync.dev Dashboard - User Guide

Complete guide to using the Dev-Sync.dev dashboard for schema synchronization.

## Overview

Dev-Sync.dev dashboard helps you:
- 🔍 **Detect** schema mismatches between code and database
- 📊 **Visualize** differences with detailed reports
- 🔄 **Generate** safe migrations automatically
- ✅ **Apply** migrations directly from the dashboard
- 🤖 **Understand** migrations with AI explanations
- 📈 **Track** execution history and monitor changes

---

## Getting Started

### Step 1: Sign Up / Log In

1. Visit the dashboard homepage
2. Click **"Get Early Access"** or **"Sign Up"**
3. Create an account with email and password
4. Verify your email (if required)
5. Log in to your account

### Step 2: Create a Project

1. Click **"New Project"** in the dashboard
2. Enter project details:
   - **Name**: Your project name
   - **Schema Type**: Choose your schema type (Prisma, Supabase, TypeORM, etc.)
   - **Database Connection** (optional): Add later if needed
3. Click **"Create Project"**

### Step 3: Run a Scan

**Using CLI**:
```bash
devsync scan \
  --project-id <your-project-id> \
  --api-url http://localhost:3000 \
  --api-key <your-api-key>
```

**From Dashboard**:
- Go to project page
- Click **"Run Scan"** (coming soon)

### Step 4: View Results

1. Navigate to your project
2. Click on a scan report
3. Review mismatches and suggested fixes
4. Generate migrations if needed

---

## Core Features

### 1. Project Management

#### Viewing Projects

- **Dashboard Home**: See all your projects
- **Project Cards**: Show latest scan status and mismatch count
- **Project Status**:
  - ✅ Green: No mismatches
  - ⚠️ Yellow: Has mismatches
  - 🔴 Red: Scan failed

#### Creating Projects

- Click **"New Project"** button
- Fill in project details
- Choose schema type
- (Optional) Add database connection string
- Click **"Create Project"**

#### Project Settings

- **Database Connection**: Add/update connection string
- **Schema Type**: View or update schema type
- **Team Sharing**: Invite team members (coming soon)

### 2. Scan Reports

#### Understanding Reports

**Status Types**:
- **Completed**: Scan finished successfully
- **Pending**: Scan in progress
- **Failed**: Scan encountered an error

**Mismatch Severity**:
- **Error** (🔴): Critical differences that need fixing
- **Warning** (⚠️): Important differences to review
- **Info** (ℹ️): Optional differences

#### Viewing Report Details

1. Click on a scan report
2. See mismatches grouped by severity
3. Review code vs database differences
4. Check suggested fixes
5. Generate migrations

### 3. Migration Management

#### Generating Migrations

1. Go to scan report with mismatches
2. Click **"Generate Migration"**
3. Review the generated SQL
4. Copy, download, or apply directly

#### Migration Preview

**What You See**:
- Migration filename
- Generated SQL code
- Status (Pending/Applied)
- Actions (Copy, Download, Apply)

**Actions Available**:
- **Copy SQL**: Copy to clipboard
- **Download**: Save as file
- **Validate (Dry Run)**: Check SQL without executing
- **Apply Migration**: Execute on database

#### Applying Migrations

1. Click **"Validate (Dry Run)"** first
2. Review validation result
3. If valid, click **"Apply Migration"**
4. Confirm the action
5. Wait for execution to complete
6. Check execution result

### 4. Migration History

#### Viewing History

1. In migration preview, click **"Show History"**
2. See all execution attempts
3. Check execution details:
   - Type (Apply, Rollback, Dry Run)
   - Status (Success, Failed, Running)
   - Execution time
   - Affected rows
   - Errors (if any)

#### Understanding History

**Execution Types**:
- **Apply**: Actually executed on database
- **Dry Run**: Validated without executing
- **Rollback**: Rolled back changes (coming soon)

**Status Indicators**:
- ✅ **Success**: Completed successfully
- ❌ **Failed**: Encountered an error
- ⏳ **Running**: Currently executing

### 5. AI Features

#### AI Explanations

1. In scan report, click **"Generate AI Explanation"**
2. Get detailed explanation of migrations
3. See risk assessment
4. Review recommendations

**What AI Explains**:
- What the migration does
- Why it's needed
- Risk level (low/medium/high)
- Data loss risk
- Estimated downtime
- Rollback plan

#### AI Queries

1. Scroll to **"Ask AI About This Schema"** section
2. Type your question
3. Get AI-powered answer

**Example Questions**:
- "What's the safest way to apply this migration?"
- "Will this migration cause downtime?"
- "What's the risk of data loss?"
- "How do I rollback these changes?"

---

## Workflow Examples

### Example 1: Fixing Schema Drift

**Scenario**: Code expects a new column, but database doesn't have it

**Steps**:
1. Run scan (via CLI or dashboard)
2. View scan report
3. See mismatch: "Missing column 'age' in 'User' table"
4. Generate migration
5. Review generated SQL: `ALTER TABLE "User" ADD COLUMN "age" INTEGER;`
6. Validate migration (dry run)
7. Apply migration
8. Confirm in history that it succeeded

### Example 2: Type Mismatch

**Scenario**: Code expects TEXT, but database has VARCHAR

**Steps**:
1. Run scan
2. View report
3. See mismatch: "Type mismatch in 'User.email'"
4. Generate migration
5. Get AI explanation of the change
6. Review SQL: `ALTER TABLE "User" ALTER COLUMN "email" TYPE TEXT;`
7. Apply migration
8. Verify changes

### Example 3: Multiple Changes

**Scenario**: Several schema changes need to be applied

**Steps**:
1. Run scan
2. View report with multiple mismatches
3. Generate migration with all changes
4. Review AI explanation for overall impact
5. Validate migration
6. Apply migration (all changes in one transaction)
7. Check history for execution details

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Project | `Ctrl/Cmd + N` (coming soon) |
| Search Projects | `Ctrl/Cmd + K` (coming soon) |
| Run Scan | `Ctrl/Cmd + S` (coming soon) |

---

## Tips & Best Practices

### 1. Always Validate First

✅ Run dry-run validation before applying migrations

### 2. Review AI Explanations

✅ Read AI explanations to understand changes

### 3. Check History

✅ Review migration history before making changes

### 4. Backup Database

✅ Always backup before applying migrations

### 5. Test in Development

✅ Test migrations in dev/staging first

### 6. Monitor Execution

✅ Watch migration execution and check results

---

## Troubleshooting

### Can't Create Project

- Check browser console for errors
- Verify Supabase connection
- Ensure you're logged in
- See [Troubleshooting Guide](../TROUBLESHOOTING.md)

### Migration Validation Fails

- Check SQL syntax
- Verify database connection
- Review error message
- Test SQL manually

### Migration Execution Fails

- Check error message in history
- Verify database permissions
- Check connection string
- Review SQL for issues

### Can't See Scan Reports

- Verify project ID is correct
- Check CLI sync was successful
- Refresh the page
- Check API connection

---

## Getting Help

- 📖 **Documentation**: See [docs folder](./)
- 🐛 **Issues**: Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- 💬 **Support**: Contact support team

---

## Next Steps

- 📖 [Migration Execution Guide](./MIGRATION_EXECUTION_GUIDE.md)
- 📖 [Migration History Guide](./MIGRATION_HISTORY_GUIDE.md)
- 📖 [API Reference](./API_REFERENCE.md)
- 📖 [Troubleshooting Guide](../TROUBLESHOOTING.md)

