import { useAuthStore } from '../../store/authStore';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../config/constants';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} />;
  }

  return (
    <div className="min-h-screen bg-cream">
      <nav className="bg-green-deep text-cream py-4 px-8 flex justify-between items-center">
        <div className="text-xl font-serif">
          Exit<span className="text-amber italic">Wise</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-green-pale">{user.full_name}</span>
          <div className="w-8 h-8 rounded-full bg-amber flex items-center justify-center text-white text-xs font-bold">
            {user.full_name.split(' ').map(n => n[0]).join('')}
          </div>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl mb-2">Welcome back, {user.full_name.split(' ')[0]}</h1>
          <p className="text-text-light uppercase tracking-wider text-xs font-bold">
            {user.role} Dashboard • {new Date().toLocaleDateString()}
          </p>
        </header>

        {user.role === 'admin' && (
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            {[
              { label: 'Active Transfers', value: '12' },
              { label: 'Completed', value: '45' },
              { label: 'Retiring in 90d', value: '3' },
              { label: 'Avg Completion', value: '92%' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-lg border border-cream-dark shadow-sm">
                <p className="label-caps mb-2">{stat.label}</p>
                <p className="text-3xl font-serif text-text-dark">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {user.role === 'retiree' && (
          <div className="bg-white rounded-lg border border-cream-dark shadow-sm overflow-hidden">
            <div className="p-6 border-b border-cream-dark flex justify-between items-center">
              <h3 className="text-xl font-serif">Your Knowledge Sessions</h3>
              <button className="btn-primary">Continue Session 3</button>
            </div>
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5, 6].map(num => (
                <div key={num} className="flex items-center justify-between p-4 rounded-md bg-cream/30 border border-cream-dark/50">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${num < 3 ? 'bg-green-light' : num === 3 ? 'bg-amber' : 'bg-cream-dark'}`} />
                    <span className="font-medium">Session {num}: {['Orientation', 'Processes', 'Decisions', 'Relationships', 'Edge Cases', 'Review'][num-1]}</span>
                  </div>
                  <span className="text-xs uppercase tracking-widest text-text-light font-bold">
                    {num < 3 ? 'Completed' : num === 3 ? 'In Progress' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {user.role === 'successor' && (
          <div className="max-w-2xl">
            <div className="bg-white p-8 rounded-lg border border-cream-dark shadow-sm">
              <h3 className="text-2xl mb-4 font-serif">Assigned Knowledge Profile</h3>
              <p className="text-text-mid mb-6">You have been granted access to the knowledge profile for <strong>Robert Chen</strong> (Senior Plant Manager).</p>
              <button className="btn-primary w-full">Access Knowledge Profile</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
