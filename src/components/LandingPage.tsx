import { useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowRight,
  Cpu,
  Brain,
  Globe,
  Shield,
  Mic,
  BookOpen,
  Zap,
  Lock,
  Database,
  type LucideIcon,
} from 'lucide-react';
import type { Page } from '@/lib/types';

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];
    let raf = 0;

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
      const count = Math.min(60, Math.floor((canvas!.width * canvas!.height) / 15000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        a: Math.random() * 0.5 + 0.1,
      }));
    }

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${p.a})`;
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${(1 - dist / 120) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

function FeatureCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="glass rounded-2xl p-6 hover:border-[var(--border-accent)] transition-all duration-300 group hover:-translate-y-1">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 flex items-center justify-center mb-4 group-hover:glow-sm transition-all">
        <Icon size={22} className="text-[var(--accent-primary)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center font-bold text-white text-sm">
        {num}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</h4>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function LandingPage({ onLaunch }: { onLaunch: (p: Page) => void }) {
  return (
    <div className="min-h-screen bg-[var(--bg-deepest)] relative overflow-hidden">
      {/* Ambient glows */}
      <div className="ambient-glow w-[600px] h-[600px] bg-[var(--accent-primary)] opacity-10 top-[-200px] right-[-100px]" />
      <div className="ambient-glow w-[500px] h-[500px] bg-[var(--accent-secondary)] opacity-10 bottom-[-200px] left-[-100px]" />

      {/* Nav bar */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center glow-sm">
            <Sparkles size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg gradient-text">Deva AI</span>
        </div>
        <button onClick={() => onLaunch('chat')} className="btn-primary text-sm py-2 px-5">
          Launch Deva AI <ArrowRight size={16} />
        </button>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-12 md:pt-20 pb-20 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-[var(--text-secondary)]">Local-first AI powered by Ollama</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-5" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Intelligence That <br />
              <span className="gradient-text">Stays With You.</span>
            </h1>
            <p className="text-base md:text-lg text-[var(--text-secondary)] leading-relaxed mb-8 max-w-lg">
              Deva AI is your personal, local-first AI assistant. Chat, research, and build knowledge — all powered by your own machine. Your data never leaves your device.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => onLaunch('chat')} className="btn-primary">
                Launch Deva AI <ArrowRight size={18} />
              </button>
              <button onClick={() => onLaunch('assistant')} className="btn-secondary">
                <Sparkles size={18} /> Explore Assistant
              </button>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative h-[400px] rounded-2xl glass overflow-hidden bg-grid">
            <ParticleField />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-48 h-48">
                {/* Orb */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] opacity-30 blur-2xl animate-[orbPulse_4s_ease-in-out_infinite]" />
                <div className="absolute inset-4 rounded-full border-2 border-[var(--accent-primary)]/40 animate-[orbRing_8s_linear_infinite]" />
                <div className="absolute inset-8 rounded-full border border-[var(--accent-secondary)]/30 animate-[orbRing_6s_linear_infinite_reverse]" />
                <div className="absolute inset-12 rounded-full bg-gradient-to-br from-[var(--accent-primary)]/40 to-[var(--accent-secondary)]/40 backdrop-blur-sm flex items-center justify-center">
                  <Sparkles size={40} className="text-white/80 animate-float" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About section */}
      <section className="relative z-10 px-6 md:px-12 py-16 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">About Deva AI</h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
            A unified AI assistant that combines conversation, research, knowledge management, and persistent memory — designed to run entirely on your machine.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard icon={Cpu} title="Local AI Engine" description="Powered by Ollama with the qwen3:1.7b model. No cloud AI subscriptions required. Your conversations stay on your machine." />
          <FeatureCard icon={Shield} title="Privacy-First" description="Your data never leaves your device. All conversations, memories, and knowledge are stored locally in your browser's database." />
          <FeatureCard icon={Brain} title="Persistent Memory" description="Deva remembers what matters. Save facts, preferences, and project details that persist across sessions." />
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 px-6 md:px-12 py-16 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Built for Everything</h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">Every feature you need from a modern AI assistant, running locally.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard icon={Sparkles} title="JARVIS-Inspired Assistant" description="A futuristic voice-enabled assistant with an animated AI orb. Talk to Deva and hear responses with text-to-speech." />
          <FeatureCard icon={Globe} title="Online Research" description="Search the web, extract content, and save findings to your knowledge library for offline retrieval." />
          <FeatureCard icon={BookOpen} title="Knowledge Library" description="Upload documents, store research, and retrieve relevant information during conversations with RAG-style retrieval." />
          <FeatureCard icon={Database} title="Offline Retrieval" description="Once content is saved, it's available forever — even without an internet connection." />
          <FeatureCard icon={Mic} title="Voice Interaction" description="Speak to Deva using browser speech recognition and hear responses with text-to-speech output." />
          <FeatureCard icon={Lock} title="Owner Identity" description="Deva knows its creator and owner. Customize your profile so Deva understands your context and preferences." />
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 md:px-12 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">How It Works</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <StepCard num="1" title="Start Ollama" description="Ensure Ollama is running locally with the qwen3:1.7b model. Deva AI connects automatically." />
          <StepCard num="2" title="Launch Deva AI" description="Open the app in your browser. The landing page connects you to the full assistant interface." />
          <StepCard num="3" title="Chat and Ask" description="Have conversations, ask questions, and get responses streamed directly from your local model." />
          <StepCard num="4" title="Build Knowledge" description="Save memories, research topics, and build a personal knowledge library that Deva can reference." />
        </div>
      </section>

      {/* Creator section */}
      <section className="relative z-10 px-6 md:px-12 py-16 max-w-4xl mx-auto text-center">
        <div className="glass rounded-3xl p-10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center mx-auto mb-5 glow-md">
            <Sparkles size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">Created by Hirwa Christian</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
            Deva AI was created by Hirwa Christian as a personal AI assistant, coding companion, and productivity partner. It is designed for local-first operation on modest hardware — no GPU or cloud AI required.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 md:px-12 py-16 max-w-4xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Begin?</h2>
        <p className="text-[var(--text-secondary)] mb-8">Launch Deva AI and start your local-first AI journey.</p>
        <button onClick={() => onLaunch('chat')} className="btn-primary text-base px-8 py-3.5">
          Launch Deva AI <ArrowRight size={20} />
        </button>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border-subtle)] px-6 md:px-12 py-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="text-sm font-semibold gradient-text">Deva AI</span>
            <span className="text-xs text-[var(--text-muted)]">v1.0.0</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
            <button onClick={() => onLaunch('chat')} className="hover:text-[var(--text-primary)] transition-colors">Chat</button>
            <button onClick={() => onLaunch('assistant')} className="hover:text-[var(--text-primary)] transition-colors">Assistant</button>
            <button onClick={() => onLaunch('research')} className="hover:text-[var(--text-primary)] transition-colors">Research</button>
            <button onClick={() => onLaunch('settings')} className="hover:text-[var(--text-primary)] transition-colors">Settings</button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Created by Hirwa Christian</p>
        </div>
      </footer>
    </div>
  );
}
