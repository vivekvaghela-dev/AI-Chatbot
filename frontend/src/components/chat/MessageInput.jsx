import { useRef, useEffect } from 'react';

const MAX_CHAR_LIMIT = 4000;

export default function MessageInput({
  input,
  setInput,
  onSend,
  onStop,
  isGenerating,
  inputRef,
}) {
  const localTextareaRef = useRef(null);
  const textareaRef = inputRef || localTextareaRef;

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input, textareaRef]);

  // Global key listener for Escape during generation
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && isGenerating) {
        onStop();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isGenerating, onStop]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isGenerating) {
        onSend();
      }
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isGenerating) {
      onSend();
    }
  };

  const charCount = input.length;
  const showCharWarning = charCount > 3000;

  return (
    <div className="chat-composer-container">
      <form onSubmit={handleFormSubmit} className="composer-form">
        <div className="composer-input-card">
          <textarea
            id="chat-message-input"
            ref={textareaRef}
            className="composer-textarea"
            placeholder="Type a message... (Shift + Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={MAX_CHAR_LIMIT}
            disabled={isGenerating}
            aria-label="Chat input message"
          />

          <div className="composer-actions">
            {isGenerating ? (
              <button
                key="btn-stop-generating"
                type="button"
                className="btn-stop-generation"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStop();
                }}
                title="Stop generation (Esc)"
                aria-label="Stop generation"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                <span>Stop</span>
              </button>
            ) : (
              <button
                key="btn-send-message"
                type="submit"
                className={`btn-send-message ${input.trim() ? 'active' : ''}`}
                disabled={!input.trim()}
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="composer-footer-line">
          {showCharWarning && (
            <span className={`composer-char-count ${charCount >= MAX_CHAR_LIMIT ? 'limit' : ''}`}>
              {charCount} / {MAX_CHAR_LIMIT}
            </span>
          )}
          <span className="composer-footer-note">
            AI responses may contain inaccuracies • Shift+Enter for newline
          </span>
        </div>
      </form>
    </div>
  );
}
