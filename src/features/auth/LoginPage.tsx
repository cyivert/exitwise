import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ROUTES } from '../../config/constants';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/api';
import { loginSchema } from '../../schemas/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      setIsLoading(false);
      return;
    }
    
    const result = await authService.login({ email, password });
    
    if (result.data) {
      setAuth(result.data.user, result.data.token);
      navigate(ROUTES.DASHBOARD);
    } else {
      setError(result.error || 'Login failed');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg border border-cream-dark shadow-sm">
        <h2 className="text-3xl text-center mb-8">Sign in to ExitWise</h2>
        {error && <div className="mb-6 p-3 bg-red-light text-red-danger rounded border border-red-danger/20 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="label-caps block mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid"
              required
            />
          </div>
          <div>
            <label className="label-caps block mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid"
              required
            />
          </div>
          <button 
            type="submit" 
            className={`w-full btn-primary ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-text-light">
          Don't have an account? <Link to={ROUTES.SIGNUP} className="text-amber hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
