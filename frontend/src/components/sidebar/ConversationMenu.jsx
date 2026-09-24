import { useState, useRef, useEffect } from 'react';

export default function ConversationMenu({ conversationId, onDelete, onClear }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleClear = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onClear) {
      onClear(conversationId);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onDelete) {
      onDelete(conversationId);
    }
  };

  return (
    <div className="conversation-menu-container" ref={menuRef}>
      <button
        type="button"
        className="conversation-menu-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Conversation options"
        aria-label="Conversation options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {isOpen && (
        <div className="conversation-dropdown-menu" role="menu">
          <button
            type="button"
            className="dropdown-item"
            onClick={handleClear}
            role="menuitem"
            aria-label="Clear chat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Clear Chat</span>
          </button>

          <button
            type="button"
            className="dropdown-item danger"
            onClick={handleDelete}
            role="menuitem"
            aria-label="Delete conversation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
