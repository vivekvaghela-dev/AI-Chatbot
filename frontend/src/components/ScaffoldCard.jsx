export default function ScaffoldCard() {
  return (
    <section className="glass-card scaffold-card">
      <h2>Frontend Architecture & Foundation (Phase F0)</h2>
      <p>
        The React + Vite frontend has been initialized as an independent, lightweight client
        ready to interface with the completed Django REST Framework backend.
      </p>

      <div className="specs-grid">
        <div className="spec-box">
          <h3>
            <span>⚡</span> Tech Stack & Tooling
          </h3>
          <ul className="spec-list">
            <li className="spec-item">
              <span className="dot" /> <strong>Framework:</strong> React 18 (JavaScript)
            </li>
            <li className="spec-item">
              <span className="dot" /> <strong>Bundler:</strong> Vite 6 with React Fast Refresh
            </li>
            <li className="spec-item">
              <span className="dot" /> <strong>State Management:</strong> Clean component hooks (no Redux)
            </li>
            <li className="spec-item">
              <span className="dot" /> <strong>Styles:</strong> Vanilla CSS with custom modern design system
            </li>
          </ul>
        </div>

        <div className="spec-box">
          <h3>
            <span>🔗</span> Backend Integration
          </h3>
          <ul className="spec-list">
            <li className="spec-item">
              <span className="dot" /> <code>GET /api/conversations/</code> wired in client
            </li>
            <li className="spec-item">
              <span className="dot" /> <code>POST /api/conversations/</code> wired in client
            </li>
            <li className="spec-item">
              <span className="dot" /> <code>GET/DELETE /api/conversations/:id/</code> wired
            </li>
            <li className="spec-item">
              <span className="dot" /> <code>POST /api/chat/</code> SSE streaming ready for F1
            </li>
          </ul>
        </div>

        <div className="spec-box">
          <h3>
            <span>🔒</span> Security & Architecture
          </h3>
          <ul className="spec-list">
            <li className="spec-item">
              <span className="dot" /> <strong>Backend AI only:</strong> Zero AI SDKs or keys in frontend
            </li>
            <li className="spec-item">
              <span className="dot" /> <strong>CORS origin:</strong> Port 5173 allowlisted in Django
            </li>
            <li className="spec-item">
              <span className="dot" /> <strong>Error handling:</strong> Uniform JSON error mapping
            </li>
            <li className="spec-item">
              <span className="dot" /> <strong>No Auth:</strong> Internship open API format
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-note">
        Phase F0 Foundation Complete • Ready for Phase F1 (Chat Interface & Streaming Integration)
      </div>
    </section>
  );
}
