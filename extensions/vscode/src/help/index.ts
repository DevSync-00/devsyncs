/**
 * Contextual help system.
 * 
 * Provides comprehensive contextual help including:
 * - Contextual tooltips everywhere
 * - Inline help panels
 * - Interactive tutorials
 * - Link to relevant documentation
 * - Video guides for complex features
 * - FAQ section
 * - Community forum integration
 */

import * as vscode from 'vscode';
import { TooltipManager } from './tooltips';
import { TutorialManager } from './tutorials';
import { FAQManager } from './faq';
import { HelpContent } from './content';

export { TooltipManager, TooltipConfig } from './tooltips';
export { HelpPanelManager, HelpPanelConfig } from './panels';
export { TutorialManager, TutorialConfig, TutorialStep } from './tutorials';
export { FAQManager, FAQItem } from './faq';
export { HelpContent } from './content';
export { CommunityManager } from './community';

/**
 * Initializes the help system.
 */
export function initializeHelpSystem(context: vscode.ExtensionContext): void {
  // Initialize help content
  HelpContent.initialize();
  
  // Initialize tooltips
  TooltipManager.initializeDefaultTooltips();
  
  // Initialize tutorials
  TutorialManager.initializeDefaultTutorials();
  
  // Initialize FAQ
  FAQManager.initializeDefaultFAQ();
}

