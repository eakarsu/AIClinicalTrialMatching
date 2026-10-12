import React, { useState } from 'react';
import api from '../services/api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="logo-icon">{'\u{1F9EC}'}</div>
        <h1>ClinicalTrialAI</h1>
        <p className="subtitle">AI-Powered Clinical Trial Matching Platform</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <button
            type="button"
            onClick={() => { setEmail(process.env.REACT_APP_DEMO_EMAIL || ''); setPassword(process.env.REACT_APP_DEMO_PASSWORD || ''); setError(''); }}
            disabled={loading || process.env.REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL !== 'true' || !process.env.REACT_APP_DEMO_EMAIL || !process.env.REACT_APP_DEMO_PASSWORD}
            aria-label="Fill demo credentials"
            style={{ width: '100%', marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid currentColor', background: 'transparent', cursor: 'pointer' }}
          >
            Fill demo credentials
          </button>
          {(!process.env.REACT_APP_DEMO_EMAIL || !process.env.REACT_APP_DEMO_PASSWORD) && <p className="subtitle">Demo credentials are not configured for this build.</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
