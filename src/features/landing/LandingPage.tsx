import { ROUTES } from '../../config/constants';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-green-deep text-cream py-6 px-8 flex justify-between items-center">
        <div className="text-2xl font-serif">
          Exit<span className="text-amber italic">Wise</span>
        </div>
        <div className="space-x-4">
          <Link to={ROUTES.LOGIN} className="btn-ghost">Sign in</Link>
          <Link to={ROUTES.SIGNUP} className="btn-primary">Start a knowledge transfer</Link>
        </div>
      </header>
      
      <main className="flex-grow">
        <section className="bg-green-deep text-cream py-24 px-8 text-center">
          <h1 className="text-5xl md:text-7xl mb-6">
            Preserve your <span className="text-amber italic">legacy</span>.
          </h1>
          <p className="text-xl max-w-2xl mx-auto text-green-pale">
            ExitWise extracts the unwritten expertise of retiring workers, ensuring 30 years of knowledge doesn't walk out the door.
          </p>
        </section>

        <section className="py-24 px-8 bg-cream grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-white p-8 rounded-lg border border-cream-dark shadow-sm">
            <h3 className="text-2xl mb-4">700K Workers</h3>
            <p className="text-text-mid">Canada is losing skilled trades at an unprecedented rate. Capture their wisdom now.</p>
          </div>
          <div className="bg-white p-8 rounded-lg border border-cream-dark shadow-sm">
            <h3 className="text-2xl mb-4">6 Sessions</h3>
            <p className="text-text-mid">Structured, AI-guided interviews that honor the retiree's time and experience.</p>
          </div>
          <div className="bg-white p-8 rounded-lg border border-cream-dark shadow-sm">
            <h3 className="text-2xl mb-4">$0 Documenting</h3>
            <p className="text-text-mid">No manual documentation required. The AI converts conversations into structured profiles.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
