import * as vscode from 'vscode';
import { DIContainer } from './container';
import { ConfigurationManager } from '../config';

/**
 * Factory for creating and configuring the DI container
 */
export class ContainerFactory {
  /**
   * Create a configured DI container from VS Code configuration
   */
  static create(context: vscode.ExtensionContext): DIContainer {
    // Create configuration manager
    const configManager = new ConfigurationManager(context);
    
    // Configuration changes are automatically handled by the manager

    // Create container with configuration manager
    const container = new DIContainer(context, configManager);
    
    // Setup configuration change handler to update services
    configManager.onDidChangeConfig((event) => {
      if (event.key === 'analyzerUrl' && container.has('authManager')) {
        const authManager = container.get<import('../interfaces').IAuthManager>('authManager');
        if (typeof event.newValue === 'string') {
          authManager.setAnalyzerUrl(event.newValue);
        }
      }
      
      if (event.key === 'apiUrl' && container.has('chatApiClient')) {
        const chatApiClient = container.get<import('../interfaces').IChatApiClient>('chatApiClient');
        if (typeof event.newValue === 'string') {
          chatApiClient.setApiUrl(event.newValue);
        }
      }
    });

    return container;
  }

  /**
   * Update container configuration from VS Code settings
   * Note: This is now handled automatically by ConfigurationManager
   * @deprecated Configuration updates are handled automatically by ConfigurationManager
   */
  static updateConfig(_container: DIContainer): void {
    // Configuration updates are now handled automatically by ConfigurationManager
    // This method is kept for backward compatibility but does nothing
  }
}

