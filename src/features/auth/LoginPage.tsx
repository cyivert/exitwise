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
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden md:flex flex-col justify-between w-[42%] bg-green-deep text-cream p-14 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(200,137,42,0.12),_transparent_60%)]" />
        <div className="relative z-10 font-serif text-2xl">
          Exit<span className="text-amber italic">Wise</span>
        </div>
        <div className="relative z-10">
          <div className="text-amber font-serif text-5xl mb-6 select-none">✦</div>
          <h2 className="font-serif text-4xl text-cream mb-5 leading-tight">
            "Finally, the unwritten<br />rules are written."
          </h2>
          <p className="text-green-pale/60 text-sm leading-relaxed max-w-xs">
            Structured capture for unstructured experience. Preserving decades of expertise for those who follow.
          </p>
        </div>
        <p className="relative z-10 text-green-pale/30 text-xs uppercase tracking-widest">
          ExitWise · Knowledge Transfer Platform
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 bg-cream flex items-center justify-center px-8 py-16">
        <div className="max-w-sm w-full">
          <div className="md:hidden font-serif text-2xl mb-10">
            Exit<span className="text-amber italic">Wise</span>
          </div>

          <p className="label-caps text-amber mb-2">Welcome back</p>
          <h1 className="font-serif text-3xl mb-8 text-text-dark">Sign in</h1>

          {error && (
            <div className="mb-6 p-3 bg-red-light text-red-danger rounded border border-red-danger/20 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-caps block mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-cream-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-mid/40 focus:border-green-mid transition-colors"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="label-caps block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-cream-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-mid/40 focus:border-green-mid transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full btn-primary py-3 text-base mt-2"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-text-light text-sm">
            Don't have an account?{' '}
            <Link to={ROUTES.SIGNUP} className="text-amber hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
