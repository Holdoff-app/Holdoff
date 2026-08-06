import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Analysis = {
  redFlags: string[];
  yellowFlags: string[];
  greenFlags: string[];
  compatibilityScore: number;
  attachmentStyleFit: string;
  communicationStyleMatch: number;
  riskLevel: "Low" | "Medium" | "High";
  trustLevel: "Growing" | "Stable" | "Declining";
  compatibilitySummary: string;
};

const RISK_COLORS = {
  Low: "text-emerald-400",
  Medium: "text-amber-400",
  High: "text-rose-400",
};

const TRUST_COLORS = {
  Growing: "text-emerald-400",
  Stable: "text-sky-400",
  Declining: "text-rose-400",
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%`, background: "currentColor" }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const contactId = parseInt(params.id || "0");
  const [description, setDescription] = useState("");
  const [showAnalyzeForm, setShowAnalyzeForm] = useState(false);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.contacts.get.useQuery(
    { id: contactId },
    { enabled: !!contactId }
  );

  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("Contact removed.");
      window.history.back();
    },
    onError: () => toast.error("Couldn't delete."),
  });

  const analyzeMutation = trpc.contacts.analyze.useMutation({
    onSuccess: () => {
      toast.success("Analysis complete.");
      setDescription("");
      setShowAnalyzeForm(false);
      utils.contacts.get.invalidate({ id: contactId });
    },
    onError: () => toast.error("Analysis failed. Try again."),
  });

  const handleAnalyze = () => {
    if (!description.trim() || description.trim().length < 10) {
      toast.error("Describe the relationship in at least 10 characters.");
      return;
    }
    analyzeMutation.mutate({ contactId, description: description.trim() });
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-body flex items-center justify-center py-16">
          <span className="animate-spin w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container">
        <div className="page-body text-center py-16">
          <p className="text-muted-foreground">Contact not found.</p>
          <Link href="/contacts" className="holdoff-btn mt-4 inline-flex">Back to contacts</Link>
        </div>
      </div>
    );
  }

  const { contact, insights } = data;
  const analysis = insights as Analysis | null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/contacts" className="icon-btn flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
            {contact.displayName[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">{contact.displayName}</h1>
            {contact.relationship && (
              <p className="text-xs text-muted-foreground">{contact.relationship}</p>
            )}
          </div>
        </div>
      </div>

      <div className="page-body space-y-4">
        {/* Contact info */}
        <div className="holdoff-card">
          <p className="section-label">Details</p>
          <div className="space-y-2 mt-2">
            {contact.relationship && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Relationship</span>
                <span className="text-foreground">{contact.relationship}</span>
              </div>
            )}
            {contact.durationDays && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Known for</span>
                <span className="text-foreground">{contact.durationDays} days</span>
              </div>
            )}
            {contact.attachmentStyle && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Their attachment style</span>
                <span className="text-foreground capitalize">{contact.attachmentStyle}</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        {analysis ? (
          <div className="space-y-3 animate-fade-in">
            {/* Scores */}
            <div className="holdoff-card">
              <p className="section-label">Compatibility</p>
              <div className="space-y-3 mt-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Overall compatibility</span>
                  </div>
                  <ScoreBar value={analysis.compatibilityScore} color="text-primary" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Communication match</span>
                  </div>
                  <ScoreBar value={analysis.communicationStyleMatch} color="text-sky-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Risk level</p>
                  <p className={`text-sm font-semibold ${RISK_COLORS[analysis.riskLevel]}`}>{analysis.riskLevel}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Trust</p>
                  <p className={`text-sm font-semibold ${TRUST_COLORS[analysis.trustLevel]}`}>{analysis.trustLevel}</p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="holdoff-card">
              <p className="section-label">Summary</p>
              <p className="text-sm leading-relaxed text-foreground mt-2">{analysis.compatibilitySummary}</p>
            </div>

            {/* Flags */}
            {analysis.greenFlags?.length > 0 && (
              <div className="holdoff-card border-emerald-500/20">
                <p className="section-label text-emerald-400">🟢 Green flags</p>
                <ul className="space-y-1.5 mt-2">
                  {analysis.greenFlags.map((flag, i) => (
                    <li key={i} className="text-sm text-foreground/90 flex gap-2">
                      <span className="text-emerald-400 flex-shrink-0">✓</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.yellowFlags?.length > 0 && (
              <div className="holdoff-card border-amber-500/20">
                <p className="section-label text-amber-400">🟡 Yellow flags</p>
                <ul className="space-y-1.5 mt-2">
                  {analysis.yellowFlags.map((flag, i) => (
                    <li key={i} className="text-sm text-foreground/90 flex gap-2">
                      <span className="text-amber-400 flex-shrink-0">!</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.redFlags?.length > 0 && (
              <div className="holdoff-card border-rose-500/20">
                <p className="section-label text-rose-400">🔴 Red flags</p>
                <ul className="space-y-1.5 mt-2">
                  {analysis.redFlags.map((flag, i) => (
                    <li key={i} className="text-sm text-foreground/90 flex gap-2">
                      <span className="text-rose-400 flex-shrink-0">✕</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setShowAnalyzeForm(true)}
              className="holdoff-btn-secondary w-full text-sm"
            >
              Re-analyze relationship
            </button>
          </div>
        ) : (
          <div className="holdoff-card text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-foreground mb-1">AI Relationship Analysis</p>
            <p className="text-sm text-muted-foreground mb-4">
              Describe your dynamic and get red, yellow, and green flags with a compatibility score.
            </p>
            <button
              onClick={() => setShowAnalyzeForm(true)}
              className="holdoff-btn inline-flex"
            >
              Analyze this relationship
            </button>
          </div>
        )}

        {/* Analyze form */}
        {showAnalyzeForm && (
          <div className="holdoff-card animate-fade-in">
            <label className="input-label">Describe the relationship</label>
            <p className="text-xs text-muted-foreground mb-2">
              Communication patterns, how they make you feel, what's working, what isn't.
            </p>
            <textarea
              className="holdoff-textarea mb-3"
              placeholder="We've been talking for 3 months. They're hot and cold — sometimes really present, then they disappear for days..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={2000}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAnalyzeForm(false)}
                className="holdoff-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending || description.trim().length < 10}
                className="holdoff-btn flex-1"
              >
                {analyzeMutation.isPending ? "Analyzing..." : "Analyze"}
              </button>
            </div>
          </div>
        )}

        {/* Delete */}
        <button
          onClick={() => {
            if (confirm(`Remove ${contact.displayName}?`)) {
              deleteMutation.mutate({ id: contact.id });
            }
          }}
          className="holdoff-btn-ghost w-full text-rose-400 text-sm"
        >
          Remove contact
        </button>
      </div>
    </div>
  );
}
