import { useState } from 'react';
import KnowledgeCard from '../../components/shared/KnowledgeCard';
import { Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/constants';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Processes');
  const [searchQuery, setSearchQuery] = useState('');

  const sections = ['Processes', 'Decisions', 'Relationships', 'Edge Cases', 'Unwritten Rules', 'Advice'];

  // mock profile data
  const mockCards: any[] = [
    {
      title: 'Turbidity Reading Protocol',
      content: 'If reading is above 0.3 NTU after backwash, do not wait. Manual bypass to lagoon immediately or filter bed 4 will overflow.',
      quote: 'Filter 4 is the sensitive one. She likes to act up if you don\'t baby her after a heavy rain.',
      type: 'emergency',
      section: 'Processes'
    },
    {
      title: 'The West Branch Flow',
      content: 'Spring melt causes backflow at the West Branch junction. Diverter gate 12 must be set to 45 degrees, not 90.',
      quote: '90 degrees looks right on the blueprint, but 45 is what stops the silt buildup.',
      type: 'tacit',
      section: 'Processes'
    },
    {
      title: 'Council Liaison Tip',
      content: 'Jim from public works likes a phone call before any formal email. He feels bypassed if you go straight to Jira.',
      type: 'relational',
      section: 'Relationships'
    }
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-green-deep text-cream p-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 rounded-full bg-amber flex items-center justify-center text-white text-3xl font-bold border-4 border-green-mid">
              RC
            </div>
            <div>
              <div className="flex items-center space-x-3 mb-1">
                 <h1 className="text-3xl text-white">Robert Chen</h1>
                 <span className="label-caps bg-green-mid px-2 py-0.5 rounded text-[10px]">RETIRED</span>
              </div>
              <p className="text-green-pale">Senior Plant Manager • 32 Years Experience</p>
            </div>
          </div>

          <div className="flex flex-col items-end space-y-4">
            <button 
              onClick={() => {
                useAuthStore.getState().clearAuth();
                navigate(ROUTES.LOGIN);
              }}
              className="text-sm uppercase tracking-widest text-green-pale hover:text-white transition-colors"
            >
              Logout
            </button>
            <div className="relative w-full md:w-96">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask a question about this role..."
              className="w-full bg-white/10 border border-white/20 rounded-full px-6 py-3 text-cream placeholder:text-green-pale focus:outline-none focus:ring-1 focus:ring-amber"
            />
            <Search className="absolute right-4 top-3.5 text-green-pale w-5 h-5" />
          </div>
        </div>
      </div>
    </header>

      <div className="max-w-7xl mx-auto flex py-12 px-8">
        {/* Left Nav */}
        <aside className="w-48 flex-shrink-0 space-y-2">
           {sections.map(section => (
             <button
               key={section}
               onClick={() => setActiveTab(section)}
               className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                 activeTab === section ? 'bg-amber text-white font-medium' : 'text-text-mid hover:bg-cream-dark'
               }`}
             >
               {section}
             </button>
           ))}
        </aside>

        {/* Content */}
        <main className="flex-grow pl-12">
          <div className="mb-8">
            <h2 className="text-3xl mb-2">{activeTab}</h2>
            <p className="text-text-light">
              Captured unwritten {activeTab.toLowerCase()} from 6 sessions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
             {mockCards
               .filter(c => c.section === activeTab)
               .map((card, i) => (
               <KnowledgeCard key={i} {...card} />
             ))}
             {mockCards.filter(c => c.section === activeTab).length === 0 && (
               <div className="col-span-2 py-24 text-center border-2 border-dashed border-cream-dark rounded-xl">
                 <p className="text-text-light italic">No cards captured for this section yet.</p>
               </div>
             )}
          </div>
        </main>
      </div>
    </div>
  );
}
