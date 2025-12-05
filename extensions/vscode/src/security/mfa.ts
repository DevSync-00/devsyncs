/**
 * Multi-factor authentication (MFA) support.
 * 
 * Provides infrastructure for MFA including TOTP, SMS, and email verification.
 */

import * as vscode from 'vscode';

/**
 * MFA method type
 */
export type MfaMethod = 'totp' | 'sms' | 'email' | 'backup_code';

/**
 * MFA status
 */
export interface MfaStatus {
  enabled: boolean;
  methods: MfaMethod[];
  required: boolean;
}

/**
 * MFA challenge request
 */
export interface MfaChallenge {
  method: MfaMethod;
  challengeId: string;
  expiresAt: number;
  metadata?: {
    phoneNumber?: string; // Last 4 digits for SMS
    email?: string; // Masked email
    totpSecret?: string; // For TOTP setup
  };
}

/**
 * MFA verification result
 */
export interface MfaVerificationResult {
  success: boolean;
  error?: string;
  backupCodes?: string[]; // Provided on first MFA setup
}

/**
 * MFA manager interface
 */
export interface IMfaManager {
  /**
   * Check if MFA is enabled for the current user
   */
  getMfaStatus(): Promise<MfaStatus>;

  /**
   * Start MFA setup for a method
   */
  startMfaSetup(method: MfaMethod): Promise<MfaChallenge>;

  /**
   * Complete MFA setup
   */
  completeMfaSetup(challengeId: string, code: string): Promise<MfaVerificationResult>;

  /**
   * Disable MFA for a method
   */
  disableMfa(method: MfaMethod): Promise<void>;

  /**
   * Request MFA challenge during authentication
   */
  requestChallenge(method: MfaMethod): Promise<MfaChallenge>;

  /**
   * Verify MFA code
   */
  verifyCode(challengeId: string, code: string): Promise<MfaVerificationResult>;

  /**
   * Generate backup codes
   */
  generateBackupCodes(): Promise<string[]>;
}

/**
 * MFA manager implementation
 */
export class MfaManager implements IMfaManager {
  private mfaStatus: MfaStatus | null = null;
  private mfaEmitter = new vscode.EventEmitter<MfaStatus>();
  public readonly onMfaStatusChange = this.mfaEmitter.event;

  constructor(
    private context: vscode.ExtensionContext,
    private apiClient: {
      requestMfaChallenge: (method: MfaMethod) => Promise<MfaChallenge>;
      verifyMfaCode: (challengeId: string, code: string) => Promise<MfaVerificationResult>;
      getMfaStatus: () => Promise<MfaStatus>;
      startMfaSetup: (method: MfaMethod) => Promise<MfaChallenge>;
      completeMfaSetup: (challengeId: string, code: string) => Promise<MfaVerificationResult>;
      disableMfa: (method: MfaMethod) => Promise<void>;
      generateBackupCodes: () => Promise<string[]>;
    }
  ) {}

  /**
   * Get MFA status
   */
  async getMfaStatus(): Promise<MfaStatus> {
    try {
      this.mfaStatus = await this.apiClient.getMfaStatus();
      this.mfaEmitter.fire(this.mfaStatus);
      return this.mfaStatus;
    } catch (error) {
      console.error('[MFA] Failed to get MFA status:', error);
      // Return default status on error
      return {
        enabled: false,
        methods: [],
        required: false,
      };
    }
  }

  /**
   * Start MFA setup
   */
  async startMfaSetup(method: MfaMethod): Promise<MfaChallenge> {
    const challenge = await this.apiClient.startMfaSetup(method);

    // For TOTP, show QR code setup
    if (method === 'totp' && challenge.metadata?.totpSecret) {
      await this.showTotpSetup(challenge);
    }

    return challenge;
  }

  /**
   * Complete MFA setup
   */
  async completeMfaSetup(challengeId: string, code: string): Promise<MfaVerificationResult> {
    const result = await this.apiClient.completeMfaSetup(challengeId, code);

    if (result.success) {
      // Refresh MFA status
      await this.getMfaStatus();

      // Show backup codes if provided
      if (result.backupCodes && result.backupCodes.length > 0) {
        await this.showBackupCodes(result.backupCodes);
      }

      vscode.window.showInformationMessage('MFA enabled successfully');
    } else {
      vscode.window.showErrorMessage(`MFA setup failed: ${result.error || 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Disable MFA
   */
  async disableMfa(method: MfaMethod): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      `Are you sure you want to disable ${method.toUpperCase()}?`,
      { modal: true },
      'Disable',
      'Cancel'
    );

    if (confirmed !== 'Disable') {
      return;
    }

    try {
      await this.apiClient.disableMfa(method);
      await this.getMfaStatus();
      vscode.window.showInformationMessage(`${method.toUpperCase()} disabled successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disable MFA';
      vscode.window.showErrorMessage(`Failed to disable MFA: ${message}`);
    }
  }

  /**
   * Request MFA challenge
   */
  async requestChallenge(method: MfaMethod): Promise<MfaChallenge> {
    return await this.apiClient.requestMfaChallenge(method);
  }

  /**
   * Verify MFA code
   */
  async verifyCode(challengeId: string, code: string): Promise<MfaVerificationResult> {
    return await this.apiClient.verifyMfaCode(challengeId, code);
  }

  /**
   * Generate backup codes
   */
  async generateBackupCodes(): Promise<string[]> {
    const confirmed = await vscode.window.showWarningMessage(
      'Generating new backup codes will invalidate existing ones. Continue?',
      { modal: true },
      'Generate',
      'Cancel'
    );

    if (confirmed !== 'Generate') {
      return [];
    }

    try {
      const codes = await this.apiClient.generateBackupCodes();
      await this.showBackupCodes(codes);
      return codes;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate backup codes';
      vscode.window.showErrorMessage(`Failed to generate backup codes: ${message}`);
      return [];
    }
  }

  /**
   * Show TOTP setup dialog
   */
  private async showTotpSetup(challenge: MfaChallenge): Promise<void> {
    if (!challenge.metadata?.totpSecret) {
      return;
    }

    const message = `TOTP Setup:\n\nSecret: ${challenge.metadata.totpSecret}\n\nScan the QR code with your authenticator app.`;
    await vscode.window.showInformationMessage(message, 'Copy Secret').then((action) => {
      if (action === 'Copy Secret' && challenge.metadata?.totpSecret) {
        void vscode.env.clipboard.writeText(challenge.metadata.totpSecret);
        vscode.window.showInformationMessage('Secret copied to clipboard');
      }
    });
  }

  /**
   * Show backup codes dialog
   */
  private async showBackupCodes(codes: string[]): Promise<void> {
    const codesText = codes.join('\n');
    const message = `Backup Codes (save these securely):\n\n${codesText}`;

    await vscode.window.showInformationMessage(
      'Backup codes generated. Save them securely.',
      'Copy Codes',
      'Save to File'
    ).then(async (action) => {
      if (action === 'Copy Codes') {
        await vscode.env.clipboard.writeText(codesText);
        vscode.window.showInformationMessage('Backup codes copied to clipboard');
      } else if (action === 'Save to File') {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('devsync-backup-codes.txt'),
          filters: {
            'Text Files': ['txt'],
          },
        });

        if (uri) {
          const encoder = new TextEncoder();
          await vscode.workspace.fs.writeFile(uri, encoder.encode(codesText));
          vscode.window.showInformationMessage('Backup codes saved to file');
        }
      }
    });
  }
}

