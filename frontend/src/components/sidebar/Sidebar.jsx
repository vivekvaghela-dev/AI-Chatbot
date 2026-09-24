import ConversationList from './ConversationList';
import ThemeToggle from '../common/ThemeToggle';
import LanguageSelector from '../common/LanguageSelector';

export default function Sidebar({
  conversations,
  activeId,
  isLoadingConversations,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onClearConversation,
  isOpenMobile,
  onCloseMobile,
  theme,
  onToggleTheme,
  language,
  onSelectLanguage,
}) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${isOpenMobile ? 'mobile-open' : ''}`}>
        {/* Sidebar Header with Branding */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-name">AI Chatbot</span>
            </div>
          </div>

          <button
            type="button"
            className="mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="sidebar-action-wrap">
          <button
            type="button"
            className="btn-new-chat"
            onClick={() => {
              onNewChat();
              if (isOpenMobile) onCloseMobile();
            }}
            title="Start new chat"
            aria-label="Start new chat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversation History List */}
        <div className="sidebar-scrollable-area">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            isLoading={isLoadingConversations}
            onSelect={(id) => {
              onSelectConversation(id);
              if (isOpenMobile) onCloseMobile();
            }}
            onDelete={onDeleteConversation}
            onClear={onClearConversation}
          />
        </div>

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <LanguageSelector language={language} onSelectLanguage={onSelectLanguage} />
        </div>
      </aside>
    </>
  );
}
