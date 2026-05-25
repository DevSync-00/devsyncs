# Migration History Guide

Track and monitor all migration executions in Dev-Sync.dev.

## Overview

Migration History provides a complete audit trail of all migration executions, including dry runs, actual executions, and any errors encountered.

## Features

- ✅ **Complete Audit Trail** - Every execution is recorded
- ✅ **Execution Details** - Time, affected rows, errors
- ✅ **Multiple Execution Types** - Apply, Rollback, Dry Run
- ✅ **Real-Time Updates** - Auto-refresh for running migrations
- ✅ **Error Tracking** - Detailed error messages for failures

---

## Accessing History

### From Migration Preview

1. Navigate to a scan report with migrations
2. Find the migration you want to review
3. Click **"Show History"** button
4. View execution history for that migration

### What You'll See

- Execution type (Apply, Rollback, Dry Run)
- Execution status (Success, Failed, Running)
- Execution time
- Affected rows
- Error messages (if failed)
- Timestamps

---

## Execution Types

### Apply

**Purpose**: Actually execute the migration on the database

**When It's Created**: When you click "Apply Migration"

**What It Does**:
- Executes the SQL migration
- Modifies the database
- Updates migration status to "Applied"

**Indicators**:
- ✅ Green checkmark if successful
- ❌ Red X if failed
- ⏳ Spinner if running

### Dry Run

**Purpose**: Validate migration without executing

**When It's Created**: When you click "Validate (Dry Run)"

**What It Does**:
- Validates SQL syntax
- Does NOT modify database
- Does NOT update migration status

**Indicators**:
- ✅ Green checkmark if validation passed
- ❌ Red X if validation failed
- ⏳ Spinner if validating

### Rollback

**Purpose**: Rollback a previously applied migration

**Status**: Coming soon

---

## Execution Status

### Running

**Indicator**: ⏳ Spinner icon

**Meaning**: Migration is currently being executed

**What Happens**:
- Execution started
- Status updates automatically
- Page auto-refreshes every 2 seconds

**Actions**: Wait for completion

### Success

**Indicator**: ✅ Green checkmark

**Meaning**: Migration executed successfully

**Details Shown**:
- Execution time
- Affected rows (if available)
- Completion timestamp

**What Happens**:
- Migration marked as "Applied"
- Database updated
- History entry created

### Failed

**Indicator**: ❌ Red X

**Meaning**: Execution failed with an error

**Details Shown**:
- Error message
- Execution time (how long before failure)
- Failure timestamp

**Common Causes**:
- SQL syntax errors
- Constraint violations
- Permission issues
- Database connection problems

**Actions**:
- Fix the error
- Retry execution
- Generate new migration if needed

### Cancelled

**Indicator**: ⏸️ Cancel icon

**Meaning**: Execution was cancelled

**Status**: Currently not supported in UI

---

## History Details

### Execution Time

**What It Is**: How long the migration took to execute (in milliseconds)

**Shown For**: All execution types

**Example**: `250ms` = 0.25 seconds

**Why It Matters**:
- Fast executions (< 1 second) = Small changes
- Slow executions (> 10 seconds) = Large changes
- Very slow (> 1 minute) = Might indicate issues

### Affected Rows

**What It Is**: Number of database rows modified by the migration

**Shown For**: Successful Apply executions

**Example**: `5 rows affected` = 5 rows modified

**Why It Matters**:
- Low numbers = Few changes
- High numbers = Large data migrations
- 0 rows = No data changes (schema only)

### Error Messages

**What It Is**: Detailed error message if execution failed

**Shown For**: Failed executions only

**Format**: Full PostgreSQL error message

**Example**:
```
SQL validation failed: syntax error at or near "INVALID"
```

**How to Use**:
1. Read the error message
2. Identify the issue (syntax, constraint, etc.)
3. Fix the SQL migration
4. Retry execution

---

## Reading History Entries

### Entry Layout

Each history entry shows:

```
[Icon] Execution Type        Status Badge
       Timestamp • Execution Time • Affected Rows
       [Error Message] (if failed)
```

### Example Entry

```
✅ Apply Migration      [Success]
   Nov 1, 2024 10:00 AM • 250ms • 5 rows affected
   Completed: Nov 1, 2024 10:00:05 AM
```

### Failed Entry Example

```
❌ Apply Migration      [Failed]
   Nov 1, 2024 10:00 AM • 50ms
   SQL validation failed: syntax error at or near "INVALID"
```

---

## Auto-Refresh

### When It Happens

- History automatically refreshes every 2 seconds
- Only when there's a "Running" migration
- Stops refreshing when all migrations complete

### Why It's Useful

- See real-time execution progress
- Get status updates automatically
- No need to manually refresh

---

## Filtering and Sorting

### Current Behavior

- Entries sorted by timestamp (newest first)
- Shows all execution types together
- No filtering yet

### Future Enhancements

- Filter by execution type
- Filter by status
- Filter by date range
- Export history to CSV

---

## Use Cases

### 1. Debugging Failed Migrations

**Scenario**: Migration failed, need to understand why

**Steps**:
1. View migration history
2. Find failed execution entry
3. Read error message
4. Fix the issue
5. Retry execution

### 2. Audit Trail

**Scenario**: Need to verify when migrations were applied

**Steps**:
1. View migration history
2. Check timestamps
3. Verify execution order
4. Confirm all migrations applied

### 3. Performance Analysis

**Scenario**: Want to understand migration performance

**Steps**:
1. View migration history
2. Check execution times
3. Compare with affected rows
4. Identify slow migrations

### 4. Troubleshooting

**Scenario**: Migration status unclear, need details

**Steps**:
1. View migration history
2. See all execution attempts
3. Check latest status
4. Understand what happened

---

## API Reference

### Get Migration History

**Endpoint**: `GET /api/migrations/[id]/history`

**Response**:
```json
{
  "history": [
    {
      "id": "history-id-1",
      "migration_id": "migration-id",
      "executed_by": "user-id",
      "execution_type": "apply",
      "status": "success",
      "sql_executed": "BEGIN; ... COMMIT;",
      "error_message": null,
      "execution_time_ms": 250,
      "affected_rows": 5,
      "started_at": "2024-11-01T10:00:00Z",
      "completed_at": "2024-11-01T10:00:05Z"
    },
    {
      "id": "history-id-2",
      "execution_type": "dry-run",
      "status": "success",
      "execution_time_ms": 50,
      "affected_rows": null,
      "started_at": "2024-11-01T09:59:00Z",
      "completed_at": "2024-11-01T09:59:01Z"
    }
  ]
}
```

---

## Best Practices

### 1. Check History Before Retrying

✅ **Do**: View history to understand previous attempts
❌ **Don't**: Retry without understanding why it failed

### 2. Monitor Execution Times

✅ **Do**: Watch execution times to identify slow migrations
❌ **Don't**: Ignore consistently slow executions

### 3. Keep History Clean

✅ **Do**: Review history periodically
❌ **Don't**: Let failed executions accumulate without fixing

### 4. Use History for Debugging

✅ **Do**: Use history entries to debug issues
❌ **Don't**: Skip history when troubleshooting

---

## Troubleshooting

### History Not Showing

**Problem**: Clicked "Show History" but nothing appears

**Solutions**:
- Wait for data to load
- Refresh the page
- Check if migrations have any executions yet
- Verify database connection

### History Not Updating

**Problem**: Running migration but history doesn't update

**Solutions**:
- Wait a few seconds (auto-refresh is every 2 seconds)
- Manually refresh the page
- Check if execution is actually running

### Missing History Entries

**Problem**: Know a migration was executed but no history

**Solutions**:
- Check if history was created (might be a database issue)
- Verify user permissions
- Check database logs

---

## FAQ

**Q: How long is history kept?**
A: History is kept indefinitely. Future versions may include cleanup policies.

**Q: Can I delete history entries?**
A: Not currently supported. History is read-only for audit purposes.

**Q: Can I export history?**
A: Export functionality coming soon. For now, use API to fetch history.

**Q: Does history include rollbacks?**
A: Rollback history will be included when rollback feature is released.

---

## Next Steps

- 📖 [Migration Execution Guide](./MIGRATION_EXECUTION_GUIDE.md)
- 📖 [API Reference](./API_REFERENCE.md)
- 📖 [Troubleshooting Guide](../TROUBLESHOOTING.md)

