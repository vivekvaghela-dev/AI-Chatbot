import { useEffect, useRef, useState } from 'react';
import ChatHeader from './ChatHeader';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import EmptyState from './EmptyState';
import MessageInput from './MessageInput';

export default function ChatArea({
  conversation,
  messages,
  streamingAssistantText,
  input,
  setInput,
  onSend,
  onStop,
  onClearChat,
  onOpenMobileSidebar,
  isGenerating,
  isLoadingMessages,
  errorMessage,
  onDismissError,
  onRetry,
}) {
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Monitor user scroll position: if near bottom, auto-scroll stays enabled
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    isNearBottomRef.current = distanceFromBottom < 140;
    setShowScrollBottom(distanceFromBottom > 260);
  };

  // Auto-scroll when messages, streaming text, or generation state updates
  useEffect(() => {
    if (isNearBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingAssistantText, isGenerating]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    isNearBottomRef.current = true;
    setShowScrollBottom(false);
  };

  const handleSelectPrompt = (promptText) => {
    setInput(promptText);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <main className="chat-main-area">
      <ChatHeader
        title={conversation?.title || 'New Chat'}
        messageCount={messages ? messages.length : 0}
        onOpenMobileSidebar={onOpenMobileSidebar}
        isGenerating={isGenerating}
      />

      {errorMessage && (
        <div className="chat-error-banner" role="alert">
          <div className="error-banner-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>

          <div className="error-banner-actions">
            {onRetry && (
              <button
                type="button"
                className="btn-retry-error"
                onClick={onRetry}
              >
                Retry
              </button>
            )}
            {onDismissError && (
              <button
                type="button"
                className="error-dismiss-btn"
                onClick={onDismissError}
                aria-label="Dismiss error"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="chat-scrollable-content"
      >
        {isLoadingMessages ? (
          <div className="chat-loading-state">
            <div className="loading-spinner" />
            <span>Loading conversation messages...</span>
          </div>
        ) : !messages || messages.length === 0 ? (
          <EmptyState onSelectPrompt={handleSelectPrompt} />
        ) : (
          <div className="chat-messages-container">
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))}

            {/* In-progress streaming assistant response */}
            {isGenerating && streamingAssistantText ? (
              <MessageItem
                message={{
                  id: 'streaming-assistant',
                  role: 'assistant',
                  content: streamingAssistantText,
                  timestamp: 'Generating...',
                  isStreaming: true,
                }}
              />
            ) : isGenerating ? (
              <TypingIndicator />
            ) : null}

            <div ref={messagesEndRef} className="scroll-anchor" />
          </div>
        )}

        {/* Floating scroll to bottom button */}
        {showScrollBottom && (
          <button
            type="button"
            className="btn-scroll-bottom"
            onClick={scrollToBottom}
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      <MessageInput
        input={input}
        setInput={setInput}
        onSend={onSend}
        onStop={onStop}
        isGenerating={isGenerating}
        inputRef={inputRef}
      />
    </main>
  );
}
