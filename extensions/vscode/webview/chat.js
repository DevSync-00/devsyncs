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
  const [config, setConfig] = useState({ apiUrl: '', projectId: undefined });
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
            React.createElement('button', { onClick: () => vscode.postMessage({ type: 'openUrl', url: authCard.verification_uri }) }, 'Open Verification'),
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
            React.createElement('div', { className: 'content', dangerouslySetInnerHTML: renderMarkdown(message.content || '') }),
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


