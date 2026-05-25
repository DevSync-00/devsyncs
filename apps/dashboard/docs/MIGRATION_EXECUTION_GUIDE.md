# Migration Execution Guide

Learn how to apply migrations directly from the Dev-Sync.dev dashboard.

## Overview

Dev-Sync.dev allows you to execute database migrations directly from the dashboard with safety checks, validation, and full execution history tracking.

## Features

- ✅ **Dry Run Validation** - Validate migrations without executing
- ✅ **One-Click Execution** - Apply migrations with a single click
- ✅ **Execution History** - Track all migration executions
- ✅ **Safety Checks** - Prevents duplicate execution and validates permissions
- ✅ **Error Handling** - Detailed error messages and recovery options
- ✅ **Status Tracking** - Real-time execution status updates

---

## Quick Start

### Step 1: Generate a Migration

1. Go to your project in the dashboard
2. Navigate to a scan report with mismatches
3. Click **"Generate Migration"**
4. Review the generated SQL migration

### Step 2: Validate the Migration (Dry Run)

1. In the migration preview, click **"Validate (Dry Run)"**
2. The system will validate the SQL syntax without executing
3. Check the validation result

### Step 3: Apply the Migration

1. Click **"Apply Migration"**
2. Confirm the action in the dialog
3. Wait for execution to complete
4. View the execution result

---

## Detailed Guide

### Validation (Dry Run)

**Purpose**: Validate SQL syntax and check for errors without executing.

**How it works**:
- Validates SQL syntax using PostgreSQL's EXPLAIN
- Checks for syntax errors
- Verifies database connection
- Does NOT modify the database

**When to use**:
- Before applying a migration for the first time
- To check if SQL is valid
- To verify database connectivity

**Result**:
- ✅ **Success**: SQL is valid and ready to execute
- ❌ **Failed**: SQL has syntax errors (check the error message)

### Applying Migrations

**Purpose**: Execute the migration SQL on your database.

**How it works**:
- Executes the SQL migration on your database
- Wraps in a transaction (BEGIN/COMMIT)
- Tracks execution status and results
- Updates migration history

**Safety Checks**:
- ✅ Requires explicit confirmation
- ✅ Prevents duplicate execution
- ✅ Validates user permissions
- ✅ Checks database connection

**When to use**:
- After validating the migration
- When you're ready to apply changes
- After reviewing the migration SQL

**Result**:
- ✅ **Success**: Migration applied successfully
- ❌ **Failed**: Execution failed (check error message for details)

---

## Execution Status

Migrations have the following statuses:

| Status | Description | What It Means |
|--------|-------------|---------------|
| **Pending** | Migration generated but not executed | Ready to apply |
| **Running** | Currently executing | Wait for completion |
| **Success** | Execution completed successfully | Migration applied |
| **Failed** | Execution failed | Check error message |
| **Cancelled** | Execution was cancelled | Can retry |

---

## Migration History

### Viewing History

1. In the migration preview, click **"Show History"**
2. View all execution attempts for this migration
3. See execution type (Apply, Rollback, Dry Run)
4. Check execution time and affected rows

### History Details

Each history entry shows:
- **Execution Type**: Apply, Rollback, or Dry Run
- **Status**: Success, Failed, Running, or Cancelled
- **Execution Time**: How long it took (in milliseconds)
- **Affected Rows**: Number of rows modified
- **Error Message**: If execution failed
- **Timestamp**: When execution started/completed

---

## Error Handling

### Common Errors

#### 1. SQL Syntax Error

**Error**: `SQL validation failed: syntax error`

**Cause**: Invalid SQL syntax in the migration

**Solution**:
- Review the migration SQL
- Check for typos or missing semicolons
- Test the SQL directly in your database client

#### 2. Constraint Violation

**Error**: `new row violates check constraint`

**Cause**: Migration tries to insert data that violates a constraint

**Solution**:
- Review the constraint definition
- Modify the migration to comply with constraints
- Or update the constraint if needed

#### 3. Permission Denied

**Error**: `permission denied for table`

**Cause**: Database user doesn't have permission

**Solution**:
- Check database user permissions
- Grant necessary permissions to the user
- Verify connection string uses correct user

#### 4. Connection Failed

**Error**: `Failed to connect to database`

**Cause**: Invalid connection string or database unavailable

**Solution**:
- Verify database connection string
- Check if database is running
- Test connection in project settings

#### 5. Already Applied

**Error**: `Migration has already been applied`

**Cause**: Trying to apply a migration that was already executed

**Solution**:
- Check migration history
- Generate a new migration if needed
- Don't apply the same migration twice

---

## Best Practices

### 1. Always Validate First

✅ **Do**: Always run dry-run validation before applying
❌ **Don't**: Apply migrations without validating first

### 2. Review SQL Carefully

✅ **Do**: Read through the migration SQL before applying
❌ **Don't**: Blindly apply migrations without understanding them

### 3. Test in Development First

✅ **Do**: Test migrations in dev/staging before production
❌ **Don't**: Apply untested migrations to production databases

### 4. Keep Database Backup

✅ **Do**: Have a backup before applying migrations
❌ **Don't**: Apply migrations to databases without backups

### 5. Monitor Execution

✅ **Do**: Watch execution status and check results
❌ **Don't**: Close the page while migration is running

---

## API Reference

### Execute Migration (POST)

**Endpoint**: `/api/migrations/[id]/execute`

**Request Body**:
```json
{
  "dryRun": false,
  "confirm": true
}
```

**Response (Success)**:
```json
{
  "success": true,
  "dryRun": false,
  "message": "Migration applied successfully",
  "executionTime": 250,
  "affectedRows": 5
}
```

**Response (Error)**:
```json
{
  "success": false,
  "error": "SQL execution failed: syntax error",
  "message": "Migration execution error: syntax error",
  "executionTime": 50
}
```

### Get Migration History (GET)

**Endpoint**: `/api/migrations/[id]/history`

**Response**:
```json
{
  "history": [
    {
      "id": "history-id",
      "execution_type": "apply",
      "status": "success",
      "execution_time_ms": 250,
      "affected_rows": 5,
      "started_at": "2024-11-01T10:00:00Z",
      "completed_at": "2024-11-01T10:00:05Z"
    }
  ]
}
```

---

## Troubleshooting

### Migration Stuck in "Running" Status

**Cause**: Execution process crashed or was interrupted

**Solution**:
1. Wait a few minutes (execution might complete)
2. Check database connection
3. Manually update migration status if needed

### Validation Passes But Execution Fails

**Cause**: Dry run validation doesn't catch all runtime errors

**Solution**:
- Check database state (tables might have changed)
- Review error message for specific issue
- Test SQL manually in database client

### Can't See Migration History

**Cause**: History hasn't been loaded or user doesn't have permission

**Solution**:
- Click "Show History" button
- Refresh the page
- Check user permissions

---

## Security

### Access Control

- ✅ Only project owners can execute migrations
- ✅ Requires database connection string configured
- ✅ All executions are logged and tracked

### Database Connection

- ✅ Connection strings are encrypted in database
- ✅ Never exposed in API responses
- ✅ Only used server-side for execution

---

## FAQ

**Q: Can I rollback a migration?**
A: Rollback functionality is coming soon. For now, you'll need to manually create a rollback migration.

**Q: What happens if execution fails?**
A: The migration status is updated to "Failed" and the error is logged. You can retry after fixing the issue.

**Q: Can I cancel a running migration?**
A: Currently, running migrations can't be cancelled from the UI. Contact support if you need to stop a migration.

**Q: How long do migrations take?**
A: Depends on migration complexity. Small migrations (< 1 second), large migrations (several minutes). Check execution time in history.

**Q: Can I apply the same migration twice?**
A: No, the system prevents duplicate execution. Generate a new migration if you need to re-apply changes.

---

## Next Steps

- 📖 [Migration History Guide](./MIGRATION_HISTORY_GUIDE.md)
- 📖 [API Reference](./API_REFERENCE.md)
- 📖 [Troubleshooting Guide](../TROUBLESHOOTING.md)
- 📖 [Best Practices Guide](./BEST_PRACTICES.md)

