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
      invite_code: inviteCode || undefined,
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
      invite_code: inviteCode,
    });

    if (result.data) {
      setAuth(result.data.user, result.data.token);
      navigate(ROUTES.DASHBOARD);
    } else {
      setError(result.error || 'Signup failed');
    }
    setIsLoading(false);
  };

  const roleDescriptions: Record<string, string> = {
    organization_admin: 'Manage your org, members, and knowledge transfers.',
    retiree: 'Capture your expertise through guided AI sessions.',
    successor: 'Access the knowledge profile assigned to you.',
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden md:flex flex-col justify-between w-[42%] bg-green-deep text-cream p-14 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(200,137,42,0.12),_transparent_60%)]" />
        <div className="relative z-10 font-serif text-2xl">
          Exit<span className="text-amber italic">Wise</span>
        </div>
        <div className="relative z-10 space-y-8">
          {[
            { val: '6', label: 'Guided Sessions', text: 'Structured framework to extract tacit knowledge.' },
            { val: '∞', label: 'Legacy Duration', text: 'Expertise that outlasts the career of those who built it.' },
            { val: '1', label: 'Platform', text: 'One place for capture, transfer, and access.' },
          ].map((item) => (
            <div key={item.label} className="flex gap-5 items-start">
              <div className="font-serif text-3xl text-amber shrink-0 w-10">{item.val}</div>
              <div>
                <p className="text-cream font-medium text-sm mb-0.5">{item.label}</p>
                <p className="text-green-pale/50 text-xs leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="relative z-10 text-green-pale/30 text-xs uppercase tracking-widest">
          ExitWise · Knowledge Transfer Platform
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 bg-cream flex items-center justify-center px-8 py-16 overflow-y-auto">
        <div className="max-w-sm w-full">
          <div className="md:hidden font-serif text-2xl mb-10">
            Exit<span className="text-amber italic">Wise</span>
          </div>

          <p className="label-caps text-amber mb-2">Get started</p>
          <h1 className="font-serif text-3xl mb-8 text-text-dark">Create your account</h1>

          {error && (
            <div className="mb-6 p-3 bg-red-light text-red-danger rounded border border-red-danger/20 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-caps block mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-cream-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-mid/40 focus:border-green-mid transition-colors"
                placeholder="Your full name"
                required
              />
            </div>

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
              <label className="label-caps block mb-2">I am a…</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-4 py-3 border border-cream-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-mid/40 focus:border-green-mid transition-colors"
              >
                <option value="organization_admin">Organization Admin</option>
                <option value="retiree">Retiree</option>
                <option value="successor">Successor</option>
              </select>
              <p className="mt-1.5 text-xs text-text-light">{roleDescriptions[role]}</p>
            </div>

            <div>
              <label className="label-caps block mb-2">Invite Code <span className="normal-case font-normal text-text-light">(optional)</span></label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="8-character code"
                className="w-full px-4 py-3 border border-cream-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-mid/40 focus:border-green-mid transition-colors"
              />
              <p className="mt-1.5 text-xs text-text-light">Joining an existing organization? Enter code here.</p>
            </div>

            {!inviteCode && (
              <div>
                <label className="label-caps block mb-2">Organization Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-4 py-3 border border-cream-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-mid/40 focus:border-green-mid transition-colors"
                  required={!inviteCode}
                />
                <p className="mt-1.5 text-xs text-text-light">Create a new workspace for your knowledge transfer.</p>
              </div>
            )}

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
              className={`w-full btn-primary py-3 text-base mt-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account…' : 'Create Account'}
            </button>
          </form>

          <p className="mt-8 text-center text-text-light text-sm">
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} className="text-amber hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
