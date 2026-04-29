import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/constants';
import { dashboardService } from '../../services/api';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<{ engagement: any; sessions: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      dashboardService.getDashboard().then(res => {
        if (res.data) setData(res.data);
        setIsLoading(false);
      });
    }
  }, [isAuthenticated]);

  const handleRelease = async () => {
    const date = new Date().toISOString();
    const res = await dashboardService.updateReleaseDate(date);
    if (res.data) {
      setData(prev => prev ? { ...prev, engagement: { ...prev.engagement, release_date: date } } : null);
    }
  };

  const nextSession = data?.sessions.find(s => s.status !== 'complete') || data?.sessions[0];
  const startButtonLabel = nextSession?.status === 'pending' && nextSession?.session_number === 1 ? 'Start' : 'Continue Next Session';

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

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-deep"></div>
          </div>
        ) : (
          <>
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
              <div className="space-y-8">
                <div className="bg-white rounded-lg border border-cream-dark shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-cream-dark flex justify-between items-center">
                    <h3 className="text-xl font-serif">Your Knowledge Sessions</h3>
                    <button 
                      onClick={() => navigate(`/interview/${nextSession?.id}`)}
                      className="btn-primary"
                      disabled={!nextSession?.id}
                    >
                      {startButtonLabel}
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {data?.sessions.map(session => (
                      <div key={session.id} className="flex items-center justify-between p-4 rounded-md bg-cream/30 border border-cream-dark/50">
                        <div className="flex items-center space-x-4">
                          <div className={`w-3 h-3 rounded-full ${session.status === 'complete' ? 'bg-green-light' : session.status === 'active' ? 'bg-amber' : 'bg-cream-dark'}`} />
                          <span className="font-medium">Session {session.session_number}: {session.session_focus}</span>
                        </div>
                        <span className="text-xs uppercase tracking-widest text-text-light font-bold">
                          {session.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-lg border border-cream-dark shadow-sm">
                  <h3 className="text-2xl mb-4 font-serif">The Legacy Trust™ Control</h3>
                  <p className="text-text-mid mb-6">
                    You own your knowledge. Your profile is currently <strong>{data?.engagement?.release_date ? 'Released' : 'Private'}</strong>.
                  </p>
                  {data?.engagement?.release_date ? (
                    <div className="p-4 bg-green-pale text-green-deep rounded-md">
                      Successor granted access on {new Date(data.engagement.release_date).toLocaleDateString()}.
                    </div>
                  ) : (
                    <button onClick={handleRelease} className="btn-primary bg-amber border-amber">Release Knowledge Profile to Successor</button>
                  )}
                </div>
              </div>
            )}

            {user.role === 'successor' && (
              <div className="max-w-2xl">
                <div className="bg-white p-8 rounded-lg border border-cream-dark shadow-sm">
                  <h3 className="text-2xl mb-4 font-serif">Assigned Knowledge Profile</h3>
                  {data?.engagement?.release_date ? (
                    <>
                      <p className="text-text-mid mb-6">Access granted to the knowledge profile. Retiree has authorized release.</p>
                      <button className="btn-primary w-full">Access Knowledge Profile</button>
                    </>
                  ) : (
                    <p className="text-text-mid italic">Profile pending authorization from Retiree. Trust boundary enforced.</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
