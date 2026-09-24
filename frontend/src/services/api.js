/**
 * API service for communicating with the Django REST backend.
 * All AI interactions and credentials remain strictly backend-side.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

/**
 * Helper to process API responses and format standard backend errors.
 */
async function handleResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      (isJson && data?.error?.message) ||
      `Request failed with status ${response.status}: ${response.statusText}`;
    const code = (isJson && data?.error?.code) || 'request_error';
    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * List all conversations (summary: id, title, created_at, updated_at).
 */
export async function getConversations() {
  const response = await fetch(`${API_BASE}/conversations/`, {
    headers: { Accept: 'application/json' },
  });
  return handleResponse(response);
}

/**
 * Create a new blank conversation.
 */
export async function createConversation() {
  const response = await fetch(`${API_BASE}/conversations/`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return handleResponse(response);
}

/**
 * Get a specific conversation with full chronological message history.
 */
export async function getConversation(conversationId) {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/`, {
    headers: { Accept: 'application/json' },
  });
  return handleResponse(response);
}

/**
 * Delete a conversation by UUID (cascade removes messages).
 */
export async function deleteConversation(conversationId) {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  return handleResponse(response);
}

/**
 * Clear all messages from a conversation and reset title to "New Chat".
 */
export async function clearConversation(conversationId) {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/clear/`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  return handleResponse(response);
}

/**
 * Stream chat response using Server-Sent Events (SSE) via browser Fetch API & ReadableStream.
 * Handles meta, token, done, and error events with AbortController support.
 */
export async function streamChat({
  conversationId,
  message,
  onMeta,
  onToken,
  onDone,
  onError,
  signal,
}) {
  // If request was already aborted before calling streamChat, exit immediately
  if (signal?.aborted) {
    return;
  }

  const effectiveConversationId =
    conversationId && !String(conversationId).startsWith('temp-')
      ? conversationId
      : null;

  const fetchUrl = `${API_BASE}/chat/`;

  if (import.meta.env.DEV) {
    console.log(
      `[streamChat] Fetching: ${fetchUrl} (Method: POST, Signal aborted: ${signal?.aborted ?? false})`
    );
  }

  let response;
  try {
    response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
      },
      body: JSON.stringify({
        conversation_id: effectiveConversationId,
        message,
      }),
      signal,
    });
  } catch (networkErr) {
    // If request was aborted (by user Stop button or unmount), exit cleanly
    if (
      networkErr?.name === 'AbortError' ||
      signal?.aborted ||
      networkErr?.code === 20 ||
      (networkErr?.message && networkErr.message.toLowerCase().includes('abort'))
    ) {
      if (import.meta.env.DEV) {
        console.log('[streamChat] Request aborted cleanly by user/client.');
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.error('[streamChat] Network fetch error:', networkErr);
    }

    const connectionErr = new Error(
      'Unable to connect to Django backend. Ensure server is running at http://127.0.0.1:8000.'
    );
    connectionErr.code = 'connection_error';
    if (onError) {
      onError(connectionErr);
      return;
    }
    throw connectionErr;
  }

  const contentType = response.headers.get('content-type') || '';

  // If backend returned non-streaming response (e.g. 400 validation error or 503 missing API key)
  if (!response.ok || !contentType.includes('text/event-stream')) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: response.statusText } };
    }
    const errMsg = errorData?.error?.message || `Request failed with status ${response.status}`;
    const errCode = errorData?.error?.code || 'request_error';
    const error = new Error(errMsg);
    error.code = errCode;
    error.status = response.status;
    if (onError) {
      onError(error);
      return;
    }
    throw error;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const error = new Error('ReadableStream not supported by browser or empty response body.');
    error.code = 'stream_error';
    if (onError) {
      onError(error);
      return;
    }
    throw error;
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundaryIndex;
      while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawBlock = buffer.slice(0, boundaryIndex).trim();
        buffer = buffer.slice(boundaryIndex + 2);

        if (!rawBlock) continue;

        let eventName = 'message';
        const dataLines = [];

        for (const line of rawBlock.split('\n')) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }

        const rawData = dataLines.join('\n');
        let parsedData = null;
        if (rawData) {
          try {
            parsedData = JSON.parse(rawData);
          } catch {
            parsedData = rawData;
          }
        }

        switch (eventName) {
          case 'meta':
            if (onMeta) onMeta(parsedData);
            break;
          case 'token':
            if (onToken) onToken(parsedData?.delta ?? '');
            break;
          case 'done':
            if (onDone) onDone(parsedData);
            break;
          case 'error': {
            const errMsg =
              parsedData?.message ||
              parsedData?.error?.message ||
              'Error generating response';
            const err = new Error(errMsg);
            err.code = parsedData?.code || parsedData?.error?.code || 'ai_provider_error';
            if (onError) onError(err);
            break;
          }
          default:
            break;
        }
      }
    }
  } catch (err) {
    if (
      err?.name === 'AbortError' ||
      signal?.aborted ||
      err?.code === 20 ||
      (err?.message && err.message.toLowerCase().includes('abort'))
    ) {
      return;
    }
    if (onError) {
      onError(err);
      return;
    }
    throw err;
  } finally {
    if (reader) {
      try {
        reader.releaseLock();
      } catch {
        // ignore lock release error if stream was closed
      }
    }
  }
}

/**
 * Format ISO datetime string to localized short time (e.g. "10:24 AM").
 */
export function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format ISO datetime string to relative time (e.g. "Just now", "5m ago", "Yesterday").
 */
export function formatRelativeDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Quick connection health check verifying reachable Django API.
 */
export async function checkBackendConnection() {
  const start = performance.now();
  try {
    const list = await getConversations();
    const durationMs = Math.round(performance.now() - start);
    return {
      connected: true,
      latencyMs: durationMs,
      conversationsCount: Array.isArray(list) ? list.length : 0,
      error: null,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    return {
      connected: false,
      latencyMs: durationMs,
      conversationsCount: null,
      error: err.message || 'Unable to connect to Django backend.',
    };
  }
}
