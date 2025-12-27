# Analytics Integration Guide

This document explains how the Advanced Analytics Dashboard integrates with the DevSync workflow to automatically track metrics and provide insights.

## Overview

The analytics system automatically records data when:
- **Scans complete**: Stores schema snapshots and calculates drift metrics
- **Migrations execute**: Tracks performance, complexity, and success rates
- **Team activity**: Records developer actions (scans, migrations, fixes, reviews)

## Automatic Data Collection

### 1. Scan Completion (`/api/scans` POST)

When a scan report is created, the system automatically:

1. **Stores Schema Snapshots**
   - Saves database schema state (`db_schema`)
   - Saves code schema state (`code_schema`)
   - Calculates SHA-256 hash for change detection

2. **Calculates Drift Metrics**
   - Compares current schema with previous snapshot
   - Tracks new/removed/changed tables and columns
   - Calculates drift velocity (changes per day)
   - Updates frequently changing objects list

3. **Records Team Activity**
   - Increments scan count for the user
   - Associates activity with team (if applicable)

**Location**: `apps/dashboard/app/api/scans/route.ts`

### 2. Migration Execution (`/api/migrations/[id]/execute` POST)

When a migration is executed (or validated), the system automatically:

1. **Stores Migration Metrics**
   - Execution type (apply, rollback, dry_run)
   - Execution status (success, failed, running)
   - Duration in milliseconds
   - Complexity score (based on SQL analysis)
   - Validation errors/warnings count
   - Breaking changes count
   - Affected tables and rows

2. **Records Team Activity**
   - Increments migration count for the user
   - Associates activity with team (if applicable)

**Location**: `apps/dashboard/app/api/migrations/[id]/execute/route.ts`

## Analytics Services

### Drift Analyzer (`lib/analytics/drift-analyzer.ts`)

**Functions**:
- `storeSchemaSnapshot()`: Save schema state with hash
- `calculateAndStoreDriftMetrics()`: Compare schemas and track changes
- `getDriftTrends()`: Retrieve drift history over time
- `getFrequentlyChangingObjects()`: List tables/columns that change often
- `detectAcceleratingDrift()`: Identify increasing drift velocity (risk signal)

**Usage**:
```typescript
import { storeSchemaSnapshot, calculateAndStoreDriftMetrics } from '@/lib/analytics/drift-analyzer';

// Store snapshot
await storeSchemaSnapshot(supabase, projectId, 'db', dbSchema, mismatchCount, userId);

// Calculate drift
await calculateAndStoreDriftMetrics(supabase, projectId, currentSchema, previousSchema);
```

### Migration Metrics (`lib/analytics/migration-metrics.ts`)

**Functions**:
- `calculateComplexityScore()`: Analyze SQL complexity (0-100)
- `storeMigrationMetric()`: Save execution metrics
- `getMigrationStats()`: Get aggregated statistics
- `correlateMigrationFailures()`: Find patterns in failures

**Usage**:
```typescript
import { storeMigrationMetric, calculateComplexityScore } from '@/lib/analytics/migration-metrics';

const complexity = calculateComplexityScore(sql);
await storeMigrationMetric(supabase, {
  migration_id: migrationId,
  project_id: projectId,
  execution_type: 'apply',
  execution_status: 'success',
  duration_ms: 1500,
  complexity_score: complexity,
  // ... other fields
});
```

### Stability Scorer (`lib/analytics/stability-scorer.ts`)

**Functions**:
- `calculateStabilityScore()`: Compute 0-100 stability score
- `getStabilityScoreHistory()`: Get score trends over time
- `getStabilityScoreExplanation()`: Human-readable explanation

**Score Components**:
- **Drift Velocity** (40% weight): Lower velocity = higher score
- **Migration Failures** (35% weight): Higher success rate = higher score
- **Breaking Changes** (25% weight): Fewer breaking changes = higher score

**Usage**:
```typescript
import { calculateStabilityScore } from '@/lib/analytics/stability-scorer';

const score = await calculateStabilityScore(supabase, projectId);
// Returns: { score: 75, trend: 'improving', factors: {...} }
```

### Team Metrics (`lib/analytics/team-metrics.ts`)

**Functions**:
- `recordTeamActivity()`: Track developer actions
- `getDeveloperActivity()`: Get per-developer metrics
- `getTeamCollaborationMetrics()`: Team-level insights
- `getCollaborationPatterns()`: Cross-project patterns

**Activity Types**:
- `scan`: Schema scan performed
- `migration`: Migration executed
- `fix`: Fix applied
- `review`: Migration reviewed
- `comment`: Comment added

**Usage**:
```typescript
import { recordTeamActivity } from '@/lib/analytics/team-metrics';

await recordTeamActivity(supabase, {
  team_id: teamId,
  user_id: userId,
  project_id: projectId,
  activity_type: 'scan',
});
```

## API Endpoints

### `/api/reporting/analytics`
Main analytics endpoint that aggregates all metrics.

**Query Parameters**:
- `period`: day, week, month, quarter, year
- `teamId`: Filter by team
- `projectIds`: Comma-separated project IDs

**Response Includes**:
- Basic metrics (scans, migrations, mismatches)
- Drift trends and frequently changing objects
- Stability score (current and history)
- Migration performance stats
- Team collaboration metrics

### `/api/analytics/drift`
Get detailed drift analytics for a project.

**Query Parameters**:
- `projectId`: Required
- `days`: Number of days to analyze (default: 30)

**Response**:
```json
{
  "trends": [...],
  "frequentlyChanging": [...],
  "acceleration": {
    "isAccelerating": false,
    "acceleration": 0.5,
    "riskLevel": "low"
  }
}
```

### `/api/analytics/stability`
Get stability score for a project.

**Query Parameters**:
- `projectId`: Required
- `days`: History period (default: 90)

**Response**:
```json
{
  "current": {
    "score": 75,
    "trend": "improving",
    "factors": {...}
  },
  "history": [...],
  "explanation": "Your schema is generally stable..."
}
```

## Dashboard UI

The Enhanced Analytics Dashboard (`components/reporting/EnhancedAnalyticsDashboard.tsx`) displays:

1. **Schema Stability Score Card**
   - Large score display (0-100)
   - Trend indicator (improving/stable/degrading)
   - Component breakdown
   - Historical trend chart

2. **Summary Cards**
   - Total scans with success rate
   - Total migrations with success rate
   - Total mismatches with resolution rate
   - Active projects count

3. **Schema Drift Analytics**
   - Drift trends chart (changes over time)
   - Frequently changing objects list
   - Risk level badges

4. **Migration Performance**
   - Average duration
   - Average complexity
   - Repeat failures count
   - Flaky migrations count

5. **Team Collaboration**
   - Total/active members
   - Activity by member
   - Bottleneck identification

## Background Jobs (Future)

For optimal performance, consider setting up background jobs to:

1. **Calculate Stability Scores**
   - Run daily for all active projects
   - Store in `schema_stability_scores` table

2. **Aggregate Team Activity**
   - Summarize daily activity metrics
   - Calculate activity scores

3. **Cleanup Old Data**
   - Archive snapshots older than 1 year
   - Remove orphaned metrics

## Performance Considerations

- **Async Recording**: Analytics are recorded asynchronously to avoid blocking API responses
- **Error Handling**: Analytics errors are logged but don't fail the main operation
- **Indexes**: All analytics tables have appropriate indexes for fast queries
- **RLS Policies**: Row-level security ensures users only see their own data

## Troubleshooting

### Metrics Not Appearing

1. **Check Database Migration**: Ensure `005_analytics_tables.sql` has been run
2. **Verify RLS Policies**: Check that service role can insert data
3. **Check Logs**: Look for analytics errors in server logs (they're logged as warnings)

### Stability Score Not Calculating

1. **Check Data**: Ensure you have:
   - At least one schema snapshot
   - Migration metrics for the period
   - Drift metrics calculated

2. **Manual Calculation**: You can manually trigger:
   ```typescript
   const score = await calculateStabilityScore(supabase, projectId);
   ```

### Drift Trends Empty

1. **Check Snapshots**: Ensure schema snapshots are being stored
2. **Time Period**: Make sure you're looking at a period with data
3. **Schema Format**: Verify schemas are in the expected format

## Next Steps

1. **Set Up Background Jobs**: Automate stability score calculation
2. **Add Alerts**: Notify when stability degrades or drift accelerates
3. **Export Reports**: Generate PDF/CSV reports for stakeholders
4. **Custom Dashboards**: Allow teams to create custom metric views

