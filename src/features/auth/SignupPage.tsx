import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ROUTES } from '../../config/constants';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types';
import { authService } from '../../services/api';
import { signupSchema } from '../../schemas/auth';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('retiree');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const validation = signupSchema.safeParse({
      email,
      password,
      full_name: fullName,
      role,
      org_name: orgName || undefined,
      invite_code: inviteCode || undefined
    });

    if (!validation.success) {
      setError(validation.error.issues[0].message);
      setIsLoading(false);
      return;
    }

    const result = await authService.signup({
      email,
      password,
      full_name: fullName,
      role,
      org_name: orgName,
      invite_code: inviteCode
    });

    if (result.data) {
      setAuth(result.data.user, result.data.token);
      alert(`Welcome to ExitWise, ${result.data.user.full_name}!`);
      navigate(ROUTES.DASHBOARD);
    } else {
      setError(result.error || 'Signup failed');
    }
    setIsLoading(false);
  };


  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-lg border border-cream-dark shadow-sm">
        <h2 className="text-3xl text-center mb-8">Join ExitWise</h2>
        {error && <div className="mb-6 p-3 bg-red-light text-red-danger rounded border border-red-danger/20 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="label-caps block mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid"
              required
            />
          </div>
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
            <label className="label-caps block mb-2">I am a...</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid"
            >
              <option value="organization_admin">Organization Admin</option>
              <option value="retiree">Retiree</option>
              <option value="successor">Successor</option>
            </select>
          </div>
          <div>
            <label className="label-caps block mb-2">Invite Code (Optional)</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="8-character code"
              className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid"
            />
            <p className="mt-1 text-xs text-text-light">Joining an existing organization? Enter code here.</p>
          </div>

          {!inviteCode && (
            <div>
              <label className="label-caps block mb-2">New Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid"
                required={!inviteCode}
              />
              <p className="mt-1 text-xs text-text-light">Create a new workspace for your knowledge transfer.</p>
            </div>
          )}

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
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <p className="mt-6 text-center text-text-light">
          Already have an account? <Link to={ROUTES.LOGIN} className="text-amber hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
