/**
 * Permission scoping and role-based access control (RBAC).
 * 
 * Implements fine-grained permission system for controlling access to
 * resources and operations based on user roles and permissions.
 */

import * as vscode from 'vscode';

/**
 * Permission scope
 */
export type PermissionScope =
  | 'scan'
  | 'migrate'
  | 'view_reports'
  | 'manage_config'
  | 'manage_users'
  | 'view_audit_logs'
  | 'manage_api_keys'
  | 'export_data'
  | 'delete_data';

/**
 * User role
 */
export type UserRole = 'admin' | 'developer' | 'viewer' | 'guest';

/**
 * Permission definition
 */
export interface Permission {
  scope: PermissionScope;
  action: 'read' | 'write' | 'delete' | 'execute';
  resource?: string; // Optional resource identifier
}

/**
 * Role definition
 */
export interface Role {
  name: UserRole;
  permissions: Permission[];
  description: string;
}

/**
 * Default role definitions
 */
export const DEFAULT_ROLES: Record<UserRole, Role> = {
  admin: {
    name: 'admin',
    description: 'Full access to all features',
    permissions: [
      { scope: 'scan', action: 'execute' },
      { scope: 'migrate', action: 'execute' },
      { scope: 'view_reports', action: 'read' },
      { scope: 'manage_config', action: 'write' },
      { scope: 'manage_users', action: 'write' },
      { scope: 'view_audit_logs', action: 'read' },
      { scope: 'manage_api_keys', action: 'write' },
      { scope: 'export_data', action: 'read' },
      { scope: 'delete_data', action: 'delete' },
    ],
  },
  developer: {
    name: 'developer',
    description: 'Can scan, migrate, and view reports',
    permissions: [
      { scope: 'scan', action: 'execute' },
      { scope: 'migrate', action: 'execute' },
      { scope: 'view_reports', action: 'read' },
      { scope: 'export_data', action: 'read' },
    ],
  },
  viewer: {
    name: 'viewer',
    description: 'Can only view reports',
    permissions: [
      { scope: 'view_reports', action: 'read' },
    ],
  },
  guest: {
    name: 'guest',
    description: 'Limited read-only access',
    permissions: [
      { scope: 'view_reports', action: 'read' },
    ],
  },
};

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: UserRole;
  requiredPermission?: Permission;
}

/**
 * Permission manager
 */
export class PermissionManager {
  private userRole: UserRole = 'guest';
  private customPermissions: Permission[] = [];
  private permissionEmitter = new vscode.EventEmitter<{
    userId: string;
    role: UserRole;
    permissions: Permission[];
  }>();
  public readonly onPermissionsChange = this.permissionEmitter.event;

  constructor(
    private context: vscode.ExtensionContext,
    private userId?: string
  ) {
    void this.loadPermissions();
  }

  /**
   * Set user role
   */
  async setRole(userId: string, role: UserRole): Promise<void> {
    this.userId = userId;
    this.userRole = role;
    await this.savePermissions();
    this.permissionEmitter.fire({
      userId,
      role,
      permissions: this.getPermissions(),
    });
  }

  /**
   * Add custom permission
   */
  async addPermission(permission: Permission): Promise<void> {
    // Check if permission already exists
    const exists = this.customPermissions.some(
      (p) => p.scope === permission.scope && p.action === permission.action
    );

    if (!exists) {
      this.customPermissions.push(permission);
      await this.savePermissions();
      if (this.userId) {
        this.permissionEmitter.fire({
          userId: this.userId,
          role: this.userRole,
          permissions: this.getPermissions(),
        });
      }
    }
  }

  /**
   * Remove custom permission
   */
  async removePermission(scope: PermissionScope, action: 'read' | 'write' | 'delete' | 'execute'): Promise<void> {
    this.customPermissions = this.customPermissions.filter(
      (p) => !(p.scope === scope && p.action === action)
    );
    await this.savePermissions();
    if (this.userId) {
      this.permissionEmitter.fire({
        userId: this.userId,
        role: this.userRole,
        permissions: this.getPermissions(),
      });
    }
  }

  /**
   * Check if user has permission
   */
  hasPermission(
    scope: PermissionScope,
    action: 'read' | 'write' | 'delete' | 'execute',
    resource?: string
  ): PermissionCheckResult {
    const permissions = this.getPermissions();

    // Check for exact match
    const hasExact = permissions.some(
      (p) => p.scope === scope && p.action === action && (!resource || p.resource === resource)
    );

    if (hasExact) {
      return { allowed: true };
    }

    // Check for wildcard resource
    const hasWildcard = permissions.some(
      (p) => p.scope === scope && p.action === action && !p.resource
    );

    if (hasWildcard) {
      return { allowed: true };
    }

    // Check if admin role (has all permissions)
    if (this.userRole === 'admin') {
      return { allowed: true };
    }

    // Permission denied
    const role = DEFAULT_ROLES[this.userRole];
    return {
      allowed: false,
      reason: `Permission denied: ${action} on ${scope}`,
      requiredRole: 'admin',
      requiredPermission: { scope, action, resource },
    };
  }

  /**
   * Require permission (throws if not allowed)
   */
  requirePermission(
    scope: PermissionScope,
    action: 'read' | 'write' | 'delete' | 'execute',
    resource?: string
  ): void {
    const result = this.hasPermission(scope, action, resource);
    if (!result.allowed) {
      throw new PermissionError(
        result.reason || 'Permission denied',
        scope,
        action,
        resource
      );
    }
  }

  /**
   * Get all permissions for current user
   */
  getPermissions(): Permission[] {
    const role = DEFAULT_ROLES[this.userRole];
    return [...role.permissions, ...this.customPermissions];
  }

  /**
   * Get current user role
   */
  getRole(): UserRole {
    return this.userRole;
  }

  /**
   * Check if user has role
   */
  hasRole(role: UserRole): boolean {
    return this.userRole === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(...roles: UserRole[]): boolean {
    return roles.includes(this.userRole);
  }

  /**
   * Load permissions from storage
   */
  private async loadPermissions(): Promise<void> {
    try {
      const stored = this.context.globalState.get<{
        role: UserRole;
        permissions: Permission[];
      }>('devsync.permissions');

      if (stored) {
        this.userRole = stored.role;
        this.customPermissions = stored.permissions || [];
      }
    } catch (error) {
      console.error('[Permissions] Failed to load permissions:', error);
    }
  }

  /**
   * Save permissions to storage
   */
  private async savePermissions(): Promise<void> {
    try {
      await this.context.globalState.update('devsync.permissions', {
        role: this.userRole,
        permissions: this.customPermissions,
      });
    } catch (error) {
      console.error('[Permissions] Failed to save permissions:', error);
    }
  }
}

/**
 * Permission error
 */
export class PermissionError extends Error {
  constructor(
    message: string,
    public readonly scope: PermissionScope,
    public readonly action: 'read' | 'write' | 'delete' | 'execute',
    public readonly resource?: string
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Permission decorator for functions
 */
export function RequirePermission(
  scope: PermissionScope,
  action: 'read' | 'write' | 'delete' | 'execute',
  resource?: string
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (this: { permissionManager?: PermissionManager }, ...args: unknown[]) {
      if (!this.permissionManager) {
        throw new Error('PermissionManager not available');
      }

      this.permissionManager.requirePermission(scope, action, resource);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

