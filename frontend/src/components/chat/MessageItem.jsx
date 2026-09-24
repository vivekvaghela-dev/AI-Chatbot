import { useState } from 'react';
import { formatTime } from '../../services/api';

/**
 * Helper to render message content with support for fenced code blocks and inline code.
 */
function renderFormattedContent(content) {
  if (!content) return null;

  // Split content by code blocks: ```[lang]\n...```
  const parts = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text preceding the code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      parts.push({ type: 'text', value: textBefore });
    }

    // Add code block
    parts.push({
      type: 'code',
      language: match[1] || 'text',
      value: match[2].trimEnd(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return parts.map((part, pIdx) => {
    if (part.type === 'code') {
      return (
        <div key={pIdx} className="code-block-wrapper">
          {part.language && part.language !== 'text' && (
            <div className="code-block-header">
              <span>{part.language}</span>
            </div>
          )}
          <pre className="code-block">
            <code>{part.value}</code>
          </pre>
        </div>
      );
    }

    // Render text with inline code: `code`
    return part.value.split('\n').map((line, lIdx) => {
      const inlineParts = [];
      const inlineRegex = /`([^`]+)`/g;
      let inlineLastIdx = 0;
      let inlineMatch;

      while ((inlineMatch = inlineRegex.exec(line)) !== null) {
        if (inlineMatch.index > inlineLastIdx) {
          inlineParts.push(line.slice(inlineLastIdx, inlineMatch.index));
        }
        inlineParts.push(
          <code key={inlineMatch.index} className="inline-code">
            {inlineMatch[1]}
          </code>
        );
        inlineLastIdx = inlineMatch.index + inlineMatch[0].length;
      }

      if (inlineLastIdx < line.length) {
        inlineParts.push(line.slice(inlineLastIdx));
      }

      return (
        <p key={`${pIdx}-${lIdx}`}>
          {inlineParts.length > 0 ? inlineParts : line || '\u00A0'}
        </p>
      );
    });
  });
}

export default function MessageItem({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const timeDisplay = message.created_at
    ? formatTime(message.created_at)
    : message.timestamp || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className={`chat-message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
      <div className={`message-avatar ${isUser ? 'user-avatar' : 'assistant-avatar'}`}>
        {isUser ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4" />
            <line x1="8" y1="16" x2="8" y2="16" />
            <line x1="16" y1="16" x2="16" y2="16" />
          </svg>
        )}
      </div>

      <div className="message-content-wrapper">
        <div className="message-header-line">
          <span className="message-sender">{isUser ? 'You' : 'Assistant'}</span>
          {timeDisplay && <span className="message-time">{timeDisplay}</span>}

          {!isUser && !message.isStreaming && message.content && (
            <button
              type="button"
              className="btn-copy-message"
              onClick={handleCopy}
              title="Copy message to clipboard"
              aria-label="Copy message"
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
          <div className="message-text">
            {renderFormattedContent(message.content)}
            {message.isStreaming && <span className="streaming-cursor">▍</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
