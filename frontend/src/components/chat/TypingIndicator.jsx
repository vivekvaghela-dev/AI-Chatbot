export default function TypingIndicator() {
  return (
    <div className="chat-message-row assistant-row typing-row">
      <div className="message-avatar assistant-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v4" />
          <line x1="8" y1="16" x2="8" y2="16" />
          <line x1="16" y1="16" x2="16" y2="16" />
        </svg>
      </div>

      <div className="message-content-wrapper">
        <div className="message-header-line">
          <span className="message-sender">Assistant</span>
          <span className="message-time">Typing...</span>
        </div>

        <div className="message-bubble assistant-bubble typing-bubble">
          <div className="typing-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      </div>
    </div>
  );
}
