import ConversationMenu from './ConversationMenu';
import { formatRelativeDate } from '../../services/api';

export default function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onClear,
}) {
  const timeDisplay = conversation.updated_at
    ? formatRelativeDate(conversation.updated_at)
    : conversation.updatedAt || '';

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(conversation.id)}
      role="button"
      tabIndex={0}
      aria-label={`Conversation: ${conversation.title || 'New Chat'}`}
      aria-current={isActive ? 'true' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(conversation.id);
        }
      }}
    >
      <div className="conversation-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      <div className="conversation-info">
        <span
          className="conversation-title"
          title={conversation.title || 'New Chat'}
        >
          {conversation.title || 'New Chat'}
        </span>
        {timeDisplay && (
          <span className="conversation-timestamp">{timeDisplay}</span>
        )}
      </div>

      <ConversationMenu
        conversationId={conversation.id}
        onDelete={onDelete}
        onClear={onClear}
      />
    </div>
  );
}
