import type {
  AuthSessionState,
  ChatMessage,
  ChatMessageStatus,
  ChatViewConfig,
  ChatCliCommand,
} from './types';
import type { AuthFlowUpdate } from './auth';

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'userMessage'; messageId: string; content: string }
  | { type: 'stop'; messageId?: string }
  | { type: 'retry'; messageId: string }
  | { type: 'runCommand'; command: ChatCliCommand; requestId: string }
  | { type: 'openFile'; path: string }
  | { type: 'insertCode'; code: string; language?: string }
  | { type: 'requestLogin' }
  | { type: 'requestLogout' }
  | { type: 'newConversation' }
  | { type: 'openUrl'; url: string }
  | { type: 'runCode'; code: string; language: string }
  | { type: 'applyCode'; code: string; language: string }
  | { type: 'showDiff'; code: string; language: string }
  | { type: 'exportConversation'; format: 'json' | 'markdown' | 'text' }
  | { type: 'searchConversations'; query: string }
  | { type: 'createBranch'; messageId: string }
  | { type: 'switchConversation'; conversationId: string }
  | { type: 'switchBranch'; branchId: string }
  | { type: 'deleteConversation'; conversationId: string };

export type ExtensionToWebviewMessage =
  | { type: 'init'; payload: { messages: ChatMessage[]; session: AuthSessionState; config: ChatViewConfig } }
  | { type: 'session'; payload: AuthSessionState }
  | { type: 'aiResponseStart'; payload: { message: ChatMessage } }
  | { type: 'aiResponseChunk'; payload: { messageId: string; chunk: string } }
  | { type: 'aiResponseEnd'; payload: { messageId: string; status: ChatMessageStatus; error?: string } }
  | { type: 'messageUpdate'; payload: { message: ChatMessage } }
  | { type: 'info'; payload: { message: string } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'authFlow'; payload: AuthFlowUpdate }
  | { type: 'conversations'; payload: { conversations: any[]; currentId: string | null } }
  | { type: 'searchResults'; payload: { results: any[]; query: string } }
  | { type: 'suggestedPrompts'; payload: { prompts: string[] } };


