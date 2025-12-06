/**
 * Collaboration features types and interfaces.
 * 
 * Comprehensive type definitions for team collaboration features.
 */

/**
 * Team member role.
 */
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Team information.
 */
export interface Team {
  /**
   * Team ID.
   */
  id: string;
  
  /**
   * Team name.
   */
  name: string;
  
  /**
   * Team slug.
   */
  slug: string;
  
  /**
   * Team description.
   */
  description?: string;
  
  /**
   * Team avatar URL.
   */
  avatarUrl?: string;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
  
  /**
   * Updated timestamp.
   */
  updatedAt: string;
  
  /**
   * Member count.
   */
  memberCount?: number;
  
  /**
   * Project count.
   */
  projectCount?: number;
}

/**
 * Team member.
 */
export interface TeamMember {
  /**
   * Membership ID.
   */
  id: string;
  
  /**
   * Team ID.
   */
  teamId: string;
  
  /**
   * User ID.
   */
  userId: string;
  
  /**
   * User email.
   */
  userEmail?: string;
  
  /**
   * User name.
   */
  userName?: string;
  
  /**
   * Member role.
   */
  role: TeamRole;
  
  /**
   * Joined timestamp.
   */
  joinedAt: string;
}

/**
 * Shared scan result.
 */
export interface SharedScanResult {
  /**
   * Share ID.
   */
  id: string;
  
  /**
   * Scan report ID.
   */
  scanReportId: string;
  
  /**
   * Shared by user ID.
   */
  sharedBy: string;
  
  /**
   * Shared with (team ID or user ID).
   */
  sharedWith: string;
  
  /**
   * Share type.
   */
  shareType: 'team' | 'user' | 'public';
  
  /**
   * Share token (for public shares).
   */
  shareToken?: string;
  
  /**
   * Permissions.
   */
  permissions: SharePermissions;
  
  /**
   * Expires at (optional).
   */
  expiresAt?: string;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
}

/**
 * Share permissions.
 */
export interface SharePermissions {
  /**
   * Can view.
   */
  canView: boolean;
  
  /**
   * Can comment.
   */
  canComment: boolean;
  
  /**
   * Can approve.
   */
  canApprove: boolean;
  
  /**
   * Can request changes.
   */
  canRequestChanges: boolean;
}

/**
 * Comment on mismatch.
 */
export interface MismatchComment {
  /**
   * Comment ID.
   */
  id: string;
  
  /**
   * Scan report ID.
   */
  scanReportId: string;
  
  /**
   * Mismatch identifier.
   */
  mismatchId: string;
  
  /**
   * Comment author ID.
   */
  authorId: string;
  
  /**
   * Comment author name.
   */
  authorName?: string;
  
  /**
   * Comment author avatar.
   */
  authorAvatar?: string;
  
  /**
   * Comment content.
   */
  content: string;
  
  /**
   * Comment thread ID (for replies).
   */
  threadId?: string;
  
  /**
   * Parent comment ID (for replies).
   */
  parentId?: string;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
  
  /**
   * Updated timestamp.
   */
  updatedAt: string;
  
  /**
   * Is resolved.
   */
  resolved: boolean;
  
  /**
   * Resolved by user ID.
   */
  resolvedBy?: string;
  
  /**
   * Resolved at timestamp.
   */
  resolvedAt?: string;
}

/**
 * Approval workflow.
 */
export interface ApprovalWorkflow {
  /**
   * Workflow ID.
   */
  id: string;
  
  /**
   * Migration ID.
   */
  migrationId: string;
  
  /**
   * Workflow status.
   */
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  
  /**
   * Required approvals.
   */
  requiredApprovals: number;
  
  /**
   * Current approvals.
   */
  currentApprovals: number;
  
  /**
   * Approvers.
   */
  approvers: ApprovalStep[];
  
  /**
   * Created timestamp.
   */
  createdAt: string;
  
  /**
   * Updated timestamp.
   */
  updatedAt: string;
  
  /**
   * Completed timestamp.
   */
  completedAt?: string;
}

/**
 * Approval step.
 */
export interface ApprovalStep {
  /**
   * Step ID.
   */
  id: string;
  
  /**
   * Approver user ID.
   */
  approverId: string;
  
  /**
   * Approver name.
   */
  approverName?: string;
  
  /**
   * Approval status.
   */
  status: 'pending' | 'approved' | 'rejected';
  
  /**
   * Approval comment.
   */
  comment?: string;
  
  /**
   * Approved/rejected timestamp.
   */
  actionedAt?: string;
  
  /**
   * Step order.
   */
  order: number;
}

/**
 * Change request.
 */
export interface ChangeRequest {
  /**
   * Change request ID.
   */
  id: string;
  
  /**
   * Migration ID.
   */
  migrationId: string;
  
  /**
   * Requested by user ID.
   */
  requestedBy: string;
  
  /**
   * Requested by name.
   */
  requestedByName?: string;
  
  /**
   * Change request type.
   */
  type: 'modify' | 'reject' | 'request_info';
  
  /**
   * Change request title.
   */
  title: string;
  
  /**
   * Change request description.
   */
  description: string;
  
  /**
   * Suggested changes (for modify type).
   */
  suggestedChanges?: string;
  
  /**
   * Status.
   */
  status: 'open' | 'in_review' | 'accepted' | 'rejected' | 'closed';
  
  /**
   * Assigned to user ID.
   */
  assignedTo?: string;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
  
  /**
   * Updated timestamp.
   */
  updatedAt: string;
  
  /**
   * Closed timestamp.
   */
  closedAt?: string;
}

/**
 * Activity feed entry.
 */
export interface ActivityEntry {
  /**
   * Activity ID.
   */
  id: string;
  
  /**
   * Activity type.
   */
  type: ActivityType;
  
  /**
   * Actor user ID.
   */
  actorId: string;
  
  /**
   * Actor name.
   */
  actorName?: string;
  
  /**
   * Actor avatar.
   */
  actorAvatar?: string;
  
  /**
   * Target entity type.
   */
  targetType: 'scan' | 'migration' | 'comment' | 'approval' | 'change_request' | 'team';
  
  /**
   * Target entity ID.
   */
  targetId: string;
  
  /**
   * Activity description.
   */
  description: string;
  
  /**
   * Activity metadata.
   */
  metadata?: Record<string, any>;
  
  /**
   * Team ID (if team activity).
   */
  teamId?: string;
  
  /**
   * Project ID (if project activity).
   */
  projectId?: string;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
}

/**
 * Activity type.
 */
export type ActivityType =
  | 'scan_created'
  | 'scan_completed'
  | 'migration_generated'
  | 'migration_applied'
  | 'migration_rolled_back'
  | 'comment_added'
  | 'comment_resolved'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_rejected'
  | 'change_request_created'
  | 'change_request_accepted'
  | 'change_request_rejected'
  | 'team_member_added'
  | 'team_member_removed'
  | 'project_shared'
  | 'project_unshared';

/**
 * Notification.
 */
export interface Notification {
  /**
   * Notification ID.
   */
  id: string;
  
  /**
   * User ID (recipient).
   */
  userId: string;
  
  /**
   * Notification type.
   */
  type: NotificationType;
  
  /**
   * Notification title.
   */
  title: string;
  
  /**
   * Notification message.
   */
  message: string;
  
  /**
   * Notification data.
   */
  data?: Record<string, any>;
  
  /**
   * Is read.
   */
  read: boolean;
  
  /**
   * Read timestamp.
   */
  readAt?: string;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
  
  /**
   * Action URL (if applicable).
   */
  actionUrl?: string;
}

/**
 * Notification type.
 */
export type NotificationType =
  | 'scan_complete'
  | 'migration_ready'
  | 'comment_added'
  | 'comment_mention'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_rejected'
  | 'change_request_created'
  | 'change_request_accepted'
  | 'change_request_rejected'
  | 'team_invite'
  | 'team_member_added'
  | 'project_shared'
  | 'mention';

/**
 * Team metrics.
 */
export interface TeamMetrics {
  /**
   * Team ID.
   */
  teamId: string;
  
  /**
   * Period start.
   */
  periodStart: string;
  
  /**
   * Period end.
   */
  periodEnd: string;
  
  /**
   * Total scans.
   */
  totalScans: number;
  
  /**
   * Total migrations.
   */
  totalMigrations: number;
  
  /**
   * Total comments.
   */
  totalComments: number;
  
  /**
   * Total approvals.
   */
  totalApprovals: number;
  
  /**
   * Active members.
   */
  activeMembers: number;
  
  /**
   * Active projects.
   */
  activeProjects: number;
  
  /**
   * Scans by status.
   */
  scansByStatus: Record<string, number>;
  
  /**
   * Migrations by status.
   */
  migrationsByStatus: Record<string, number>;
  
  /**
   * Activity by type.
   */
  activityByType: Record<ActivityType, number>;
  
  /**
   * Most active members.
   */
  mostActiveMembers: Array<{
    userId: string;
    userName?: string;
    activityCount: number;
  }>;
  
  /**
   * Recent activity.
   */
  recentActivity: ActivityEntry[];
}

/**
 * Collaboration settings.
 */
export interface CollaborationSettings {
  /**
   * Enable team workspaces.
   */
  enableTeams: boolean;
  
  /**
   * Enable comments.
   */
  enableComments: boolean;
  
  /**
   * Enable approvals.
   */
  enableApprovals: boolean;
  
  /**
   * Enable change requests.
   */
  enableChangeRequests: boolean;
  
  /**
   * Enable activity feed.
   */
  enableActivityFeed: boolean;
  
  /**
   * Enable notifications.
   */
  enableNotifications: boolean;
  
  /**
   * Default approval required count.
   */
  defaultApprovalCount: number;
  
  /**
   * Notification preferences.
   */
  notificationPreferences: {
    email: boolean;
    inApp: boolean;
    push: boolean;
  };
}

