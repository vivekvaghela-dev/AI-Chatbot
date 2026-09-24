import { STARTER_PROMPTS } from '../../mock/mockData';

export default function EmptyState({ onSelectPrompt }) {
  return (
    <div className="chat-empty-state">
      <div className="empty-state-hero">
        <div className="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </div>
        <h3 className="empty-state-title">How can I assist you today?</h3>
        <p className="empty-state-desc">
          Ask a question, brainstorm ideas, debug code, or pick a starter prompt below.
        </p>
      </div>

      <div className="starter-prompts-grid">
        {STARTER_PROMPTS.map((item, index) => (
          <button
            key={index}
            type="button"
            className="starter-prompt-card"
            onClick={() => onSelectPrompt(item.prompt)}
          >
            <div className="prompt-card-top">
              <span className="prompt-card-icon">{item.icon}</span>
              <span className="prompt-card-title">{item.title}</span>
            </div>
            <p className="prompt-card-text">{item.prompt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
