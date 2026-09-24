import { useState, useEffect } from 'react';
import { checkBackendConnection } from '../services/api';

export default function ConnectionStatus() {
  const [status, setStatus] = useState({
    loading: true,
    connected: false,
    latencyMs: null,
    conversationsCount: null,
    error: null,
  });

  const runCheck = async () => {
    setStatus((prev) => ({ ...prev, loading: true, error: null }));
    const result = await checkBackendConnection();
    setStatus({
      loading: false,
      connected: result.connected,
      latencyMs: result.latencyMs,
      conversationsCount: result.conversationsCount,
      error: result.error,
    });
  };

  useEffect(() => {
    runCheck();
  }, []);

  const apiEndpoint = import.meta.env.VITE_API_BASE_URL || '/api';

  return (
    <section className="glass-card">
      <div className="status-header">
        <div className="status-title">
          <span
            className={`status-dot ${
              status.loading
                ? 'checking'
                : status.connected
                ? 'connected'
                : 'offline'
            }`}
          />
          <h2>Backend Connection Status</h2>
        </div>
        <button
          className="btn btn-primary"
          onClick={runCheck}
          disabled={status.loading}
        >
          {status.loading ? 'Checking...' : 'Refresh Connection'}
        </button>
      </div>

      <div className="status-grid">
        <div className="status-item">
          <div className="status-label">API Base URL</div>
          <div className="status-val code">{apiEndpoint}</div>
        </div>

        <div className="status-item">
          <div className="status-label">Connection State</div>
          <div
            className={`status-val ${
              status.loading
                ? ''
                : status.connected
                ? 'success'
                : 'error'
            }`}
          >
            {status.loading
              ? 'Testing...'
              : status.connected
              ? 'Connected (200 OK)'
              : 'Offline / Unreachable'}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Response Latency</div>
          <div className="status-val">
            {status.latencyMs !== null ? `${status.latencyMs} ms` : '—'}
          </div>
        </div>

        <div className="status-item">
          <div className="status-label">Existing Conversations</div>
          <div className="status-val">
            {status.conversationsCount !== null
              ? status.conversationsCount
              : '—'}
          </div>
        </div>
      </div>

      {status.error && (
        <div className="status-alert error">
          <span>⚠️</span>
          <div>
            <strong>Django backend server not detected:</strong> {status.error}
            <br />
            <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>
              To connect, start the backend server with:{' '}
              <code>cd backend && python manage.py runserver</code>
            </span>
          </div>
        </div>
      )}

      {status.connected && (
        <div className="status-alert success">
          <span>✓</span>
          <div>
            <strong>Successfully connected to Django backend!</strong> REST endpoints are operational and CORS is configured properly.
          </div>
        </div>
      )}
    </section>
  );
}
