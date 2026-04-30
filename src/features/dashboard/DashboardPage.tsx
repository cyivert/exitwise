import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/constants';
import { dashboardService, interviewService } from '../../services/api';
import UserMenu from '../../components/shared/UserMenu';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<{ experiences?: any[]; activeExperience?: any; sessions?: any[]; engagement?: any; organization?: any; members?: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<any[]>([]);
  const [memberForm, setMemberForm] = useState({ full_name: '', email: '', password: '', role: 'retiree', job_title: '', years_exp: '' });
  const [adminTab, setAdminTab] = useState<'overview' | 'members' | 'experiences'>('overview');

  useEffect(() => {
    if (isAuthenticated) {
      dashboardService.getDashboard().then(res => {
        if (res.data) {
          setData(res.data);
          setSelectedExperienceId(res.data.activeExperience?.id || res.data.experiences?.[0]?.id || null);
          setSelectedSessions(res.data.sessions || []);
        }
        setIsLoading(false);
      });
    }
  }, [isAuthenticated]);

  const selectedExperience = useMemo(
    () => (data?.experiences || []).find((experience) => experience.id === selectedExperienceId) || data?.activeExperience || null,
    [data, selectedExperienceId]
  );


  useEffect(() => {
    const loadSelectedSessions = async () => {
      if (!selectedExperienceId) {
        setSelectedSessions([]);
        return;
      }

      if (selectedExperienceId === data?.activeExperience?.id) {
        setSelectedSessions(data?.sessions || []);
        return;
      }

      const sessionsRes = await interviewService.getSessions(selectedExperienceId);
      if (Array.isArray(sessionsRes.data)) {
        setSelectedSessions(sessionsRes.data);
      }
    };

    loadSelectedSessions();
  }, [data?.activeExperience?.id, data?.sessions, selectedExperienceId]);

  const handleRelease = async () => {
    const date = new Date().toISOString();
    if (!selectedExperience?.id) return;
    const res = await dashboardService.updateReleaseDate(date, selectedExperience.id);
    if (res.data) {
      setData(prev => prev ? {
        ...prev,
        experiences: (prev.experiences || []).map((experience) => experience.id === selectedExperience.id ? { ...experience, release_date: date } : experience),
        activeExperience: prev.activeExperience?.id === selectedExperience.id ? { ...prev.activeExperience, release_date: date } : prev.activeExperience,
      } : null);
    }
  };

  const nextSession = selectedSessions.find((s) => s.status !== 'complete') || selectedSessions[0];
  const startButtonLabel = nextSession?.status === 'pending' && nextSession?.session_number === 1 ? 'Start' : 'Continue Next Session';

  const isOrganizationAdmin = user?.role === 'organization_admin' || user?.role === 'admin';

  const handleCreateMember = async () => {
    if (!memberForm.full_name || !memberForm.email || !memberForm.password) return;

    setIsBusy(true);
    const res = await dashboardService.createOrgMember({
      full_name: memberForm.full_name,
      email: memberForm.email,
      password: memberForm.password,
      role: memberForm.role,
      job_title: memberForm.job_title || undefined,
      years_exp: memberForm.years_exp ? Number(memberForm.years_exp) : undefined,
    });

    if (res.data?.user) {
      setData((prev) => prev ? { ...prev, members: [res.data.user, ...(prev.members || [])] } : prev);
      setMemberForm({ full_name: '', email: '', password: '', role: 'retiree', job_title: '', years_exp: '' });
    }

    setIsBusy(false);
  };

  const handleDeleteMember = async (memberId: string) => {
    setIsBusy(true);
    const res = await dashboardService.deleteOrgMember(memberId);
    if (res.data) {
      setData((prev) => prev ? { ...prev, members: (prev.members || []).filter((member: any) => member.id !== memberId) } : prev);
    }
    setIsBusy(false);
  };

  const handleAddExperience = async () => {
    setIsBusy(true);
    const res = await dashboardService.createExperience();
    if (res.data?.engagement && Array.isArray(res.data.sessions)) {
      const newExperience = { ...res.data.engagement, sessions: res.data.sessions };
      setData((prev) => {
        const existing = prev?.experiences || [];
        return {
          experiences: [newExperience, ...existing],
          activeExperience: newExperience,
          sessions: res.data.sessions,
        };
      });
      setSelectedExperienceId(newExperience.id);
      setSelectedSessions(res.data.sessions);
      navigate(`/interview/${res.data.sessions[0]?.id}`);
    }
    setIsBusy(false);
  };

  const handleDeleteExperience = async (experienceId: string) => {
    if ((data?.experiences || []).length === 1) return;
    setIsBusy(true);
    const res = await dashboardService.deleteExperience(experienceId);
    if (res.data) {
      setData((prev) => {
        if (!prev) return prev;
        const remaining = (prev.experiences || []).filter((experience) => experience.id !== experienceId);
        const nextSelected = remaining[0] || null;
        return {
          experiences: remaining,
          activeExperience: nextSelected,
          sessions: nextSelected?.sessions || [],
        };
      });
      setSelectedExperienceId((current) => current === experienceId ? data?.experiences?.find((experience) => experience.id !== experienceId)?.id || null : current);
    }
    setIsBusy(false);
  };

  const handleRenameExperienceTitle = async (experienceId: string) => {
    setIsBusy(true);
    const res = await dashboardService.renameExperienceTitle(experienceId);
    if (res.data?.experience) {
      setData((prev) => prev ? {
        ...prev,
        experiences: (prev.experiences || []).map((experience) => experience.id === experienceId ? { ...experience, title: res.data.experience.title } : experience),
        activeExperience: prev.activeExperience?.id === experienceId ? { ...prev.activeExperience, title: res.data.experience.title } : prev.activeExperience,
      } : prev);
    }
    setIsBusy(false);
  };

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} />;
  }

  return (
    <div className="min-h-screen bg-cream">
      <nav className="bg-green-deep text-cream py-4 px-8 flex justify-between items-center">
        <div className="text-xl font-serif">
          Exit<span className="text-amber italic">Wise</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-green-pale hidden md:block">{user.full_name}</span>
          <UserMenu dark />
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
            {isOrganizationAdmin && (
              <div className="space-y-8 mb-12">
                <div className="bg-white rounded-lg border border-cream-dark shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-cream-dark flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="label-caps mb-2">Organization Admin Panel</p>
                      <h3 className="text-2xl font-serif">{data?.organization?.name || 'Organization'}</h3>
                      <p className="text-text-light">Manage organization members, retiree experiences, and access from one place.</p>
                    </div>
                    <div className="text-sm text-text-light">
                      {data?.members?.length || 0} members • {data?.experiences?.length || 0} experiences
                    </div>
                  </div>

                  <div className="px-6 pt-6 flex flex-wrap gap-2 border-b border-cream-dark bg-cream/25">
                    <button onClick={() => setAdminTab('overview')} className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${adminTab === 'overview' ? 'bg-white border border-b-0 border-cream-dark text-text-dark' : 'text-text-mid hover:text-text-dark'}`}>
                      Overview
                    </button>
                    <button onClick={() => setAdminTab('members')} className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${adminTab === 'members' ? 'bg-white border border-b-0 border-cream-dark text-text-dark' : 'text-text-mid hover:text-text-dark'}`}>
                      Members
                    </button>
                    <button onClick={() => setAdminTab('experiences')} className={`px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${adminTab === 'experiences' ? 'bg-white border border-b-0 border-cream-dark text-text-dark' : 'text-text-mid hover:text-text-dark'}`}>
                      Experiences
                    </button>
                  </div>

                  <div className="p-6 space-y-8">
                    {adminTab === 'overview' && (
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="p-5 rounded-lg border border-cream-dark bg-cream/30">
                          <p className="label-caps mb-2">Members</p>
                          <p className="text-3xl font-serif text-text-dark">{data?.members?.length || 0}</p>
                        </div>
                        <div className="p-5 rounded-lg border border-cream-dark bg-cream/30">
                          <p className="label-caps mb-2">Experiences</p>
                          <p className="text-3xl font-serif text-text-dark">{data?.experiences?.length || 0}</p>
                        </div>
                        <div className="p-5 rounded-lg border border-cream-dark bg-cream/30">
                          <p className="label-caps mb-2">Private Experiences</p>
                          <p className="text-3xl font-serif text-text-dark">{(data?.experiences || []).filter((experience) => !experience.release_date).length}</p>
                        </div>
                      </div>
                    )}

                    {adminTab === 'members' && (
                      <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                          <input value={memberForm.full_name} onChange={(e) => setMemberForm((prev) => ({ ...prev, full_name: e.target.value }))} placeholder="Full name" className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid" />
                          <input value={memberForm.email} onChange={(e) => setMemberForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" type="email" className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid" />
                          <input value={memberForm.password} onChange={(e) => setMemberForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Temporary password" type="password" className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid" />
                          <select value={memberForm.role} onChange={(e) => setMemberForm((prev) => ({ ...prev, role: e.target.value }))} className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid">
                            <option value="retiree">Retiree</option>
                            <option value="successor">Successor</option>
                            <option value="organization_admin">Organization Admin</option>
                          </select>
                          <input value={memberForm.job_title} onChange={(e) => setMemberForm((prev) => ({ ...prev, job_title: e.target.value }))} placeholder="Job title (optional)" className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid" />
                          <input value={memberForm.years_exp} onChange={(e) => setMemberForm((prev) => ({ ...prev, years_exp: e.target.value }))} placeholder="Years experience (optional)" type="number" className="w-full px-4 py-2 border border-cream-dark rounded-md focus:outline-none focus:ring-1 focus:ring-green-mid" />
                        </div>
                        <div className="flex justify-end">
                          <button onClick={handleCreateMember} className="btn-primary" disabled={isBusy}>Add Member</button>
                        </div>
                        <div className="space-y-3">
                          {(data?.members || []).map((member) => (
                            <div key={member.id} className="flex items-center justify-between p-4 rounded-md bg-cream/30 border border-cream-dark/50">
                              <div>
                                <p className="font-medium">{member.full_name}</p>
                                <p className="text-xs uppercase tracking-widest text-text-light">{member.role} • {member.email}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteMember(member.id)}
                                className="text-xs px-3 py-2 rounded border border-red-200 text-red-700 hover:bg-red-50"
                                disabled={isBusy || member.id === user.id}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {adminTab === 'experiences' && (
                      <div className="space-y-4">
                        {(data?.experiences || []).map((experience) => (
                          <div key={experience.id} className="flex items-center justify-between p-4 rounded-md bg-cream/30 border border-cream-dark/50">
                            <div>
                              <p className="font-medium">{experience.retiree_name || 'Retiree'} • {experience.session_focus}</p>
                              <p className="text-xs uppercase tracking-widest text-text-light">Session {experience.session_number} • {experience.status}</p>
                            </div>
                            <span className="text-xs uppercase tracking-widest text-text-light font-bold">{experience.release_date ? 'Released' : 'Private'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {user.role === 'retiree' && (
              <div className="space-y-8">
                <div className="bg-white rounded-lg border border-cream-dark shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-cream-dark flex justify-between items-center gap-4">
                    <div>
                      <h3 className="text-xl font-serif">Experience Catalogue</h3>
                      <p className="text-sm text-text-light">Add, select, or remove a retiree experience.</p>
                    </div>
                    <button onClick={handleAddExperience} className="btn-primary" disabled={isBusy}>
                      Add +
                    </button>
                  </div>
                  <div className="p-6 space-y-3">
                    {(data?.experiences || []).map((experience, index) => {
                      const isSelected = experience.id === selectedExperienceId;
                      const experienceTitle = experience.title || `Experience ${index + 1}`;
                      return (
                        <div key={experience.id} className={`flex items-center justify-between p-4 rounded-md border transition-colors ${isSelected ? 'bg-amber-light border-amber' : 'bg-cream/30 border-cream-dark/50'}`}>
                          <button
                            onClick={() => setSelectedExperienceId(experience.id)}
                            className="flex flex-col text-left flex-1"
                          >
                            <span className="font-medium">{experienceTitle}</span>
                            <span className="text-xs uppercase tracking-widest text-text-light">
                              {experience.release_date ? `Released ${new Date(experience.release_date).toLocaleDateString()}` : 'Private'}
                            </span>
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRenameExperienceTitle(experience.id)}
                              className="text-xs px-3 py-2 rounded border border-amber/30 text-amber hover:bg-amber-light"
                              disabled={isBusy}
                            >
                              Rename with AI
                            </button>
                            <button
                              onClick={() => setSelectedExperienceId(experience.id)}
                              className="text-xs px-3 py-2 rounded border border-cream-dark text-text-mid hover:text-text-dark"
                            >
                              Select
                            </button>
                            <button
                              onClick={() => handleDeleteExperience(experience.id)}
                              className="text-xs px-3 py-2 rounded border border-red-200 text-red-700 hover:bg-red-50"
                              disabled={isBusy || (data?.experiences || []).length === 1}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-cream-dark shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-cream-dark flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-serif">Your Knowledge Sessions</h3>
                      <p className="text-sm text-text-light">{selectedExperience ? `Selected Experience ${selectedExperienceId === data?.activeExperience?.id ? ' (active)' : ''}` : 'Select an experience to continue.'}</p>
                    </div>
                    <button 
                      onClick={() => navigate(`/interview/${nextSession?.id}`)}
                      className="btn-primary"
                      disabled={!nextSession?.id}
                    >
                      {startButtonLabel}
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {selectedSessions.map(session => (
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
                    You own your knowledge. Your selected experience is currently <strong>{selectedExperience?.release_date ? 'Released' : 'Private'}</strong>.
                  </p>
                  {selectedExperience?.release_date ? (
                    <div className="p-4 bg-green-pale text-green-deep rounded-md">
                      Successor granted access on {new Date(selectedExperience.release_date).toLocaleDateString()}.
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
                      <button
                        className="btn-primary w-full"
                        onClick={() => navigate(ROUTES.KNOWLEDGE)}
                      >
                        Access Knowledge Profile
                      </button>
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
