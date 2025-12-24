export type ChatRole = 'user' | 'assistant' | 'system' | 'notification';

export type ChatMessageStatus = 'pending' | 'streaming' | 'complete' | 'error' | 'cancelled';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  status: ChatMessageStatus;
  error?: string;
  metadata?: ChatMessageMetadata;
  actions?: ChatAction[];
}

export interface ChatMessageMetadata {
  projectId?: string;
  scanReportId?: string;
  command?: ChatCliCommand;
  conversationId?: string;
  branchId?: string;
  aiModel?: string;
  aiProvider?: string;
}

export type ChatAction =
  | {
      type: 'runCommand';
      label: string;
      command: ChatCliCommand;
      options?: Record<string, any>;
    }
  | {
      type: 'openFile';
      label: string;
      path: string;
    }
  | {
      type: 'insertCode';
      label: string;
      code: string;
      language?: string;
    }
  | {
      type: 'copy';
      label: string;
      text: string;
    };

export type ChatCliCommand = 'scan' | 'migrate' | 'init';

export interface AuthSessionState {
  status: 'authenticated' | 'unauthenticated' | 'authenticating';
  userId?: string;
  clientId?: string;
  expiresAt?: number;
  error?: string;
}

export interface ChatViewConfig {
  projectId?: string;
  apiUrl: string;
}

export interface AiQueryResult {
  answer: string;
  question: string;
  scanReportId: string;
  metadata?: {
    aiModel?: string;
    aiProvider?: string;
    [key: string]: any;
  };
}

export interface ScanMismatch {
  type: string;
  model: string;
  field?: string;
  severity: 'error' | 'warning' | 'info';
  suggestedFix?: string;
  codeValue?: any;
  dbValue?: any;
}


