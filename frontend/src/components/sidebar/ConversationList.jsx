import ConversationItem from './ConversationItem';

export default function ConversationList({
  conversations,
  activeId,
  isLoading,
  onSelect,
  onDelete,
  onClear,
}) {
  if (isLoading) {
    return (
      <div className="conversation-list-loading">
        <div className="skeleton-item" />
        <div className="skeleton-item" />
        <div className="skeleton-item" />
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="conversation-list-empty">
        <p>No recent chats</p>
        <span>Click "New Chat" to begin</span>
      </div>
    );
  }

  return (
    <div className="conversation-list" role="list">
      <div className="conversation-list-header">Recent Chats</div>
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === activeId}
          onSelect={onSelect}
          onDelete={onDelete}
          onClear={onClear}
        />
      ))}
    </div>
  );
}
