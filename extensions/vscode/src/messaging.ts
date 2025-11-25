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
  | { type: 'openUrl'; url: string };

export type ExtensionToWebviewMessage =
  | { type: 'init'; payload: { messages: ChatMessage[]; session: AuthSessionState; config: ChatViewConfig } }
  | { type: 'session'; payload: AuthSessionState }
  | { type: 'aiResponseStart'; payload: { message: ChatMessage } }
  | { type: 'aiResponseChunk'; payload: { messageId: string; chunk: string } }
  | { type: 'aiResponseEnd'; payload: { messageId: string; status: ChatMessageStatus; error?: string } }
  | { type: 'messageUpdate'; payload: { message: ChatMessage } }
  | { type: 'info'; payload: { message: string } }
  | { type: 'error'; payload: { message: string } }
  | { type: 'authFlow'; payload: AuthFlowUpdate };


