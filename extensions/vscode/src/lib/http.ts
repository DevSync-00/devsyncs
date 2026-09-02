export class HttpRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

export type JsonRequestInit = Omit<RequestInit, 'body'> & {
  body?: BodyInit | null;
  json?: unknown;
};

export async function requestJson<T>(
  url: string,
  init: JsonRequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  let body = init.body ?? null;

  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      body,
      headers,
    });
  } catch (error) {
    throw new HttpRequestError(
      getNetworkMessage(error),
      0,
      undefined,
      error
    );
  }

  const data = await readBody(response);

  if (!response.ok) {
    const message = getMessage(data, response.statusText, response.status);
    throw new HttpRequestError(message, response.status, data);
  }

  return data as T;
}

function getNetworkMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Network request failed';
}

function getMessage(data: unknown, fallback?: string, status?: number): string {
  if (!data) {
    return fallback || 'Request failed';
  }

  if (typeof data === 'string') {
    const looksLikeHtml = /<!doctype html|<html[\s>]/i.test(data);
    if (looksLikeHtml) {
      return status === 404
        ? 'This Dev-Sync server does not support the extension dashboard API yet. Deploy the current dashboard backend, then retry.'
        : `Dev-Sync returned an unexpected web page${status ? ` (HTTP ${status})` : ''}. Check devsync.apiUrl and retry.`;
    }
    return data.length > 500 ? `${data.slice(0, 500)}…` : data;
  }

  if (typeof data === 'object') {
    const payload = data as Record<string, unknown>;
    const message =
      payload.error || payload.message || payload.details || fallback;
    return (message as string) || 'Request failed';
  }

  return fallback || 'Request failed';
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

