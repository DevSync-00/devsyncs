# Analytics Setup Guide

This guide explains how to set up and configure the Advanced Analytics Dashboard.

## Prerequisites

1. **Database Migration**: Run the analytics migration
2. **Environment Variables**: Configure any required settings
3. **Background Jobs** (Optional): Set up scheduled tasks

## Step 1: Run Database Migration

Execute the analytics tables migration in your Supabase database:

```sql
-- Run: apps/dashboard/supabase/migrations/005_analytics_tables.sql
```

This creates:
- `schema_snapshots` - Historical schema states
- `schema_drift_metrics` - Drift trends over time
- `migration_metrics` - Migration performance data
- `team_activity_metrics` - Per-developer activity
- `schema_stability_scores` - Stability score history
- `frequently_changing_objects` - Risk tracking

## Step 2: Verify Integration

The analytics system automatically records data when:

1. **Scans Complete** (`POST /api/scans`)
   - Schema snapshots are stored
   - Drift metrics are calculated
   - Team activity is recorded

2. **Migrations Execute** (`POST /api/migrations/[id]/execute`)
   - Performance metrics are stored
   - Complexity scores are calculated
   - Success/failure is tracked

## Step 3: View Analytics

### Dashboard
Navigate to `/dashboard/analytics` to see:
- Overall metrics across all projects
- Schema stability scores
- Drift trends
- Migration performance
- Team collaboration metrics

### Project Page
Each project page shows:
- Quick stability score widget
- Drift velocity
- Recent migration failures

## Step 4: Set Up Background Jobs (Optional)

For optimal performance, set up scheduled tasks to:

### Calculate Stability Scores Daily

**Using Cron (Linux/Mac)**:
```bash
# Run daily at 2 AM
0 2 * * * curl -X POST https://your-domain.com/api/analytics/background-jobs \
  -H "Authorization: Bearer <YOUR_ANALYTICS_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"jobs": ["stability"]}'
```

**Using GitHub Actions**:
```yaml
name: Calculate Stability Scores
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:

jobs:
  calculate-stability:
    runs-on: ubuntu-latest
    steps:
      - name: Run Stability Calculation
        run: |
          curl -X POST ${{ secrets.API_URL }}/api/analytics/background-jobs \
            -H "Authorization: Bearer <YOUR_ANALYTICS_CRON_SECRET>" \
            -H "Content-Type: application/json" \
            -d '{"jobs": ["stability"]}'
```

**Using Vercel Cron**:
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/analytics/background-jobs",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Clean Up Old Data Weekly

```bash
# Run weekly on Sunday at 3 AM
0 3 * * 0 curl -X POST https://your-domain.com/api/analytics/background-jobs \
  -H "Authorization: Bearer <YOUR_ANALYTICS_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"jobs": ["cleanup"]}'
```

## Environment Variables

Add to `.env.local`:

```bash
# Optional: Secret key for background job authentication
ANALYTICS_CRON_SECRET=your-secret-key-here
```

## API Endpoints

### Get Analytics
```
GET /api/reporting/analytics?period=month&teamId=xxx&projectIds=xxx,xxx
```

### Get Drift Analytics
```
GET /api/analytics/drift?projectId=xxx&days=30
```

### Get Stability Score
```
GET /api/analytics/stability?projectId=xxx&days=90
```

### Run Background Jobs
```
POST /api/analytics/background-jobs
Authorization: Bearer <YOUR_ANALYTICS_CRON_SECRET>
Content-Type: application/json

{
  "jobs": ["stability", "cleanup", "aggregate"]
}
```

## Troubleshooting

### No Data Appearing

1. **Check Migration**: Ensure `005_analytics_tables.sql` ran successfully
2. **Check RLS Policies**: Verify service role can insert data
3. **Check Logs**: Look for analytics errors in server logs
4. **Run a Scan**: Analytics are recorded when scans complete

### Stability Score Not Calculating

1. **Check Data**: Ensure you have:
   - At least one schema snapshot
   - Migration metrics for the period
   - Drift metrics calculated

2. **Manual Calculation**: Call the API endpoint:
   ```bash
   GET /api/analytics/stability?projectId=YOUR_PROJECT_ID
   ```

3. **Background Job**: Run the background job manually:
   ```bash
   POST /api/analytics/background-jobs
   {"jobs": ["stability"]}
   ```

### Performance Issues

1. **Indexes**: Ensure all indexes are created (check migration)
2. **Data Volume**: Consider cleanup job for old data
3. **Caching**: Add caching layer for frequently accessed metrics

## Data Retention

By default, analytics data is kept indefinitely. To clean up old data:

1. **Run Cleanup Job**: Weekly cleanup removes data older than 365 days
2. **Custom Retention**: Modify `cleanupOldAnalyticsData()` function
3. **Manual Cleanup**: Use SQL to delete specific date ranges

## Best Practices

1. **Regular Scans**: Run scans regularly to build historical data
2. **Monitor Stability**: Check stability scores weekly
3. **Review Drift**: Watch for accelerating drift (risk signal)
4. **Track Failures**: Investigate repeat migration failures
5. **Team Activity**: Use collaboration metrics to identify bottlenecks

## Next Steps

- Set up alerts for stability degradation
- Create custom dashboards for teams
- Export reports for stakeholders
- Integrate with monitoring tools

