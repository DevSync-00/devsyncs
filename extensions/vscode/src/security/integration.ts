/**
 * Security integration module.
 * 
 * Integrates all security features with the extension's authentication and command systems.
 */

import * as vscode from 'vscode';
import type { IAuthManager } from '../interfaces';
import {
  AuditLogger,
  TokenRotationManager,
  SessionTimeoutManager,
  PermissionManager,
  EncryptionService,
  createEncryptionService,
  DataProtectionManager,
  createDataProtectionManager,
  InputValidationManager,
  createInputValidationManager,
} from './index';

/**
 * Security manager that coordinates all security features
 */
export class SecurityManager {
  public readonly auditLogger: AuditLogger;
  public readonly tokenRotation: TokenRotationManager;
  public readonly sessionTimeout: SessionTimeoutManager;
  public readonly permissions: PermissionManager;
  public readonly inputValidation: InputValidationManager;
  public encryption!: EncryptionService; // Initialized asynchronously
  public dataProtection!: DataProtectionManager; // Initialized asynchronously

  private subscriptions: vscode.Disposable[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private authManager: IAuthManager
  ) {
    // Initialize security services
    this.auditLogger = new AuditLogger(context, true);
    this.tokenRotation = new TokenRotationManager(authManager);
    this.sessionTimeout = new SessionTimeoutManager(authManager);
    this.permissions = new PermissionManager(context);
    this.inputValidation = createInputValidationManager(context);
    // Encryption and data protection will be initialized asynchronously
    void this.initializeServices();
  }

  /**
   * Initialize encryption and data protection services
   */
  private async initializeServices(): Promise<void> {
    this.encryption = await createEncryptionService(this.context);
    this.dataProtection = await createDataProtectionManager(this.context, this.encryption);
  }

  /**
   * Start all security monitoring
   */
  start(): void {
    // Start token rotation
    this.tokenRotation.start();

    // Start session timeout monitoring
    this.sessionTimeout.start();

    // Listen for authentication events and log them
    this.subscriptions.push(
      this.authManager.onDidChangeSession(async (session) => {
        await this.handleSessionChange(session);
      })
    );

    // Listen for token rotation events
    this.subscriptions.push(
      this.tokenRotation.onTokenRotation(async (event) => {
        await this.auditLogger.log(
          'auth.token_rotation',
          `Token ${event.tokenType} ${event.type}`,
          event.type === 'rotated' ? 'success' : 'failure',
          {
            severity: event.type === 'rotated' ? 'info' : 'warning',
            details: {
              tokenType: event.tokenType,
              timestamp: event.timestamp,
            },
            error: event.error,
          }
        );
      })
    );

    // Listen for session timeout warnings
    this.subscriptions.push(
      this.sessionTimeout.onTimeoutWarning(async (warning) => {
        await this.auditLogger.log(
          'auth.session_expired',
          `Session ${warning.type}: ${warning.message}`,
          warning.type === 'expired' ? 'failure' : 'success',
          {
            severity: warning.severity,
            details: {
              timeRemaining: warning.timeRemaining,
              type: warning.type,
            },
          }
        );
      })
    );
  }

  /**
   * Handle session changes
   */
  private async handleSessionChange(session: import('../types').AuthSessionState): Promise<void> {
    if (session.status === 'authenticated') {
      // User logged in
      await this.auditLogger.log('auth.login', 'User logged in', 'success', {
        severity: 'info',
        details: {
          userId: session.userId,
          clientId: session.clientId,
        },
      });

      if (session.userId) {
        this.auditLogger.setUserId(session.userId);
        // Set default role (can be updated based on user data from API)
        await this.permissions.setRole(session.userId, 'developer');
      }

      // Start new audit session
      this.auditLogger.startNewSession();
    } else if (session.status === 'unauthenticated') {
      // User logged out
      await this.auditLogger.log('auth.logout', 'User logged out', 'success', {
        severity: 'info',
      });
    } else if (session.status === 'authenticating') {
      // Authentication in progress
      await this.auditLogger.log('auth.login', 'Authentication started', 'success', {
        severity: 'info',
      });
    }
  }

  /**
   * Check permission before executing command
   */
  checkPermission(
    scope: import('./permissions').PermissionScope,
    action: 'read' | 'write' | 'delete' | 'execute',
    resource?: string
  ): boolean {
    const result = this.permissions.hasPermission(scope, action, resource);

    if (!result.allowed) {
      void this.auditLogger.log(
        'permission.denied',
        `Permission denied: ${action} on ${scope}`,
        'denied',
        {
          severity: 'warning',
          resource,
          details: {
            scope,
            action,
            requiredRole: result.requiredRole,
          },
        }
      );
    }

    return result.allowed;
  }

  /**
   * Require permission (throws if not allowed)
   */
  requirePermission(
    scope: import('./permissions').PermissionScope,
    action: 'read' | 'write' | 'delete' | 'execute',
    resource?: string
  ): void {
    this.permissions.requirePermission(scope, action, resource);
  }

  /**
   * Dispose of security manager
   */
  dispose(): void {
    this.tokenRotation.dispose();
    this.sessionTimeout.dispose();
    this.inputValidation.dispose();
    this.subscriptions.forEach((sub) => sub.dispose());
    this.subscriptions = [];
  }
}

/**
 * Create and initialize security manager
 */
export async function createSecurityManager(
  context: vscode.ExtensionContext,
  authManager: IAuthManager
): Promise<SecurityManager> {
  const manager = new SecurityManager(context, authManager);
  manager.start();
  return manager;
}

