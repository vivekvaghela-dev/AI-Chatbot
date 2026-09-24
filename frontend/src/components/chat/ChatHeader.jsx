export default function ChatHeader({
  title,
  messageCount,
  onOpenMobileSidebar,
  isGenerating,
}) {
  return (
    <header className="chat-top-header">
      <div className="chat-header-left">
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={onOpenMobileSidebar}
          aria-label="Open sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="chat-title-group">
          <h2 className="active-chat-title">{title || 'New Chat'}</h2>
          <span className="chat-subtitle">
            {isGenerating ? (
              <span className="status-indicator generating">AI is replying...</span>
            ) : messageCount > 0 ? (
              `${messageCount} message${messageCount === 1 ? '' : 's'}`
            ) : (
              'Ready for your question'
            )}
          </span>
        </div>
      </div>
    </header>
  );
}

