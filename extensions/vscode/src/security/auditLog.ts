/**
 * Audit logging service.
 * 
 * Logs all security-relevant events including authentication, authorization,
 * and sensitive operations for compliance and security monitoring.
 */

import * as vscode from 'vscode';

/**
 * Audit log event type
 */
export type AuditEventType =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.token_refresh'
  | 'auth.token_rotation'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'auth.mfa_verified'
  | 'auth.session_expired'
  | 'auth.session_extended'
  | 'config.sensitive_updated'
  | 'config.encryption_key_rotated'
  | 'permission.granted'
  | 'permission.revoked'
  | 'permission.denied'
  | 'data.encrypted'
  | 'data.decrypted'
  | 'error.security_violation'
  | 'error.authentication_failed'
  | 'error.authorization_failed';

/**
 * Audit log event severity
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: number;
  type: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action: string;
  result: 'success' | 'failure' | 'denied';
  details?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Audit log storage interface
 */
export interface IAuditLogStorage {
  /**
   * Store audit log entry
   */
  store(entry: AuditLogEntry): Promise<void>;

  /**
   * Query audit logs
   */
  query(filters: AuditLogQuery): Promise<AuditLogEntry[]>;

  /**
   * Clear old audit logs
   */
  clearOld(olderThan: number): Promise<number>;
}

/**
 * Audit log query filters
 */
export interface AuditLogQuery {
  userId?: string;
  type?: AuditEventType | AuditEventType[];
  severity?: AuditSeverity | AuditSeverity[];
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

/**
 * In-memory audit log storage (for development)
 */
class MemoryAuditLogStorage implements IAuditLogStorage {
  private logs: AuditLogEntry[] = [];
  private maxLogs = 10000; // Keep last 10k entries

  async store(entry: AuditLogEntry): Promise<void> {
    this.logs.push(entry);

    // Trim if too many logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  async query(filters: AuditLogQuery): Promise<AuditLogEntry[]> {
    let results = [...this.logs];

    if (filters.userId) {
      results = results.filter((log) => log.userId === filters.userId);
    }

    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      results = results.filter((log) => types.includes(log.type));
    }

    if (filters.severity) {
      const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      results = results.filter((log) => severities.includes(log.severity));
    }

    if (filters.startTime) {
      results = results.filter((log) => log.timestamp >= filters.startTime!);
    }

    if (filters.endTime) {
      results = results.filter((log) => log.timestamp <= filters.endTime!);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;

    return results.slice(offset, offset + limit);
  }

  async clearOld(olderThan: number): Promise<number> {
    const before = this.logs.length;
    const cutoff = Date.now() - olderThan;
    this.logs = this.logs.filter((log) => log.timestamp >= cutoff);
    return before - this.logs.length;
  }
}

/**
 * File-based audit log storage (for production)
 */
class FileAuditLogStorage implements IAuditLogStorage {
  private logFile: vscode.Uri;
  private logs: AuditLogEntry[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.logFile = vscode.Uri.joinPath(
      context.globalStorageUri,
      'audit-logs.json'
    );
    void this.loadLogs();
  }

  private async loadLogs(): Promise<void> {
    try {
      const data = await vscode.workspace.fs.readFile(this.logFile);
      const text = new TextDecoder().decode(data);
      this.logs = JSON.parse(text) as AuditLogEntry[];
    } catch {
      // File doesn't exist yet, start with empty array
      this.logs = [];
    }
  }

  private async saveLogs(): Promise<void> {
    try {
      const text = JSON.stringify(this.logs, null, 2);
      const data = new TextEncoder().encode(text);
      await vscode.workspace.fs.writeFile(this.logFile, data);
    } catch (error) {
      console.error('[AuditLog] Failed to save logs:', error);
    }
  }

  async store(entry: AuditLogEntry): Promise<void> {
    this.logs.push(entry);
    await this.saveLogs();
  }

  async query(filters: AuditLogQuery): Promise<AuditLogEntry[]> {
    await this.loadLogs(); // Reload to get latest

    let results = [...this.logs];

    if (filters.userId) {
      results = results.filter((log) => log.userId === filters.userId);
    }

    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      results = results.filter((log) => types.includes(log.type));
    }

    if (filters.severity) {
      const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
      results = results.filter((log) => severities.includes(log.severity));
    }

    if (filters.startTime) {
      results = results.filter((log) => log.timestamp >= filters.startTime!);
    }

    if (filters.endTime) {
      results = results.filter((log) => log.timestamp <= filters.endTime!);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    const offset = filters.offset || 0;
    const limit = filters.limit || 100;

    return results.slice(offset, offset + limit);
  }

  async clearOld(olderThan: number): Promise<number> {
    await this.loadLogs();
    const before = this.logs.length;
    const cutoff = Date.now() - olderThan;
    this.logs = this.logs.filter((log) => log.timestamp >= cutoff);
    await this.saveLogs();
    return before - this.logs.length;
  }
}

/**
 * Audit logger service
 */
export class AuditLogger {
  private storage: IAuditLogStorage;
  private sessionId: string;
  private userId?: string;

  constructor(
    context: vscode.ExtensionContext,
    useFileStorage: boolean = true
  ) {
    this.storage = useFileStorage
      ? new FileAuditLogStorage(context)
      : new MemoryAuditLogStorage();
    this.sessionId = this.generateSessionId();
  }

  /**
   * Set current user ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Log an audit event
   */
  async log(
    type: AuditEventType,
    action: string,
    result: 'success' | 'failure' | 'denied',
    options: {
      severity?: AuditSeverity;
      resource?: string;
      details?: Record<string, unknown>;
      error?: Error;
    } = {}
  ): Promise<void> {
    const severity = options.severity || this.getDefaultSeverity(type, result);
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      severity,
      userId: this.userId,
      sessionId: this.sessionId,
      resource: options.resource,
      action,
      result,
      details: options.details,
      error: options.error
        ? {
            code: (options.error as { code?: string }).code || 'UNKNOWN',
            message: options.error.message,
          }
        : undefined,
    };

    await this.storage.store(entry);

    // Log to console in development
    if (severity === 'error' || severity === 'critical') {
      console.error('[AuditLog]', entry);
    } else if (severity === 'warning') {
      console.warn('[AuditLog]', entry);
    }
  }

  /**
   * Query audit logs
   */
  async query(filters: AuditLogQuery): Promise<AuditLogEntry[]> {
    return await this.storage.query(filters);
  }

  /**
   * Clear old audit logs
   */
  async clearOld(days: number): Promise<number> {
    const olderThan = days * 24 * 60 * 60 * 1000;
    return await this.storage.clearOld(olderThan);
  }

  /**
   * Get default severity for event type and result
   */
  private getDefaultSeverity(
    type: AuditEventType,
    result: 'success' | 'failure' | 'denied'
  ): AuditSeverity {
    if (result === 'denied' || result === 'failure') {
      if (type.startsWith('error.')) {
        return 'critical';
      }
      return 'error';
    }

    if (type.includes('token_rotation') || type.includes('mfa')) {
      return 'warning';
    }

    return 'info';
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Start new session
   */
  startNewSession(): void {
    this.sessionId = this.generateSessionId();
  }
}

