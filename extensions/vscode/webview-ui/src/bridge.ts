import type { HostToWebview, WebviewToHost } from '../../src/shared/protocol';

declare function acquireVsCodeApi<T = unknown>(): { postMessage(message: WebviewToHost): void; getState(): T | undefined; setState(state: T): void };

export const vscode = acquireVsCodeApi<{ view?: string }>();
export const send = (message: WebviewToHost) => vscode.postMessage(message);
export const onHostMessage = (listener: (message: HostToWebview) => void) => {
  const handler = (event: MessageEvent<HostToWebview>) => listener(event.data);
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
};
