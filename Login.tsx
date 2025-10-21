
import React, { useState } from 'react';

const EBURON_ICON_URL = "https://eburon-vibe.vercel.app/eburon-icon.png";

interface LoginProps {
  onLogin: (username: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    setIsLoading(true);

    // Simulate network request for authentication
    setTimeout(() => {
      setIsLoading(false);
      // In a real app, you'd validate credentials here.
      // For this mock, any non-empty input is valid.
      onLogin(username);
    }, 500);
  };

  return (
    <div className="flex items-center justify-center min-h-dvh glow">
      <div className="w-full max-w-sm p-8 space-y-6 card shadow-soft">
        <div className="flex flex-col items-center space-y-2">
          <img src={EBURON_ICON_URL} alt="Eburon" className="w-12 h-12 rounded-lg" />
          <h1 className="text-xl font-semibold tracking-wide text-center">Eburon CSR Studio</h1>
          <p className="text-sm text-[var(--muted)]">Agent Portal Login</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="text-sm font-medium text-[var(--muted)]">
              Agent Email
            </label>
            <input
              id="username"
              name="username"
              type="email"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-black/20 border border-[var(--border)] rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--accentA)]"
              placeholder="agent@eburon.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-[var(--muted)]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-black/20 border border-[var(--border)] rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--accentA)]"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-[var(--bad)] text-center">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--accentA)]/20 hover:bg-[var(--accentA)]/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card)] focus:ring-[var(--accentA)] btn btn-cta"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
         <p className="text-xs text-[var(--muted)] text-center">
            SSO & MFA options available in enterprise plans.
        </p>
      </div>
    </div>
  );
};

export default Login;
