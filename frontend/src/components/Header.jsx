export default function Header() {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h1>AI Chatbot</h1>
        </div>
      </div>
      <div className="header-badges">
        <span className="badge phase">Phase F0: Scaffold</span>
        <span className="badge backend">Django API Ready</span>
      </div>
    </header>
  );
}
