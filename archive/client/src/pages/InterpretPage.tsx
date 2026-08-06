import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

type InterpretResult = {
  detectedStyle: string;
  confidence: number | string;
  whatItMeans: string;
  howYouMightMisreadIt: string;
  attachmentStyleReasoning?: string;
  redFlags?: string | null;
  groundedResponse?: string | null;
  // legacy compat
  whatTheyNeed?: string;
  suggestedResponse?: string | null;
};

const STYLE_COLORS: Record<string, string> = {
  Secure: "text-emerald-400",
  Anxious: "text-amber-400",
  Avoidant: "text-sky-400",
  "Fearful-Avoidant": "text-rose-400",
  Unclear: "text-muted-foreground",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export default function InterpretPage() {
  const { isAuthenticated } = useAuth();
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<InterpretResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzeMutation = trpc.interpret.analyze.useMutation({
    onSuccess: (data) => {
      setResult(data as InterpretResult);
      setLoading(false);
    },
    onError: () => {
      toast.error("Something went wrong. Try again.");
      setLoading(false);
    },
  });

  const handleAnalyze = () => {
    if (!message.trim()) {
      toast.error("Paste the message you received first.");
      return;
    }
    setLoading(true);
    setResult(null);
    analyzeMutation.mutate({
      message: message.trim(),
      context: context.trim() || undefined,
    });
  };

  const handleReset = () => {
    setResult(null);
    setMessage("");
    setContext("");
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="font-display text-2xl font-bold">Interpret</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Decode what they actually mean</p>
      </div>

      <div className="page-body">
        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="input-label">Message you received</label>
              <p className="text-xs text-muted-foreground mb-2">Paste it exactly as they sent it.</p>
              <textarea
                className="holdoff-textarea"
                placeholder="Paste their message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={3000}
              />
              <div className="text-right text-xs text-muted-foreground mt-1">{message.length} / 3000</div>
            </div>

            <div>
              <label className="input-label">
                Context <span className="text-muted-foreground font-normal">(optional but helps)</span>
              </label>
              <textarea
                className="holdoff-textarea"
                placeholder="How long have you known them? What happened before this message?"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || !message.trim()}
              className="holdoff-btn w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
                  Reading between the lines...
                </span>
              ) : (
                "Decode this message"
              )}
            </button>

            {!isAuthenticated && (
              <p className="text-center text-xs text-muted-foreground">
                <a href={getLoginUrl()} className="text-primary hover:underline">Sign in</a> to save your interpretation history.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Detected style */}
            <div className="holdoff-card text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Detected attachment signal</p>
              <p className={`text-2xl font-display font-bold ${STYLE_COLORS[result.detectedStyle] || "text-foreground"}`}>
                {result.detectedStyle}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{typeof result.confidence === 'string' ? CONFIDENCE_LABELS[result.confidence] : result.confidence >= 0.7 ? 'High confidence' : result.confidence >= 0.4 ? 'Medium confidence' : 'Low confidence'}</p>
            </div>

            {/* What it means */}
            <div className="holdoff-card">
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">What it actually means</p>
              <p className="text-sm leading-relaxed text-foreground">{result.whatItMeans}</p>
            </div>

            {/* How you might misread it */}
            <div className="holdoff-card border-amber-500/20 bg-amber-500/5">
              <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">How you might misread it</p>
              <p className="text-sm leading-relaxed text-foreground/80">{result.howYouMightMisreadIt}</p>
            </div>

            {/* Attachment reasoning */}
            {result.attachmentStyleReasoning && (
              <div className="holdoff-card border-sky-500/20 bg-sky-500/5">
                <p className="text-xs text-sky-400 font-semibold uppercase tracking-wider mb-2">Why this style</p>
                <p className="text-sm leading-relaxed text-foreground/80">{result.attachmentStyleReasoning}</p>
              </div>
            )}
            {/* Red flags */}
            {result.redFlags && (
              <div className="holdoff-card border-rose-500/20 bg-rose-500/5">
                <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider mb-2">Red flags</p>
                <p className="text-sm leading-relaxed text-foreground/80">{result.redFlags}</p>
              </div>
            )}

            {/* Grounded response */}
            {(result.groundedResponse || result.suggestedResponse) && (
              <div className="holdoff-card">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">A grounded response</p>
                <p className="text-sm leading-relaxed text-foreground italic">"{result.groundedResponse || result.suggestedResponse}"</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText((result.groundedResponse || result.suggestedResponse)!);
                    toast.success("Copied to clipboard");
                  }}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  Copy this response
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleReset} className="holdoff-btn-secondary flex-1">
                Decode another
              </button>
              <a href="/companions/sadie" className="holdoff-btn flex-1 text-center">
                Talk to Sadie ✨
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
