/**
 * Default AI provider plugin.
 * 
 * Uses the existing ChatApiClient as the default AI provider.
 * This allows the plugin system to work with the existing implementation
 * while enabling future extensibility.
 */

import * as vscode from 'vscode';
import {
  IAiProviderPlugin,
  AiQueryContext,
  AiProviderConfigOption,
} from '../interfaces';
import { AiQueryResult } from '../../types';
import { IChatApiClient } from '../../interfaces';

/**
 * Default AI provider plugin using ChatApiClient.
 * 
 * This is the built-in AI provider that uses the existing
 * DevSync API for AI queries.
 */
export class DefaultAiProviderPlugin implements IAiProviderPlugin {
  readonly id = 'devsync-default-ai';
  readonly name = 'DevSync Default AI';
  readonly version = '1.0.0';
  readonly description = 'Default AI provider using DevSync API';

  /**
   * Creates a new default AI provider plugin.
   * 
   * @param chatApiClient - The chat API client to use
   */
  constructor(private readonly chatApiClient: IChatApiClient) {}

  /**
   * Activates the plugin.
   */
  async activate(_context: vscode.ExtensionContext): Promise<void> {
    // No activation needed
  }

  /**
   * Deactivates the plugin.
   */
  async deactivate(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Executes an AI query using the ChatApiClient.
   */
  async query(
    question: string,
    context: AiQueryContext,
    signal?: AbortSignal
  ): Promise<AiQueryResult> {
    if (!context.scanReportId) {
      throw new Error('Scan report ID is required for AI queries');
    }

    return this.chatApiClient.queryAI(question, context.scanReportId, signal);
  }

  /**
   * Gets the provider name.
   */
  getProviderName(): string {
    return 'DevSync AI';
  }

  /**
   * Checks if the provider is configured.
   */
  isConfigured(): boolean {
    // The default provider is always configured if ChatApiClient is available
    return true;
  }

  /**
   * Gets configuration options.
   */
  getConfigurationOptions(): AiProviderConfigOption[] {
    return [
      {
        key: 'apiUrl',
        label: 'API URL',
        description: 'The DevSync API URL',
        type: 'string',
        required: true,
      },
      {
        key: 'projectId',
        label: 'Project ID',
        description: 'The DevSync project ID',
        type: 'string',
        required: true,
      },
    ];
  }
}

