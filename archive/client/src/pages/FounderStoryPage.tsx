import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

export default function FounderStoryPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/" className="icon-btn flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold">Our Story</h1>
          </div>
        </div>
      </div>

      <div className="page-body space-y-6">
        {/* Hero */}
        <div className="text-center py-4">
          <div className="text-5xl mb-4">💜</div>
          <h2 className="font-display text-3xl font-bold gradient-text leading-tight mb-3">
            Built from the spiral.
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            HoldOff was born at 2am, phone in hand, thumb hovering over send.
          </p>
        </div>

        {/* Story sections */}
        <div className="holdoff-card">
          <h3 className="font-display text-lg font-bold mb-3 text-foreground">The message that started everything</h3>
          <p className="text-sm leading-relaxed text-foreground/80 mb-3">
            It was a "why haven't you texted me back" message. The kind you know you shouldn't send the moment you type it. The kind that comes from fear, not love.
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">
            I sent it anyway. And I watched a relationship I cared about shift — not because of what I felt, but because of how I communicated it.
          </p>
        </div>

        <div className="holdoff-card">
          <h3 className="font-display text-lg font-bold mb-3 text-foreground">The gap between feeling and sending</h3>
          <p className="text-sm leading-relaxed text-foreground/80 mb-3">
            I started researching attachment theory. I learned that anxious attachment doesn't make you broken — it makes you human. But it also means your nervous system is running the show when you're reaching for your phone at midnight.
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">
            What I needed wasn't a therapist in my pocket (though that helps). I needed a pause. A mirror. Something that could ask: <em>is this you, or is this your fear?</em>
          </p>
        </div>

        <div className="holdoff-card">
          <h3 className="font-display text-lg font-bold mb-3 text-foreground">Why HoldOff exists</h3>
          <p className="text-sm leading-relaxed text-foreground/80 mb-3">
            HoldOff is the tool I wish I had. Not to stop you from communicating — but to help you communicate from a grounded place instead of a reactive one.
          </p>
          <p className="text-sm leading-relaxed text-foreground/80 mb-3">
            The AI Filter doesn't judge you. It reads your message, understands the pattern underneath it, and gives you a verdict: SEND, WAIT, or DO NOT SEND. Then it tells you why.
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">
            Sadie, Stacy, and Danny aren't chatbots. They're companions who understand attachment from the inside — because they were built from the patterns, not just the theory.
          </p>
        </div>

        <div className="holdoff-card border-primary/30 bg-primary/5">
          <h3 className="font-display text-lg font-bold mb-3 text-primary">The mission</h3>
          <p className="text-sm leading-relaxed text-foreground/80 mb-3">
            We're building a world where people communicate from their values, not their wounds. Where the gap between feeling and sending is a moment of choice, not a reflex.
          </p>
          <p className="text-sm leading-relaxed text-foreground/80">
            Every pause is a small act of self-respect. Every held-back message is a relationship protected. HoldOff is here to help you take that pause — and understand what's underneath it.
          </p>
        </div>

        {/* Quotes */}
        <div className="space-y-3">
          {[
            { quote: "The pause is where the healing happens.", attr: "— HoldOff" },
            { quote: "You're not broken. You're just running old code.", attr: "— Sadie ✨" },
            { quote: "The message you don't send is sometimes the most powerful one.", attr: "— Danny" },
          ].map((q, i) => (
            <div key={i} className="holdoff-card text-center">
              <p className="font-display text-base italic text-foreground/90">"{q.quote}"</p>
              <p className="text-xs text-muted-foreground mt-2">{q.attr}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        {!isAuthenticated ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">Ready to take your first pause?</p>
            <a href={getLoginUrl()} className="holdoff-btn inline-flex">
              Start for free
            </a>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">You're already on the path.</p>
            <Link href="/filter" className="holdoff-btn inline-flex">
              Take a pause now
            </Link>
          </div>
        )}

        {/* Links */}
        <div className="flex justify-center gap-4 pb-4">
          <Link href="/pricing" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/quiz" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Take the quiz
          </Link>
          <Link href="/companions" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Meet the companions
          </Link>
        </div>
      </div>
    </div>
  );
}
