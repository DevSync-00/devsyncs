# Chat Interface Enhancements

This directory contains enhanced chat interface components that provide improved user experience features.

## Features

### 1. Rich Markdown Rendering with Syntax Highlighting
- **Prism.js integration** - Syntax highlighting for code blocks
- **Multiple language support** - Supports all Prism.js languages
- **Enhanced rendering** - Better markdown parsing and display

### 2. Interactive Code Blocks
- **Run code directly** - Execute SQL and other supported languages
- **Apply to file** - Insert code into active editor
- **Diff view** - Preview changes before applying
- **Copy code** - Quick copy to clipboard
- **Format code** - Auto-format code using VS Code formatters
- **Open in editor** - Open code in new editor window

### 3. Conversation Branching
- **Create branches** - Branch conversations from any message
- **Switch branches** - Navigate between conversation branches
- **Branch history** - Track all conversation branches
- **Branch titles** - Auto-generated or custom branch titles

### 4. Export Conversations
- **Multiple formats** - Export as JSON, Markdown, or plain text
- **Full conversation** - Includes all messages and metadata
- **Branch support** - Export specific branches or entire conversation
- **File save dialog** - Choose save location

### 5. Search in Conversation History
- **Full-text search** - Search across all messages
- **Real-time results** - Instant search results
- **Match highlighting** - Highlights matching text
- **Search cache** - Cached results for performance

### 6. Suggested Prompts/Quick Actions
- **Context-aware prompts** - Prompts based on current state
- **Quick actions** - One-click actions for common tasks
- **Prompt suggestions** - AI-suggested prompts

### 7. Better Error Messages with Retry Options
- **User-friendly messages** - Clear, actionable error messages
- **Retry functionality** - One-click retry for failed operations
- **Recovery suggestions** - Context-aware recovery actions
- **Error categorization** - Different handling for different error types

## Components

### EnhancedChatManager
Manages conversation history, branching, export, and search.

**Key Methods:**
- `createConversation(title?)` - Create new conversation
- `switchConversation(id)` - Switch to different conversation
- `createBranch(messageId, title?)` - Create branch from message
- `switchBranch(branchId)` - Switch to branch
- `exportConversation(id, format)` - Export conversation
- `searchConversations(query)` - Search conversation history
- `getSuggestedPrompts()` - Get suggested prompts

### CodeBlockActions
Handles interactive code block actions.

**Key Methods:**
- `runCode(code, language)` - Run code directly
- `applyToFile(code, language)` - Apply code to file
- `showDiff(document, code)` - Show diff view
- `copyCode(code)` - Copy to clipboard
- `openInEditor(code, language)` - Open in editor
- `formatCode(code, language)` - Format code

### ErrorRecovery
Provides enhanced error handling with retry options.

**Key Methods:**
- `showErrorWithRetry(options)` - Show error with retry
- `getUserFriendlyMessage(error)` - Get user-friendly error message
- `getRecoverySuggestions(error)` - Get recovery suggestions

## Usage

### Basic Usage

```typescript
import { EnhancedChatManager } from './chat';

const manager = new EnhancedChatManager(context, chatPanelManager);

// Create conversation
const conversationId = manager.createConversation('My Conversation');

// Search conversations
const results = manager.searchConversations('schema mismatch');

// Export conversation
const exported = manager.exportConversation(conversationId, 'markdown');
```

### Code Block Actions

```typescript
import { CodeBlockActions } from './chat';
import { EditorService } from '../ui/editor';

const actions = new CodeBlockActions(new EditorService());

// Apply code to file
await actions.applyToFile('SELECT * FROM users;', 'sql');

// Show diff
await actions.showDiff(document, newCode);
```

### Error Recovery

```typescript
import { ErrorRecovery } from './chat';

await ErrorRecovery.showErrorWithRetry({
  message: 'Failed to connect',
  error: error,
  messageId: messageId,
  retryAction: async () => {
    await retryConnection();
  },
  alternativeActions: [
    {
      label: 'Check Settings',
      action: async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings');
      },
    },
  ],
});
```

## Message Types

### New Webview Messages

- `runCode` - Run code block
- `applyCode` - Apply code to file
- `showDiff` - Show diff view
- `exportConversation` - Export conversation
- `searchConversations` - Search history
- `createBranch` - Create conversation branch
- `switchConversation` - Switch conversation
- `switchBranch` - Switch branch
- `deleteConversation` - Delete conversation

### New Extension Messages

- `conversations` - Conversations list update
- `searchResults` - Search results
- `suggestedPrompts` - Suggested prompts list

## State Management

Conversation state is persisted in VS Code's workspace state:
- Key: `devsync.chat.conversations`
- Format: Object with conversations map and current IDs
- Scope: Workspace

## Export Formats

### JSON
```json
{
  "conversation": {
    "id": "...",
    "title": "...",
    "createdAt": 1234567890,
    "updatedAt": 1234567890,
    "messageCount": 10,
    "branches": []
  },
  "messages": [...]
}
```

### Markdown
```markdown
# Conversation Title

**Created:** 2024-01-01 12:00:00
**Updated:** 2024-01-01 12:30:00
**Messages:** 10

---

## User (2024-01-01 12:00:00)

Message content...

---
```

### Text
Plain text format with timestamps and role indicators.

## Search Functionality

Search matches against:
- Message content
- Message metadata
- Conversation titles
- Branch titles

Search is case-insensitive and supports partial matches.

## Error Recovery

Error recovery provides:
- User-friendly error messages
- Retry functionality
- Context-aware recovery suggestions
- Error categorization

Common error types:
- Network errors → Check connection
- Authentication errors → Sign in
- Configuration errors → Open settings
- Rate limit errors → Wait and retry

## Integration

The enhanced chat features are integrated with `ChatPanelManager`:
- Automatic conversation creation
- Message tracking
- Error recovery integration
- Code block action handling

All features are backward compatible and work with existing chat functionality.

## Future Enhancements

Potential future improvements:
- Voice input support (requires browser APIs)
- Advanced diff visualization
- Code execution sandbox
- Multi-file code blocks
- Conversation templates
- AI-powered conversation summaries

