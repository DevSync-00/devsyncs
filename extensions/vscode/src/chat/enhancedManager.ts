/**
 * Enhanced chat manager with conversation history, branching, export, and search capabilities.
 */

import * as vscode from 'vscode';
import { ChatPanelManager } from '../chatPanelManager';
import { ChatMessage, ChatMessageStatus } from '../types';
import { generateId } from '../utils/id';

/**
 * Conversation branch information.
 */
export interface ConversationBranch {
  id: string;
  parentMessageId: string;
  messages: ChatMessage[];
  createdAt: number;
  title?: string;
}

/**
 * Conversation metadata.
 */
export interface ConversationMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  branches: ConversationBranch[];
}

/**
 * Search result for conversation history.
 */
export interface ConversationSearchResult {
  messageId: string;
  conversationId: string;
  branchId?: string;
  content: string;
  role: string;
  timestamp: number;
  matches: string[];
}

/**
 * Enhanced chat manager with advanced features.
 */
export class EnhancedChatManager {
  private conversations: Map<string, ConversationMetadata> = new Map();
  private currentConversationId: string | null = null;
  private currentBranchId: string | null = null;
  private searchIndex: Map<string, ConversationSearchResult[]> = new Map();

  constructor(
    private context: vscode.ExtensionContext,
    private baseManager: ChatPanelManager
  ) {
    this.loadConversations();
  }

  /**
   * Creates a new conversation.
   */
  createConversation(title?: string): string {
    const id = generateId();
    const now = Date.now();
    
    const conversation: ConversationMetadata = {
      id,
      title: title || `Conversation ${new Date(now).toLocaleString()}`,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      branches: [],
    };

    this.conversations.set(id, conversation);
    this.currentConversationId = id;
    this.currentBranchId = null;
    this.saveConversations();
    
    return id;
  }

  /**
   * Gets the current conversation ID.
   */
  getCurrentConversationId(): string | null {
    return this.currentConversationId;
  }

  /**
   * Switches to a different conversation.
   */
  switchConversation(conversationId: string): boolean {
    if (!this.conversations.has(conversationId)) {
      return false;
    }
    
    this.currentConversationId = conversationId;
    this.currentBranchId = null;
    this.loadConversationMessages(conversationId);
    return true;
  }

  /**
   * Creates a branch from a message.
   */
  createBranch(parentMessageId: string, title?: string): string | null {
    if (!this.currentConversationId) {
      return null;
    }

    const conversation = this.conversations.get(this.currentConversationId);
    if (!conversation) {
      return null;
    }

    // Find parent message and all messages up to that point
    const messages = this.baseManager['messages'] as ChatMessage[];
    const parentIndex = messages.findIndex(m => m.id === parentMessageId);
    
    if (parentIndex === -1) {
      return null;
    }

    const branchId = generateId();
    const branchMessages = messages.slice(0, parentIndex + 1);
    
    const branch: ConversationBranch = {
      id: branchId,
      parentMessageId,
      messages: [...branchMessages],
      createdAt: Date.now(),
      title: title || `Branch from ${new Date().toLocaleTimeString()}`,
    };

    conversation.branches.push(branch);
    conversation.updatedAt = Date.now();
    this.currentBranchId = branchId;
    this.saveConversations();
    
    return branchId;
  }

  /**
   * Switches to a branch.
   */
  switchBranch(branchId: string): boolean {
    if (!this.currentConversationId) {
      return false;
    }

    const conversation = this.conversations.get(this.currentConversationId);
    if (!conversation) {
      return false;
    }

    const branch = conversation.branches.find(b => b.id === branchId);
    if (!branch) {
      return false;
    }

    this.currentBranchId = branchId;
    this.loadBranchMessages(branch);
    return true;
  }

  /**
   * Gets all conversations.
   */
  getAllConversations(): ConversationMetadata[] {
    return Array.from(this.conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Gets conversation by ID.
   */
  getConversation(id: string): ConversationMetadata | undefined {
    return this.conversations.get(id);
  }

  /**
   * Deletes a conversation.
   */
  deleteConversation(id: string): boolean {
    if (this.currentConversationId === id) {
      this.currentConversationId = null;
      this.currentBranchId = null;
    }
    
    const deleted = this.conversations.delete(id);
    if (deleted) {
      this.saveConversations();
    }
    return deleted;
  }

  /**
   * Exports a conversation.
   */
  exportConversation(id: string, format: 'json' | 'markdown' | 'text' = 'markdown'): string | null {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return null;
    }

    const baseManagerAny = this.baseManager as any;
    const messages = (baseManagerAny.messages || []) as ChatMessage[];
    const conversationMessages = messages.filter(m => 
      m.metadata?.conversationId === id || 
      (id === this.currentConversationId && !m.metadata?.conversationId)
    );

    switch (format) {
      case 'json':
        return JSON.stringify({
          conversation,
          messages: conversationMessages,
        }, null, 2);
      
      case 'markdown':
        return this.exportToMarkdown(conversation, conversationMessages);
      
      case 'text':
        return this.exportToText(conversation, conversationMessages);
      
      default:
        return null;
    }
  }

  /**
   * Searches conversation history.
   */
  searchConversations(query: string): ConversationSearchResult[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
      return [];
    }

    // Check cache
    if (this.searchIndex.has(normalizedQuery)) {
      return this.searchIndex.get(normalizedQuery)!;
    }

    const results: ConversationSearchResult[] = [];
    const baseManagerAny = this.baseManager as any;
    const messages = (baseManagerAny.messages || []) as ChatMessage[];

    for (const message of messages) {
      const content = message.content.toLowerCase();
      if (content.includes(normalizedQuery)) {
        const matches: string[] = [];
        const regex = new RegExp(`(${this.escapeRegex(normalizedQuery)})`, 'gi');
        const matchArray = message.content.match(regex);
        if (matchArray) {
          matches.push(...matchArray);
        }

        results.push({
          messageId: message.id,
          conversationId: message.metadata?.conversationId || this.currentConversationId || '',
          branchId: message.metadata?.branchId,
          content: message.content,
          role: message.role,
          timestamp: message.createdAt,
          matches,
        });
      }
    }

    // Cache results
    this.searchIndex.set(normalizedQuery, results);
    
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Gets suggested prompts.
   */
  getSuggestedPrompts(): string[] {
    return [
      'What are the current schema mismatches?',
      'How can I fix the missing fields?',
      'Generate a migration for all mismatches',
      'Explain the differences between code and database schema',
      'What is the recommended approach for this mismatch?',
      'Show me examples of similar fixes',
      'What are the potential risks of this migration?',
    ];
  }

  /**
   * Updates conversation metadata when a message is added.
   */
  onMessageAdded(message: ChatMessage): void {
    if (!this.currentConversationId) {
      this.currentConversationId = this.createConversation();
    }

    const conversation = this.conversations.get(this.currentConversationId);
    if (conversation) {
      conversation.updatedAt = Date.now();
      conversation.messageCount++;
      
      // Update message metadata
      if (!message.metadata) {
        message.metadata = {};
      }
      message.metadata.conversationId = this.currentConversationId;
      if (this.currentBranchId) {
        message.metadata.branchId = this.currentBranchId;
      }

      // Auto-generate title from first user message
      if (conversation.messageCount === 1 && message.role === 'user') {
        const title = message.content.substring(0, 50).trim();
        if (title) {
          conversation.title = title.length < message.content.length ? `${title}...` : title;
        }
      }

      this.saveConversations();
    }
  }

  /**
   * Loads conversation messages.
   */
  private loadConversationMessages(conversationId: string): void {
    // This would need to be integrated with ChatPanelManager
    // For now, we'll just track the conversation ID
    const messages = this.baseManager['messages'] as ChatMessage[];
    const conversationMessages = messages.filter(m => 
      m.metadata?.conversationId === conversationId
    );
    
    // Clear current messages and load conversation messages
    // This requires access to ChatPanelManager's internal state
    // Implementation depends on ChatPanelManager's API
  }

  /**
   * Loads branch messages.
   */
  private loadBranchMessages(branch: ConversationBranch): void {
    // Load messages from branch
    // This requires integration with ChatPanelManager
  }

  /**
   * Exports conversation to markdown.
   */
  private exportToMarkdown(conversation: ConversationMetadata, messages: ChatMessage[]): string {
    let markdown = `# ${conversation.title}\n\n`;
    markdown += `**Created:** ${new Date(conversation.createdAt).toLocaleString()}\n`;
    markdown += `**Updated:** ${new Date(conversation.updatedAt).toLocaleString()}\n`;
    markdown += `**Messages:** ${conversation.messageCount}\n\n`;
    markdown += `---\n\n`;

    for (const message of messages) {
      const role = message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System';
      const timestamp = new Date(message.createdAt).toLocaleString();
      
      markdown += `## ${role} (${timestamp})\n\n`;
      markdown += `${message.content}\n\n`;
      
      if (message.error) {
        markdown += `*Error: ${message.error}*\n\n`;
      }
      
      markdown += `---\n\n`;
    }

    return markdown;
  }

  /**
   * Exports conversation to plain text.
   */
  private exportToText(conversation: ConversationMetadata, messages: ChatMessage[]): string {
    let text = `${conversation.title}\n`;
    text += `${'='.repeat(conversation.title.length)}\n\n`;
    text += `Created: ${new Date(conversation.createdAt).toLocaleString()}\n`;
    text += `Updated: ${new Date(conversation.updatedAt).toLocaleString()}\n`;
    text += `Messages: ${conversation.messageCount}\n\n`;
    text += `${'-'.repeat(50)}\n\n`;

    for (const message of messages) {
      const role = message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System';
      const timestamp = new Date(message.createdAt).toLocaleString();
      
      text += `${role} (${timestamp}):\n`;
      text += `${message.content}\n\n`;
      
      if (message.error) {
        text += `[Error: ${message.error}]\n\n`;
      }
      
      text += `${'-'.repeat(50)}\n\n`;
    }

    return text;
  }

  /**
   * Escapes regex special characters.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Loads conversations from storage.
   */
  private loadConversations(): void {
    const stored = this.context.workspaceState.get<{
      conversations: [string, ConversationMetadata][];
      currentConversationId: string | null;
      currentBranchId: string | null;
    }>('devsync.chat.conversations');
    
    if (stored) {
      this.conversations = new Map(stored.conversations);
      this.currentConversationId = stored.currentConversationId;
      this.currentBranchId = stored.currentBranchId;
    }
  }

  /**
   * Saves conversations to storage.
   */
  private saveConversations(): void {
    this.context.workspaceState.update('devsync.chat.conversations', {
      conversations: Array.from(this.conversations.entries()),
      currentConversationId: this.currentConversationId,
      currentBranchId: this.currentBranchId,
    });
  }
}

