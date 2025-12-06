# Collaboration Features

Comprehensive collaboration system for DevSync VS Code extension and dashboard.

## Features

### ✅ Share Scan Results
- Share scan results with teams, users, or publicly
- Granular permissions (view, comment, approve, request changes)
- Share token generation for public shares
- Expiration support

### ✅ Team Workspaces
- Team creation and management
- Team member roles (owner, admin, member, viewer)
- Team projects
- Team metrics and analytics

### ✅ Comments on Mismatches
- Add comments to specific mismatches
- Threaded comments support
- Comment resolution
- Real-time updates

### ✅ Approval Workflows
- Create approval workflows for migrations
- Multi-step approvals
- Approval/rejection with comments
- Status tracking

### ✅ Change Requests
- Request changes to migrations
- Modify, reject, or request info
- Suggested changes
- Status tracking

### ✅ Activity Feed
- Real-time activity feed
- Filter by team or project
- Activity types: scans, migrations, comments, approvals, etc.

### ✅ Notifications
- In-app notifications
- Email notifications (optional)
- Push notifications (optional)
- Notification preferences

### ✅ Team Metrics
- Total scans and migrations
- Comments and approvals count
- Active members and projects
- Activity breakdown by type
- Most active members
- Recent activity timeline

## Usage

### VS Code Extension

```typescript
import { CollaborationManager } from './collaboration';
import { container } from './di/container';

const apiClient = container.getApiClient();
const context = vscode.extensions.getExtension('devsync').extensionContext;
const collabManager = new CollaborationManager(apiClient, context);

// Share scan result
await collabManager.shareScanResult(
  'scan-123',
  'team-456',
  'team',
  {
    canView: true,
    canComment: true,
    canApprove: false,
    canRequestChanges: false,
  }
);

// Add comment
await collabManager.addComment(
  'scan-123',
  'mismatch-789',
  'This mismatch needs attention'
);

// Create approval workflow
await collabManager.createApprovalWorkflow(
  'migration-123',
  ['user-1', 'user-2'],
  2
);
```

### Dashboard

The dashboard provides web-based access to all collaboration features:

- **Team Collaboration Page**: `/dashboard/teams/[id]/collaboration`
  - Team metrics and analytics
  - Activity feed
  - Most active members

- **Scan Report Collaboration**: `/dashboard/projects/[id]/scan-reports/[reportId]/collaboration`
  - Comments on mismatches
  - Share scan results
  - Approval workflows
  - Change requests

## API Endpoints

### Share
- `POST /api/collaboration/share` - Share a scan result
- `GET /api/collaboration/share` - Get shared scan results

### Comments
- `POST /api/collaboration/comments` - Add a comment
- `GET /api/collaboration/comments` - Get comments
- `PATCH /api/collaboration/comments/[id]` - Update comment (resolve/unresolve)

### Approvals
- `POST /api/collaboration/approvals` - Create approval workflow
- `GET /api/collaboration/approvals` - Get approval workflows
- `PATCH /api/collaboration/approvals/[id]` - Approve/reject migration

### Change Requests
- `POST /api/collaboration/change-requests` - Create change request
- `GET /api/collaboration/change-requests` - Get change requests
- `PATCH /api/collaboration/change-requests/[id]` - Update change request status

### Activity
- `GET /api/collaboration/activity` - Get activity feed

### Metrics
- `GET /api/collaboration/metrics` - Get team metrics

### Notifications
- `GET /api/collaboration/notifications` - Get notifications
- `PATCH /api/collaboration/notifications` - Mark notifications as read

## Authentication & Authorization

All collaboration features require authentication:

- **Team Access**: User must be a team member
- **Project Access**: User must be project owner or team member
- **Shared Access**: User must have been shared with or share is public
- **Permissions**: Based on share permissions or team role

## Database Schema

The collaboration features require the following database tables:

- `shared_scan_results` - Shared scan results
- `mismatch_comments` - Comments on mismatches
- `approval_workflows` - Approval workflows
- `approval_steps` - Approval steps
- `change_requests` - Change requests
- `activity_feed` - Activity feed entries
- `notifications` - User notifications
- `teams` - Teams (existing)
- `team_members` - Team memberships (existing)

## Integration

The collaboration system integrates with:

- **VS Code Extension**: `CollaborationManager` class
- **Dashboard**: API routes and React components
- **Authentication**: Supabase auth
- **Database**: Supabase PostgreSQL
- **Real-time**: Supabase Realtime (for live updates)

## Future Enhancements

- [ ] Real-time collaboration (live cursors, presence)
- [ ] Mentions in comments (@user)
- [ ] Email notifications
- [ ] Webhook support for integrations
- [ ] Advanced permission system
- [ ] Comment reactions
- [ ] File attachments in comments
- [ ] Collaborative editing

