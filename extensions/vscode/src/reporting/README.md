# Reporting & Analytics

Comprehensive reporting and analytics system for DevSync VS Code extension and dashboard.

## Features

### ✅ Dashboard with Metrics
- Real-time metrics dashboard
- Scans, migrations, mismatches, and projects metrics
- Team metrics (if team context)
- Period-based filtering (day/week/month/quarter/year)
- Success rates and averages

### ✅ Trend Analysis
- Time-series trend analysis
- Multiple metrics support (scans, migrations, mismatches)
- Period comparison (current vs previous)
- Change percentage calculation
- Trend direction (up/down/stable)

### ✅ Export Reports
- Multiple export formats (JSON, CSV, HTML)
- Configurable export options
- Include/exclude charts and raw data
- Custom file naming

### ✅ Custom Report Templates
- Built-in templates (scan summary, migration summary, team activity, etc.)
- User-created custom templates
- Template-based report generation
- Template preview

### ✅ Scheduled Reports
- Daily, weekly, monthly scheduling
- Custom schedule time and day
- Email recipients list
- Automatic report generation
- Enable/disable scheduling

### ✅ CI/CD Integration
- Webhook-based integration
- Support for GitHub Actions, GitLab CI, Jenkins, CircleCI, custom
- Event-based triggers (scan complete, migration applied, mismatch detected)
- Secret token authentication
- Team-level integrations

## Usage

### VS Code Extension

```typescript
import { ReportingManager } from './reporting';
import { container } from './di/container';

const apiClient = container.getApiClient();
const context = vscode.extensions.getExtension('devsync').extensionContext;
const reportingManager = new ReportingManager(apiClient, context);

// Get analytics metrics
const metrics = await reportingManager.getAnalyticsMetrics('month', 'team-123');

// Generate report
const report = await reportingManager.generateReport({
  id: 'report-1',
  name: 'Monthly Summary',
  type: 'scan_summary',
  format: 'html',
  period: 'month',
  includeMetrics: true,
  includeTrends: true,
  includeCharts: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Export report
const exportData = await reportingManager.exportReport('report-1', {
  format: 'csv',
  includeCharts: false,
  includeRawData: true,
});
```

### Dashboard

The dashboard provides web-based access to all reporting features:

- **Analytics Dashboard**: `/dashboard/analytics`
  - Real-time metrics visualization
  - Period selection
  - Export options
  - Team filtering

- **Scheduled Reports**: Manage via API or UI
  - Create, update, delete scheduled reports
  - Configure recipients and schedule

- **Report Templates**: Manage via API
  - Use built-in templates
  - Create custom templates

- **CI/CD Integration**: Manage via API
  - Create webhook integrations
  - Configure event triggers

## API Endpoints

### Analytics
- `GET /api/reporting/analytics` - Get analytics metrics
  - Query params: `period`, `teamId`, `projectIds`

### Trends
- `GET /api/reporting/trends` - Get trend analysis
  - Query params: `period`, `teamId`, `projectIds`, `metric`

### Export
- `POST /api/reporting/export` - Export a report
  - Body: `reportId`, `format`, `includeCharts`, `includeRawData`, `fileName`

### Scheduled Reports
- `POST /api/reporting/scheduled` - Create scheduled report
- `GET /api/reporting/scheduled` - Get scheduled reports
- `PATCH /api/reporting/scheduled/[id]` - Update scheduled report
- `DELETE /api/reporting/scheduled/[id]` - Delete scheduled report

### Templates
- `GET /api/reporting/templates` - Get report templates
- `POST /api/reporting/templates` - Create custom template

### CI/CD Integration
- `POST /api/reporting/cicd` - Create CI/CD integration
- `GET /api/reporting/cicd` - Get CI/CD integrations
- `PATCH /api/reporting/cicd/[id]` - Update CI/CD integration
- `DELETE /api/reporting/cicd/[id]` - Delete CI/CD integration

## Authentication & Authorization

All reporting features require authentication:

- **User Reports**: User must be authenticated
- **Team Reports**: User must be team member
- **Scheduled Reports**: User must own or be team admin
- **CI/CD Integrations**: User must own or be team admin

## Database Schema

The reporting features require the following database tables:

- `reports` - Generated reports
- `scheduled_reports` - Scheduled report configurations
- `report_templates` - Custom report templates
- `cicd_integrations` - CI/CD integration configurations

## Integration

The reporting system integrates with:

- **VS Code Extension**: `ReportingManager` class
- **Dashboard**: API routes and React components
- **Authentication**: Supabase auth
- **Database**: Supabase PostgreSQL
- **Email**: Email service (for scheduled reports)
- **CI/CD**: Webhook integrations

## Future Enhancements

- [ ] PDF export format
- [ ] Excel export format
- [ ] Real-time dashboard updates
- [ ] Custom chart types
- [ ] Report sharing
- [ ] Email templates for scheduled reports
- [ ] Advanced filtering and grouping
- [ ] Report comparison
- [ ] Automated insights and recommendations

