import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import logo from '@/assets/re-logo.png';

const LoginPage = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      console.error('Login error:', err);
      const serverMsg = err?.response?.data?.message;
      if (serverMsg) {
        setError(serverMsg);
      } else if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
        setError('Network Error: Unable to reach server. Please check your internet connection.');
      } else {
        setError(err?.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ justifyContent: 'center' }}>
      <div className="page-container" style={{ textAlign: 'center' }}>
        {/* Logo */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 22,
            background: '#000',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            overflow: 'hidden',
          }}
        >
          <img src={logo} alt="Lingam Spares" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <h1 className="t-page-title" style={{ fontSize: 24 }}>Lingam Spares Attendance</h1>
        <p className="t-muted" style={{ marginTop: 6, fontSize: 14 }}>
          Track your attendance securely and effortlessly.
        </p>

        <form onSubmit={handleLogin} style={{ marginTop: 32, textAlign: 'left' }}>
          <div className="field">
            <label className="field-label">Username</label>
            <input
              className="field-input"
              type="text"
              value={username}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Enter your username"
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">Password</label>
            <input
              className="field-input"
              type="password"
              value={password}
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="loc-note err" style={{ marginBottom: 16 }}>
              <ion-icon name="alert-circle-outline" style={{ fontSize: 18 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p className="t-muted" style={{ fontSize: 13 }}>
            Note: If you have forgotten your password, please contact your administrator to reset it.
          </p>
        </div>

        <p className="t-tiny" style={{ textAlign: 'center', marginTop: 16 }}>
          Version 1.0
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
