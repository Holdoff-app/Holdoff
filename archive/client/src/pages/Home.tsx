import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AnimatedAvatar, { detectSentiment, type AvatarExpression } from "@/components/AnimatedAvatar";

// ─── Filter Demo ──────────────────────────────────────────────────────────────

type VerdictResult = {
  verdict: "SEND" | "WAIT" | "DO NOT SEND";
  explanation: string;
  patternName: string;
  reframe: string | null;
  rewrite: string | null;
};

const VERDICT_CONFIG = {
  "SEND": { icon: "✓", bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400" },
  "WAIT": { icon: "⏸", bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400" },
  "DO NOT SEND": { icon: "✕", bg: "bg-rose-500/10 border-rose-500/30", text: "text-rose-400" },
};

function FilterDemo() {
  const { isAuthenticated } = useAuth();
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<VerdictResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzeMutation = trpc.filter.analyze.useMutation({
    onSuccess: (data) => { setResult(data as VerdictResult); setLoading(false); },
    onError: () => { toast.error("Something went wrong. Try again."); setLoading(false); },
  });

  const handleAnalyze = () => {
    if (!message.trim()) return;
    setLoading(true);
    setResult(null);
    analyzeMutation.mutate({ message: message.trim() });
  };

  const verdictConfig = result ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <div className="holdoff-card">
      {!result ? (
        <div className="space-y-3">
          <textarea
            className="holdoff-textarea text-sm"
            placeholder="Paste the message you're about to send..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={1000}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !message.trim()}
            className="holdoff-btn w-full text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
                Analyzing...
              </span>
            ) : "Get my verdict →"}
          </button>
          {!isAuthenticated && (
            <p className="text-center text-xs text-muted-foreground">3 free verdicts. No sign-up required.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          <div className={`rounded-xl border p-4 text-center ${verdictConfig?.bg}`}>
            <div className={`text-3xl font-display font-bold mb-1 ${verdictConfig?.text}`}>{verdictConfig?.icon}</div>
            <div className={`text-xl font-display font-bold tracking-wider ${verdictConfig?.text}`}>{result.verdict}</div>
            {result.patternName && (
              <div className="inline-block bg-white/5 rounded-full px-3 py-0.5 text-xs text-muted-foreground mt-2">{result.patternName}</div>
            )}
            <p className="text-sm leading-relaxed text-foreground mt-2">{result.explanation}</p>
          </div>
          {result.reframe && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs text-primary font-medium uppercase tracking-wider mb-1">What you're actually feeling</p>
              <p className="text-sm italic text-foreground/80">{result.reframe}</p>
            </div>
          )}
          {result.rewrite && (
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">A better version</p>
              <p className="text-sm text-foreground">{result.rewrite}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setResult(null); setMessage(""); }} className="holdoff-btn-secondary flex-1 text-sm">Try another</button>
            <Link href="/filter" className="holdoff-btn flex-1 text-center text-sm">Full app →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Companion Showcase ───────────────────────────────────────────────────────

const COMPANIONS = [
  {
    id: "sadie",
    name: "Sadie",
    tagline: "Warm. Grounded. Gently challenging.",
    description: "The friend who's done her own work.",
    accent: "text-emerald-300",
    border: "border-emerald-500/30",
    gradient: "from-emerald-500/10 to-transparent",
    avatarPersona: "sadie" as const,
    route: "/companions/sadie",
  },
  {
    id: "stacy",
    name: "Stacy",
    tagline: "Raw honesty. Dark humor. She gets it.",
    description: "Been both the over-texter and the ghost.",
    accent: "text-rose-300",
    border: "border-rose-500/30",
    gradient: "from-rose-500/10 to-transparent",
    avatarPersona: "stacy" as const,
    route: "/companions/stacy",
  },
  {
    id: "danny",
    name: "Danny",
    tagline: "Calm. Logical. The avoidant decoder.",
    description: "Helps you understand what they're not saying.",
    accent: "text-amber-300",
    border: "border-amber-500/30",
    gradient: "from-amber-500/10 to-transparent",
    avatarPersona: "danny" as const,
    route: "/companions/danny",
  },
];

// ─── Home Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [hoveredCompanion, setHoveredCompanion] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3.5 bg-background/80 backdrop-blur-md border-b border-border">
        <span className="font-display text-xl font-semibold gradient-text">HoldOff</span>
        <div className="flex items-center gap-3">
          <Link href="/story" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Story</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pricing</Link>
          {isAuthenticated ? (
            <Link href="/filter" className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-full font-medium hover:opacity-90 transition-opacity">
              Open App
            </Link>
          ) : (
            <a href={getLoginUrl()} className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-full font-medium hover:opacity-90 transition-opacity">
              Sign in free
            </a>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-28 pb-16 px-5 text-center max-w-lg mx-auto">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6 text-sm text-primary">
          <span>✨</span>
          <span>Save yourself from yourself</span>
        </div>
        <h1 className="font-display text-5xl font-bold leading-tight mb-4">
          The pause between you and your{" "}
          <span className="gradient-text italic">worst self.</span>
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-8">
          An AI that intercepts impulsive messages before they destroy what you're actually trying to protect.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isAuthenticated ? (
            <Link href="/filter" className="holdoff-btn text-base px-8 py-3.5 rounded-full glow-purple">
              Open HoldOff
            </Link>
          ) : (
            <a href={getLoginUrl()} className="holdoff-btn text-base px-8 py-3.5 rounded-full glow-purple">
              Try it free
            </a>
          )}
          <Link href="/story" className="holdoff-btn-secondary text-base px-8 py-3.5 rounded-full">
            Read the story
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-4">3 free verdicts. No credit card required.</p>
      </section>

      {/* ── Live Filter Demo ── */}
      <section className="py-12 px-5 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <span className="section-label">Try it now</span>
          <h2 className="font-display text-2xl font-semibold mt-1">Should you send it?</h2>
          <p className="text-muted-foreground text-sm mt-1">Paste any message. Get a verdict in seconds.</p>
        </div>
        <FilterDemo />
      </section>

      {/* ── How it works ── */}
      <section className="py-12 px-5 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <span className="section-label">How it works</span>
          <h2 className="font-display text-2xl font-semibold mt-1">Three seconds of truth</h2>
        </div>
        <div className="space-y-4 stagger-children">
          {[
            { n: "01", t: "Paste your message", d: "Type or paste the message you're about to send. Be honest. No one's watching." },
            { n: "02", t: "Get your verdict", d: "Our AI reads the energy, the attachment patterns, the timing." },
            { n: "03", t: "SEND. WAIT. DO NOT SEND.", d: "One of three verdicts — with the reason why. Then you decide." },
          ].map((step) => (
            <div key={step.n} className="holdoff-card flex gap-4">
              <span className="font-display text-4xl font-bold gradient-text opacity-50 shrink-0 leading-none">{step.n}</span>
              <div>
                <h3 className="font-semibold text-sm mb-1">{step.t}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{step.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Companions ── */}
      <section className="py-12 px-5 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <span className="section-label">AI Companions</span>
          <h2 className="font-display text-2xl font-semibold mt-1">Friends who get it</h2>
          <p className="text-muted-foreground text-sm mt-1">Three personas. Three attachment lenses. All real.</p>
        </div>

        <div className="space-y-4">
          {COMPANIONS.map((companion) => (
            <Link key={companion.id} href={isAuthenticated ? companion.route : getLoginUrl()}>
              <div
                className={`holdoff-card bg-gradient-to-r ${companion.gradient} border ${companion.border} cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all duration-150`}
                onMouseEnter={() => setHoveredCompanion(companion.id)}
                onMouseLeave={() => setHoveredCompanion(null)}
              >
                <div className="flex items-center gap-4">
                  <AnimatedAvatar
                    persona={companion.avatarPersona}
                    expression={hoveredCompanion === companion.id ? "happy" : "neutral"}
                    size="md"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-display text-lg font-bold ${companion.accent}`}>{companion.name}</h3>
                    <p className="text-sm font-medium text-foreground/80">{companion.tagline}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{companion.description}</p>
                  </div>
                  <svg className="flex-shrink-0 text-muted-foreground/40" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="py-12 px-5 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <span className="section-label">Everything you need</span>
          <h2 className="font-display text-2xl font-semibold mt-1">Built for the over-texter</h2>
          <p className="text-muted-foreground text-sm mt-1">And the ghoster. And the one who swings between desperate and distant.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "🛡️", title: "AI Filter", desc: "SEND / WAIT / DO NOT SEND verdicts with attachment-aware explanations." },
            { icon: "🔍", title: "Interpreter", desc: "Decode what their message really means. What they need. How you're misreading it." },
            { icon: "📓", title: "Private Journal", desc: "Track your moods, patterns, and growth over time." },
            { icon: "🌐", title: "Community", desc: "Anonymous reflections from people who get it." },
            { icon: "📊", title: "Insights", desc: "AI-powered analysis of your contacts' communication patterns." },
            { icon: "🧠", title: "Attachment Quiz", desc: "Discover your attachment style and get personalized guidance." },
          ].map((f) => (
            <div key={f.title} className="holdoff-card">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Founder quote ── */}
      <section className="py-12 px-5 max-w-lg mx-auto">
        <div className="holdoff-card border-primary/20 bg-primary/5 text-center">
          <blockquote className="font-display text-xl italic text-foreground leading-relaxed mb-4">
            "I built HoldOff because I was the problem. Not because I had it figured out."
          </blockquote>
          <p className="text-sm text-muted-foreground">— Stacy Martin, Founder</p>
          <Link href="/story" className="inline-block mt-4 text-sm text-primary hover:underline">
            Read the full story →
          </Link>
        </div>
      </section>

      {/* ── Pricing teaser ── */}
      <section className="py-12 px-5 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <span className="section-label">Pricing</span>
          <h2 className="font-display text-2xl font-semibold mt-1">Start free. Go deeper.</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="holdoff-card text-center">
            <p className="font-display text-2xl font-bold text-foreground">Free</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">3 verdicts/day</p>
            <ul className="text-xs text-muted-foreground space-y-1 text-left mb-4">
              <li>✓ AI Filter</li>
              <li>✓ Message Interpreter</li>
              <li>✓ Community access</li>
            </ul>
            <a href={getLoginUrl()} className="holdoff-btn-secondary text-xs w-full text-center rounded-lg py-2">
              Start free
            </a>
          </div>
          <div className="holdoff-card border-primary/40 bg-primary/5 text-center">
            <p className="font-display text-2xl font-bold gradient-text">Pro</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">$9.99/mo</p>
            <ul className="text-xs text-muted-foreground space-y-1 text-left mb-4">
              <li>✓ Unlimited verdicts</li>
              <li>✓ AI Companions</li>
              <li>✓ Journal + Insights</li>
              <li>✓ Contact analysis</li>
            </ul>
            <Link href="/pricing" className="holdoff-btn text-xs w-full text-center rounded-lg py-2">
              See full pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-16 px-5 max-w-lg mx-auto text-center">
        <h2 className="font-display text-3xl font-bold mb-4">
          HoldOff exists because I couldn't hold off.
        </h2>
        <p className="text-muted-foreground mb-2 font-semibold">And that's exactly why it's going to work.</p>
        <p className="text-muted-foreground text-sm mb-8">shouldiholdoff.live · Stacy Martin, Founder · June 2026</p>
        {isAuthenticated ? (
          <Link href="/filter" className="holdoff-btn text-lg px-10 py-4 rounded-full glow-purple">
            Start your pause
          </Link>
        ) : (
          <a href={getLoginUrl()} className="holdoff-btn text-lg px-10 py-4 rounded-full glow-purple">
            Start your pause — it's free
          </a>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 px-5 text-center text-xs text-muted-foreground">
        <div className="flex justify-center gap-6 mb-4">
          <Link href="/story" className="hover:text-foreground transition-colors">Story</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/filter" className="hover:text-foreground transition-colors">App</Link>
          <Link href="/companions" className="hover:text-foreground transition-colors">Companions</Link>
        </div>
        <p>© 2026 HoldOff. Save yourself from yourself — so love still sees tomorrow.</p>
        <p className="mt-2 text-xs opacity-60">HoldOff is not a substitute for professional mental health support.</p>
      </footer>
    </div>
  );
}
