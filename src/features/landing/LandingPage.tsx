import { ROUTES } from '../../config/constants';
import { Link } from 'react-router-dom';
import { Button } from '../../components/shared/Button';
import { PerspectiveMarquee } from '../../components/shared/PerspectiveMarquee';
import { motion } from 'framer-motion';
import { cn } from '../../utils/helpers';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] as [number, number, number, number] }
};

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-cream selection:bg-amber selection:text-green-deep">
      <header className="fixed top-0 w-full z-50 bg-green-deep/95 backdrop-blur-sm text-cream py-4 px-8 flex justify-between items-center">
        <div className="text-2xl font-serif">
          Exit<span className="text-amber italic">Wise</span>
        </div>
        <div className="flex items-center space-x-6">
          <Link to={ROUTES.LOGIN} className="text-sm font-medium hover:text-amber transition-colors">Sign in</Link>
          <Link to={ROUTES.SIGNUP}>
            <Button variant="default" size="sm">
              Start a knowledge transfer
            </Button>
          </Link>
        </div>
      </header>
      
      <main className="flex-grow pt-20">
        {/* Hero Section */}
        <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
          <PerspectiveMarquee className="opacity-60 translate-y-32" />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            className="relative z-10 text-center px-8"
          >
            <h1 className="text-8xl md:text-[12rem] mb-12 font-serif font-bold tracking-tight">
              Exit<span className="text-amber italic">Wise</span>
            </h1>
            <p className="text-xl max-w-2xl mx-auto text-text-mid font-medium leading-relaxed mb-12">
              Structured capture for unstructured experience. We turn the "why" behind decades of expertise into your organization's most durable asset.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link to={ROUTES.SIGNUP}>
                <Button size="lg" className="text-lg px-10 h-14">
                  Preserve Your Legacy
                </Button>
              </Link>
              <a href="#about">
                <Button variant="neutral" size="lg" className="text-lg px-10 h-14">
                  About
                </Button>
              </a>
            </div>
          </motion.div>
        </section>

        {/* Features / Facts Section */}
        <motion.section 
          {...fadeInUp}
          className="py-32 px-8 bg-cream relative"
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-20">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-5xl mb-6">Tacit to <span className="italic text-amber">Tangible</span></h2>
                <p className="text-lg text-text-mid">Manuals teach the "what." ExitWise captures the "why." Our platform ensures that when your experts move on, their wisdom stays.</p>
              </div>
              <div className="mt-8 md:mt-0">
                <div className="text-6xl font-serif text-amber/20">01—04</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Legacy', title: 'Honor the Tenure', text: 'Ensuring hard-won knowledge outlasts the career of those who built it.', delay: 0 },
                { label: 'Capture', title: 'Structured Extraction', text: 'AI-guided sessions that turn conversational flow into technical reality.', delay: 0.1, shift: true },
                { label: 'Retention', title: 'Unwritten Rules', text: 'Finally documenting the "tribal knowledge" that keeps operations running.', delay: 0.2 },
                { label: 'Asset', title: 'Durable Intelligence', text: 'Convert experience into a searchable, scalable asset for the next generation.', delay: 0.3, shift: true }
              ].map((card, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: card.delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                  className={cn(
                    "bg-white/40 backdrop-blur-md p-8 border-2 border-green-deep shadow-[4px_4px_0px_0px_rgba(26,58,42,1)] flex flex-col justify-between h-64",
                    card.shift && "md:translate-y-8"
                  )}
                >
                  <div className="label-caps text-green-mid">{card.label}</div>
                  <div>
                    <h3 className="text-xl mb-2 font-bold">{card.title}</h3>
                    <p className="text-sm text-text-mid">{card.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Sales/Trust Section */}
        <motion.section 
          {...fadeInUp}
          className="py-32 px-8 bg-green-deep text-cream overflow-hidden"
        >
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl text-cream mb-8 leading-tight">The high cost of <span className="italic text-amber">leaving</span>.</h2>
              <div className="space-y-8">
                {[
                  { val: '700k', title: 'Worker Shortfall', text: 'Canada is losing skilled trades at an unprecedented rate. We bridge the gap.', delay: 0 },
                  { val: '30y', title: 'Knowledge Loss', text: 'Decades of nuance can walk out the door in a single afternoon.', delay: 0.1 },
                  { val: '6s', title: 'Simple Capture', text: 'Our 6-session framework extracts context that manual methods miss.', delay: 0.2 }
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: item.delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                    className="flex gap-4"
                  >
                    <div className="text-amber font-serif text-3xl">{item.val}</div>
                    <div>
                      <h4 className="text-cream font-bold mb-1">{item.title}</h4>
                      <p className="text-green-pale text-sm">{item.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-amber/20 blur-3xl rounded-full"></div>
              <div className="relative bg-cream p-12 border-2 border-amber shadow-[12px_12px_0px_0px_rgba(200,137,42,1)]">
                <h3 className="text-3xl text-green-deep mb-6 font-serif italic">"Finally, the unwritten rules are written."</h3>
                <p className="text-green-deep/70 mb-8 leading-relaxed">Our mission is to ensure that the hard-won experience of the previous generation becomes the foundation for the next.</p>
                <Link to={ROUTES.SIGNUP}>
                  <Button variant="default" size="lg" className="w-full">
                    Start now
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* About Section */}
        <motion.section 
          {...fadeInUp}
          id="about" 
          className="py-32 px-8 bg-cream"
        >
          <div className="max-w-7xl mx-auto text-center">
            <div className="label-caps mb-4 text-amber">The Team</div>
            <h2 className="text-4xl md:text-5xl mb-16 font-serif">Behind ExitWise</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
              {[
                { name: 'Cy Iver Torrefranca', emoji: '🐢' },
                { name: 'Tuan Thanh Nguyen', emoji: '🐈' },
                { name: 'Le Hai Quy Bui', emoji: '🦊' },
                { name: 'Po-Hsien Lu', emoji: '🐨' }
              ].map((member, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                  className="space-y-4"
                >
                  <div className="text-5xl">{member.emoji}</div>
                  <h3 className="text-xl font-bold">{member.name}</h3>
                  <p className="text-sm text-text-light uppercase tracking-widest">{}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      </main>


      <footer className="bg-cream py-12 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="text-xl font-serif mb-8 md:mb-0">
            Exit<span className="text-amber italic">Wise</span>
          </div>
          <div className="flex space-x-8 text-sm text-text-light uppercase tracking-widest">
            <a href="#about" className="hover:text-amber transition-colors">About</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
