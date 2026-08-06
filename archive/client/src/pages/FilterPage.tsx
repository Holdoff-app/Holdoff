import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Link } from "wouter";

const ATTACHMENT_STYLES = [
  { value: "secure", label: "Secure" },
  { value: "anxious", label: "Anxious" },
  { value: "avoidant", label: "Avoidant" },
  { value: "fearful", label: "Fearful-Avoidant" },
];

type VerdictResult = {
  verdict: "SEND" | "HOLD" | "REWRITE" | "WAIT" | "DO NOT SEND";
  explanation: string;
  patternName: string;
  reframe: string | null;
  rewrite: string | null;
  confidence?: number;
  attachmentStyle?: string | null;
  spiralLock?: {
    locked: boolean;
    lockedUntil: Date | null;
    consecutiveCount: number;
  } | null;
};

const VERDICT_CONFIG: Record<string, { icon: string; bg: string; text: string; label: string }> = {
  "SEND": {
    icon: "✓",
    label: "SEND",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    text: "text-emerald-400",
  },
  "HOLD": {
    icon: "⏸",
    label: "HOLD",
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
  },
  "REWRITE": {
    icon: "✏",
    label: "REWRITE",
    bg: "bg-sky-500/10 border-sky-500/30",
    text: "text-sky-400",
  },
  // legacy compat
  "WAIT": {
    icon: "⏸",
    label: "HOLD",
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-400",
  },
  "DO NOT SEND": {
    icon: "✕",
    label: "DO NOT SEND",
    bg: "bg-rose-500/10 border-rose-500/30",
    text: "text-rose-400",
  },
};

// Format milliseconds remaining as "Xh Ym"
function formatTimeRemaining(until: Date | null): string {
  if (!until) return "";
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function FilterPage() {
  const { isAuthenticated } = useAuth();
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [attachmentStyle, setAttachmentStyle] = useState("");
  const [result, setResult] = useState<VerdictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [spiralLocked, setSpiralLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState("");

  // Check spiral lock status on mount
  const lockQuery = trpc.spiral.checkLock.useQuery({ sessionKey: "anon" }, {
    refetchInterval: spiralLocked ? 30000 : false,
  });

  useEffect(() => {
    if (lockQuery.data?.locked && lockQuery.data.lockedUntil) {
      const until = new Date(lockQuery.data.lockedUntil);
      if (until > new Date()) {
        setSpiralLocked(true);
        setLockedUntil(until);
      } else {
        setSpiralLocked(false);
        setLockedUntil(null);
      }
    } else {
      setSpiralLocked(false);
    }
  }, [lockQuery.data]);

  // Countdown timer
  useEffect(() => {
    if (!spiralLocked || !lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = formatTimeRemaining(lockedUntil);
      setTimeRemaining(remaining);
      if (new Date(lockedUntil) <= new Date()) {
        setSpiralLocked(false);
        setLockedUntil(null);
        clearInterval(interval);
      }
    }, 10000);
    setTimeRemaining(formatTimeRemaining(lockedUntil));
    return () => clearInterval(interval);
  }, [spiralLocked, lockedUntil]);

  const analyzeMutation = trpc.filter.analyze.useMutation({
    onSuccess: (data) => {
      const typedData = data as VerdictResult;
      setResult(typedData);
      setLoading(false);

      // Handle spiral lock from response
      if (typedData.spiralLock?.locked && typedData.spiralLock.lockedUntil) {
        const until = new Date(typedData.spiralLock.lockedUntil);
        setSpiralLocked(true);
        setLockedUntil(until);
        setTimeRemaining(formatTimeRemaining(until));
      }
    },
    onError: () => {
      toast.error("Something went wrong. Try again.");
      setLoading(false);
    },
  });

  const handleAnalyze = () => {
    if (spiralLocked) {
      toast.error("You're in a Spiral Lock cooldown. Take a breath.");
      return;
    }
    if (!message.trim()) {
      toast.error("Paste your message first.");
      return;
    }
    setLoading(true);
    setResult(null);
    analyzeMutation.mutate({
      message: message.trim(),
      context: context.trim() || undefined,
      attachmentStyle: attachmentStyle || undefined,
    });
  };

  const handleReset = () => {
    setResult(null);
    setMessage("");
    setContext("");
  };

  const verdictConfig = result ? VERDICT_CONFIG[result.verdict] : null;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Filter</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Should you hold off?</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/contacts" className="icon-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </Link>
            <Link href="/chronicle" className="icon-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* ── Spiral Lock Banner ── */}
        {spiralLocked && (
          <div className="holdoff-card border-rose-500/40 bg-rose-500/10 mb-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🔒</div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-rose-400 text-base mb-1">Spiral Lock Active</h3>
                <p className="text-sm text-foreground/80 leading-relaxed mb-2">
                  You've gotten several HOLD verdicts in a row. HoldOff is locking the filter for <strong>{timeRemaining || "1 hour"}</strong> to protect you from yourself.
                </p>
                <p className="text-xs text-muted-foreground">
                  This is the pause you didn't ask for but needed. Step away. Breathe. Talk to a companion instead.
                </p>
                <Link href="/companions" className="inline-block mt-3 text-sm text-primary hover:underline">
                  Talk to a companion →
                </Link>
              </div>
            </div>
          </div>
        )}

        {!result ? (
          <div className="space-y-4">
            {/* Message input */}
            <div>
              <label className="input-label">What are you about to send?</label>
              <p className="text-xs text-muted-foreground mb-2">Paste it. Be honest. No one's watching.</p>
              <textarea
                className={`holdoff-textarea ${spiralLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                placeholder={spiralLocked ? "Spiral Lock is active. Take a breath." : "Type or paste the message here..."}
                value={message}
                onChange={(e) => !spiralLocked && setMessage(e.target.value)}
                rows={5}
                maxLength={3000}
                disabled={spiralLocked}
              />
              <div className="text-right text-xs text-muted-foreground mt-1">{message.length} / 3000</div>
            </div>

            {/* Context */}
            {!spiralLocked && (
              <div>
                <label className="input-label">What's going on? <span className="text-muted-foreground font-normal">(optional but helps)</span></label>
                <textarea
                  className="holdoff-textarea"
                  placeholder="Their last message, how long they've been quiet, what you're feeling..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>
            )}

            {/* Attachment style */}
            {!spiralLocked && (
              <div>
                <label className="input-label">Your attachment style <span className="text-muted-foreground font-normal">(optional)</span></label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {ATTACHMENT_STYLES.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setAttachmentStyle(attachmentStyle === style.value ? "" : style.value)}
                      className={`pill-btn ${attachmentStyle === style.value ? "pill-btn-active" : ""}`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
                {!isAuthenticated && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <a href={getLoginUrl()} className="text-primary hover:underline">Sign in</a> to save your attachment style and track your history.
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleAnalyze}
              disabled={loading || !message.trim() || spiralLocked}
              className={`holdoff-btn w-full ${spiralLocked ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
                  Analyzing...
                </span>
              ) : spiralLocked ? (
                `🔒 Locked for ${timeRemaining}`
              ) : (
                "Get my verdict"
              )}
            </button>

            {!isAuthenticated && !spiralLocked && (
              <p className="text-center text-xs text-muted-foreground">
                3 free verdicts. <a href={getLoginUrl()} className="text-primary hover:underline">Sign in</a> to save history.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Verdict */}
            <div className={`holdoff-card border ${verdictConfig?.bg} text-center`}>
              <div className={`text-5xl font-display font-bold mb-2 ${verdictConfig?.text}`}>
                {verdictConfig?.icon}
              </div>
              <div className={`text-2xl font-display font-bold tracking-wider mb-3 ${verdictConfig?.text}`}>
                {verdictConfig?.label || result.verdict}
              </div>
              {result.patternName && (
                <div className="inline-block bg-white/5 rounded-full px-3 py-1 text-xs text-muted-foreground mb-3">
                  {result.patternName}
                </div>
              )}
              <p className="text-sm leading-relaxed text-foreground">{result.explanation}</p>
            </div>

            {/* Spiral Lock warning after HOLD */}
            {(result.verdict === "HOLD" || result.verdict === "DO NOT SEND") && result.spiralLock && (
              <div className="holdoff-card border-rose-500/30 bg-rose-500/5">
                <p className="text-xs text-rose-400 font-medium uppercase tracking-wider mb-1">
                  🌀 Spiral Watch — {result.spiralLock.consecutiveCount}/5
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {result.spiralLock.consecutiveCount >= 3
                    ? "You've hit several HOLD verdicts. Spiral Lock is now active."
                    : `${Math.max(0, 5 - result.spiralLock.consecutiveCount)} more HOLD verdict${5 - result.spiralLock.consecutiveCount !== 1 ? "s" : ""} will trigger a Spiral Lock.`}
                </p>
              </div>
            )}

            {/* Reframe */}
            {result.reframe && (
              <div className="holdoff-card border-primary/20 bg-primary/5">
                <p className="text-xs text-primary font-medium uppercase tracking-wider mb-1">What you're actually feeling</p>
                <p className="text-sm leading-relaxed italic text-foreground/80">{result.reframe}</p>
              </div>
            )}

            {/* Rewrite */}
            {result.rewrite && (
              <div className="holdoff-card">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">A better version</p>
                <p className="text-sm leading-relaxed text-foreground">{result.rewrite}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result.rewrite!);
                    toast.success("Copied to clipboard");
                  }}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  Copy this version
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={handleReset} className="holdoff-btn-secondary flex-1">
                Try another
              </button>
              <Link href="/companions/sadie" className="holdoff-btn flex-1 text-center">
                Talk to Sadie ✨
              </Link>
            </div>

            {/* History link */}
            {isAuthenticated && (
              <Link href="/chronicle" className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                View your verdict history →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
