const vscode = acquireVsCodeApi();
const { useEffect, useMemo, useRef, useState } = React;

const renderer = new marked.Renderer();
renderer.code = (code, infostring = '') => {
  const lang = (infostring || 'plaintext').split(/\s+/)[0] || 'plaintext';
  const grammar = Prism.languages[lang] || Prism.languages.javascript || Prism.languages.markup;
  const highlighted = grammar ? Prism.highlight(code, grammar, lang) : code;
  const encoded = encodeURIComponent(code);
  return `
    <pre class="code-block" data-code-block="true" data-code="${encoded}" data-language="${lang}">
      <div class="code-actions">
        <button class="code-btn" data-action="copy">Copy</button>
        <button class="code-btn" data-action="insert">Insert</button>
      </div>
      <code class="language-${lang}">${highlighted}</code>
    </pre>
  `;
};

marked.setOptions({
  gfm: true,
  breaks: true,
});
marked.use({ renderer });

function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState({ status: 'unauthenticated' });
  const [config, setConfig] = useState({ apiUrl: '', analyzerUrl: 'http://localhost:3000', projectId: undefined });
  const [input, setInput] = useState('');
  const [banner, setBanner] = useState(null);
  const [authFlow, setAuthFlow] = useState(null);
  const [pendingMessageId, setPendingMessageId] = useState(null);
  const messageListRef = useRef(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      const message = event.data;
      switch (message.type) {
        case 'init':
          setMessages(message.payload.messages || []);
          setSession(message.payload.session);
          setConfig(message.payload.config);
          setIsBusy(false);
          break;
        case 'session':
          setSession(message.payload);
          if (message.payload.status !== 'authenticating') {
            setAuthFlow(null);
          }
          break;
        case 'messageUpdate':
          upsertMessage(message.payload.message);
          if (message.payload.message.id === pendingMessageId && message.payload.message.status !== 'streaming') {
            setIsBusy(false);
            setPendingMessageId(null);
          }
          break;
        case 'aiResponseStart':
          upsertMessage(message.payload.message);
          setIsBusy(true);
          setPendingMessageId(message.payload.message.id);
          break;
        case 'aiResponseChunk':
          appendChunk(message.payload.messageId, message.payload.chunk);
          break;
        case 'aiResponseEnd':
          updateMessageStatus(message.payload.messageId, message.payload.status, message.payload.error);
          setIsBusy(false);
          setPendingMessageId(null);
          break;
        case 'info':
          setBanner({ type: 'info', text: message.payload.message, ts: Date.now() });
          break;
        case 'error':
          setBanner({ type: 'error', text: message.payload.message, ts: Date.now() });
          setIsBusy(false);
          setPendingMessageId(null);
          break;
        case 'authFlow':
          setAuthFlow(message.payload);
          // Only show banner for errors, not status updates (to avoid duplicates)
          if (message.payload.kind === 'error') {
            setBanner({ type: 'error', text: message.payload.message, ts: Date.now() });
          } else if (message.payload.kind === 'status') {
            // Clear banner on status updates to avoid clutter
            setBanner(null);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, [pendingMessageId]);

  useEffect(() => {
    if (messageListRef.current) {
      Prism.highlightAllUnder(messageListRef.current);
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const root = messageListRef.current;
    if (!root) {
      return;
    }
    const handler = (event) => {
      const target = event.target.closest('.code-btn');
      if (!target) {
        return;
      }
      const container = target.closest('[data-code-block="true"]');
      if (!container) {
        return;
      }
      const code = decodeURIComponent(container.dataset.code || '');
      const language = container.dataset.language || 'plaintext';
      const action = target.dataset.action;
      if (action === 'copy') {
        copyToClipboard(code);
      } else if (action === 'insert') {
        vscode.postMessage({ type: 'insertCode', code, language });
      }
    };
    root.addEventListener('click', handler);
    return () => root.removeEventListener('click', handler);
  }, [messages]);

  // Convert ANSI codes to HTML spans for colored output
  // This handles chalk's ANSI color codes and converts them to HTML
  const ansiToHtml = (text) => {
    if (!text) return '';
    
    // Escape HTML first
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // Process ANSI codes - handle both reset codes and color codes
    // Match ANSI escape sequences: \u001b[ or \x1b[ followed by codes and 'm'
    const ansiRegex = /\u001b\[([0-9;]*)m/g;
    let result = '';
    let lastIndex = 0;
    let match;
    let currentStyles = [];
    
    while ((match = ansiRegex.exec(html)) !== null) {
      // Add text before the ANSI code
      if (match.index > lastIndex) {
        const textBefore = html.substring(lastIndex, match.index);
        if (textBefore) {
          if (currentStyles.length > 0) {
            result += `<span style="${currentStyles.join('; ')}">${textBefore}</span>`;
          } else {
            result += textBefore;
          }
        }
      }
      
      const codes = match[1].split(';').map(c => parseInt(c, 10));
      
      // Handle reset (0) or clear all styles
      if (codes.includes(0) || codes.length === 0) {
        currentStyles = [];
      } else {
        // Process color codes
        for (const code of codes) {
          if (code === 1) {
            currentStyles.push('font-weight: bold');
          } else if (code === 31) {
            currentStyles.push('color: #ef4444'); // red
          } else if (code === 32) {
            currentStyles.push('color: #22c55e'); // green
          } else if (code === 33) {
            currentStyles.push('color: #eab308'); // yellow
          } else if (code === 34) {
            currentStyles.push('color: #3b82f6'); // blue
          } else if (code === 35) {
            currentStyles.push('color: #a855f7'); // magenta
          } else if (code === 36) {
            currentStyles.push('color: #06b6d4'); // cyan
          } else if (code === 90) {
            currentStyles.push('color: #6b7280'); // gray
          }
        }
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < html.length) {
      const remaining = html.substring(lastIndex);
      if (remaining) {
        if (currentStyles.length > 0) {
          result += `<span style="${currentStyles.join('; ')}">${remaining}</span>`;
        } else {
          result += remaining;
        }
      }
    }
    
    // If no ANSI codes were found, return escaped text
    if (result === '') {
      return html;
    }
    
    // Convert newlines to <br> for proper display
    return result.replace(/\n/g, '<br>');
  };

  const renderMarkdown = useMemo(
    () => (text) => ({
      __html: DOMPurify.sanitize(marked.parse(text || '')),
    }),
    []
  );

  const sendMessage = () => {
    if (!input.trim() || isBusy) {
      return;
    }
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    vscode.postMessage({ type: 'userMessage', messageId: id, content: input });
    setInput('');
    setIsBusy(true);
    setPendingMessageId(id);
  };

  const stopMessage = () => {
    vscode.postMessage({ type: 'stop' });
  };

  const runCommand = (command) => {
    if (isBusy) {
      return;
    }
    const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-cmd`;
    setIsBusy(true);
    setPendingMessageId(requestId);
    vscode.postMessage({ type: 'runCommand', requestId, command });
  };

  const retryAssistant = (messageId) => {
    vscode.postMessage({ type: 'retry', messageId });
  };

  const login = () => vscode.postMessage({ type: 'requestLogin' });
  const logout = () => vscode.postMessage({ type: 'requestLogout' });
  const newChat = () => vscode.postMessage({ type: 'newConversation' });

  const authCard = authFlow?.kind === 'deviceCode' && authFlow.payload;

  const resolveVerificationUrl = () => {
    const fromApi = authCard?.verification_uri;
    if (fromApi && !String(fromApi).includes('undefined')) {
      try {
        const parsed = new URL(fromApi);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.toString();
        }
      } catch {
        // fall through to constructed URL
      }
    }
    const base = (config.analyzerUrl || config.apiUrl || 'http://localhost:3000').replace(/\/$/, '');
    if (!base || base.includes('undefined')) {
      return `http://localhost:3000/device?code=${encodeURIComponent(authCard?.user_code || '')}`;
    }
    return `${base}/device?code=${encodeURIComponent(authCard?.user_code || '')}`;
  };

  return (
    React.createElement('div', { className: 'chat-app' },
      React.createElement('div', { className: 'chat-header' },
        React.createElement('div', { className: 'title' }, 'DevSync Copilot'),
        React.createElement('div', { className: 'subtitle' }, config.projectId ? `Project ${config.projectId}` : 'Configure devsync.projectId to unlock full context.')
      ),
      banner && React.createElement('div', { className: `status-banner ${banner.type}` }, banner.text),
      authCard && (
        React.createElement('div', { className: 'auth-flow-card' },
          React.createElement('div', { style: { fontWeight: 500, marginBottom: 4 } }, 'Device Authorization'),
          React.createElement('div', { style: { fontSize: '0.8rem', color: 'var(--vscode-descriptionForeground)' } }, 'Enter this code on the verification page:'),
          React.createElement('code', { style: { fontSize: '1.2rem', letterSpacing: '0.2rem', fontWeight: 600, padding: '8px 12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', display: 'block', textAlign: 'center' } }, authCard.user_code),
          React.createElement('div', { className: 'quick-actions' },
            React.createElement('button', { onClick: () => vscode.postMessage({ type: 'openUrl', url: resolveVerificationUrl() }) }, 'Open Verification'),
            React.createElement('button', { onClick: () => copyToClipboard(authCard.user_code) }, 'Copy Code')
          ),
          session.status === 'authenticating' && React.createElement('div', { style: { fontSize: '0.8rem', color: '#38bdf8', marginTop: 8 } }, 'Waiting for approval...')
        )
      ),
      React.createElement('div', { className: 'message-list', ref: messageListRef },
        messages.length === 0 && React.createElement('div', { className: 'empty-state' }, 'Welcome to DevSync Copilot. Ask anything about your schema or run commands from below.'),
        messages.map((message) =>
          React.createElement('div', { key: message.id, className: `message ${message.role}` },
            React.createElement('div', { className: 'meta' },
              React.createElement('span', { className: 'badge' }, message.role === 'user' ? 'You' : message.role === 'assistant' ? 'DevSync' : 'System'),
              message.metadata?.command && ` · devsync ${message.metadata.command}`
            ),
            React.createElement('div', { 
              className: 'content cli-output', 
              dangerouslySetInnerHTML: message.role === 'system' && message.metadata?.command
                ? { __html: DOMPurify.sanitize(ansiToHtml(message.content || '')) } // Use ANSI-to-HTML for CLI output
                : renderMarkdown(message.content || '') // Use markdown for other messages
            }),
            React.createElement('div', { className: `status ${message.status}` },
              message.status === 'error' ? message.error : message.status === 'streaming' ? 'Streaming…' : ''
            ),
            message.role === 'assistant' && React.createElement('div', { className: 'message-actions' },
              React.createElement('button', { onClick: () => retryAssistant(message.id) }, 'Retry')
            )
          )
        )
      ),
      session.status === 'unauthenticated' && !authFlow && (
        React.createElement('div', { className: 'login-overlay' },
          React.createElement('p', null, 'Sign in to DevSync to chat with your schema assistant.'),
          React.createElement('button', { className: 'chat-btn primary', onClick: login }, 'Sign in')
        )
      ),
      React.createElement('div', { className: 'composer' },
        React.createElement('div', { className: 'quick-actions' },
          React.createElement('button', { onClick: () => runCommand('scan') }, 'Run Scan'),
          React.createElement('button', { onClick: () => runCommand('migrate') }, 'Generate Migration'),
          React.createElement('button', { onClick: () => runCommand('init') }, 'Init Project'),
          React.createElement('button', { onClick: newChat }, 'New Chat'),
          React.createElement('button', { onClick: session.status === 'authenticated' ? logout : login }, session.status === 'authenticated' ? 'Sign Out' : 'Sign In')
        ),
        React.createElement('textarea', {
          value: input,
          onChange: (event) => setInput(event.target.value),
          placeholder: 'Ask DevSync anything about your schema…',
          disabled: session.status !== 'authenticated',
          onKeyDown: (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          },
        }),
        React.createElement('div', { className: 'composer-actions' },
          React.createElement('button', { className: 'chat-btn primary', onClick: sendMessage, disabled: !input.trim() || isBusy || session.status !== 'authenticated' }, 'Send'),
          React.createElement('button', { className: 'chat-btn secondary', onClick: stopMessage, disabled: !isBusy }, 'Stop')
        )
      )
    )
  );

  function upsertMessage(message) {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === message.id);
      if (index === -1) {
        return [...prev, message];
      }
      const clone = [...prev];
      clone[index] = message;
      return clone;
    });
  }

  function appendChunk(messageId, chunk) {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, content: (message.content || '') + chunk }
          : message
      )
    );
  }

  function updateMessageStatus(messageId, status, error) {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? {
              ...message,
              status,
              error: status === 'error' ? error : undefined,
            }
          : message
      )
    );
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ChatApp));


