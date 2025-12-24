/**
 * Token rotation manager.
 * 
 * Implements automatic token rotation to enhance security by periodically
 * refreshing access tokens and rotating refresh tokens.
 */

import * as vscode from 'vscode';
import type { IAuthManager } from '../interfaces';

/**
 * Token rotation configuration
 */
export interface TokenRotationConfig {
  /**
   * Maximum age of access token before rotation (in milliseconds)
   * Default: 1 hour
   */
  maxAccessTokenAge: number;

  /**
   * Maximum age of refresh token before rotation (in milliseconds)
   * Default: 30 days
   */
  maxRefreshTokenAge: number;

  /**
   * Interval to check for token rotation (in milliseconds)
   * Default: 5 minutes
   */
  checkInterval: number;

  /**
   * Enable automatic rotation
   * Default: true
   */
  enabled: boolean;
}

/**
 * Token rotation event
 */
export interface TokenRotationEvent {
  type: 'rotated' | 'rotation_failed' | 'rotation_required';
  timestamp: number;
  tokenType: 'access' | 'refresh';
  error?: Error;
}

/**
 * Token rotation manager
 */
export class TokenRotationManager {
  private rotationTimer: NodeJS.Timeout | null = null;
  private lastRotationTime: number = Date.now(); // Initialize to current time to avoid false warnings
  private rotationEmitter = new vscode.EventEmitter<TokenRotationEvent>();
  public readonly onTokenRotation = this.rotationEmitter.event;

  constructor(
    private authManager: IAuthManager,
    private config: TokenRotationConfig = {
      maxAccessTokenAge: 60 * 60 * 1000, // 1 hour
      maxRefreshTokenAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      checkInterval: 5 * 60 * 1000, // 5 minutes
      enabled: true,
    }
  ) {}

  /**
   * Start automatic token rotation
   */
  start(): void {
    if (!this.config.enabled) {
      return;
    }

    this.stop(); // Clear any existing timer

    // Check immediately
    void this.checkAndRotate();

    // Set up periodic checks
    this.rotationTimer = setInterval(() => {
      void this.checkAndRotate();
    }, this.config.checkInterval);
  }

  /**
   * Stop automatic token rotation
   */
  stop(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  /**
   * Manually trigger token rotation
   */
  async rotateNow(): Promise<void> {
    await this.checkAndRotate(true);
  }

  /**
   * Check if rotation is needed and perform it
   */
  private async checkAndRotate(force: boolean = false): Promise<void> {
    try {
      const session = this.authManager.getSession();

      if (session.status !== 'authenticated') {
        return; // Not authenticated, no rotation needed
      }

      if (!session.expiresAt) {
        return; // No expiration info
      }

      const now = Date.now();
      const timeUntilExpiry = session.expiresAt - now;
      const timeSinceLastRotation = now - this.lastRotationTime;

      // Check if access token needs rotation
      const accessTokenAge = timeUntilExpiry < 0 
        ? Math.abs(timeUntilExpiry) 
        : this.config.maxAccessTokenAge - timeUntilExpiry;

      if (force || accessTokenAge >= this.config.maxAccessTokenAge || timeUntilExpiry < 0) {
        await this.rotateAccessToken();
      }

      // Check if refresh token needs rotation (less frequent)
      // Only check if lastRotationTime has been set (not initial state)
      // and enough time has passed since last rotation
      if (force || (this.lastRotationTime > 0 && timeSinceLastRotation >= this.config.maxRefreshTokenAge)) {
        await this.rotateRefreshToken();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.rotationEmitter.fire({
        type: 'rotation_failed',
        timestamp: Date.now(),
        tokenType: 'access',
        error: err,
      });
      console.error('[TokenRotation] Rotation check failed:', err);
    }
  }

  /**
   * Rotate access token by refreshing it
   */
  private async rotateAccessToken(): Promise<void> {
    try {
      // Ensure access token is valid (this will refresh if needed)
      await this.authManager.ensureAccessToken();

      this.lastRotationTime = Date.now();
      this.rotationEmitter.fire({
        type: 'rotated',
        timestamp: Date.now(),
        tokenType: 'access',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Token rotation failed');
      this.rotationEmitter.fire({
        type: 'rotation_failed',
        timestamp: Date.now(),
        tokenType: 'access',
        error: err,
      });
      throw err;
    }
  }

  /**
   * Rotate refresh token (requires re-authentication)
   */
  private async rotateRefreshToken(): Promise<void> {
    // Refresh token rotation typically requires re-authentication
    // For now, we'll just log that it's needed
    this.rotationEmitter.fire({
      type: 'rotation_required',
      timestamp: Date.now(),
      tokenType: 'refresh',
    });

    // Update last rotation time to prevent repeated warnings
    this.lastRotationTime = Date.now();

    // In a production system, you might trigger a re-authentication flow here
    // Only log as debug/info level, not warning, since this is expected behavior
    // and doesn't indicate an error
    console.debug('[TokenRotation] Refresh token rotation recommended - user may need to re-authenticate in the future');
  }

  /**
   * Update rotation configuration
   */
  updateConfig(config: Partial<TokenRotationConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart if enabled
    if (this.config.enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  /**
   * Get current rotation configuration
   */
  getConfig(): Readonly<TokenRotationConfig> {
    return { ...this.config };
  }

  /**
   * Dispose of the rotation manager
   */
  dispose(): void {
    this.stop();
    this.rotationEmitter.dispose();
  }
}

