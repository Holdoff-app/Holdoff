import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

const TIP_ICON_COLORS: Record<string, string> = {
  onboarding: "bg-primary/20 text-primary",
  pattern: "bg-rose-500/20 text-rose-400",
  growth: "bg-emerald-500/20 text-emerald-400",
  companion: "bg-purple-500/20 text-purple-300",
};

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="holdoff-card text-center flex-1">
      <p className={`text-3xl font-display font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
    </div>
  );
}

export default function ChroniclePage() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = trpc.chronicle.tips.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: history = [] } = trpc.filter.history.useQuery(
    { limit: 20 },
    { enabled: isAuthenticated }
  );

  if (!isAuthenticated) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="font-display text-2xl font-bold">Chronicle</h1>
        </div>
        <div className="page-body flex flex-col items-center justify-center text-center gap-4 py-16">
          <div className="text-5xl">📊</div>
          <h2 className="font-display text-xl font-bold">Your growth story</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Sign in to see your verdict history, patterns, and personalized insights.
          </p>
          <a href={getLoginUrl()} className="holdoff-btn">
            Sign in to see insights
          </a>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const tips = data?.tips || [];

  const VERDICT_LABELS: Record<string, { label: string; color: string }> = {
    SEND: { label: "SEND", color: "text-emerald-400" },
    WAIT: { label: "WAIT", color: "text-amber-400" },
    "DO NOT SEND": { label: "DO NOT SEND", color: "text-rose-400" },
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Chronicle</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your pause history & insights</p>
          </div>
          <Link href="/profile" className="icon-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </div>

      <div className="page-body">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="animate-spin w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full" />
          </div>
        ) : (
          <div className="space-y-4 stagger-children">
            {/* Stats */}
            {stats && (
              <div>
                <p className="section-label mb-2">Your verdicts</p>
                <div className="flex gap-2">
                  <StatCard value={stats.send} label="SEND" color="text-emerald-400" />
                  <StatCard value={stats.wait} label="WAIT" color="text-amber-400" />
                  <StatCard value={stats.noSend} label="DO NOT SEND" color="text-rose-400" />
                </div>
                <div className="holdoff-card mt-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    <span className="text-foreground font-bold text-lg">{stats.total}</span> total pauses taken
                  </p>
                  {stats.total > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.total > 0 && stats.noSend > 0
                        ? `You've held back ${stats.noSend} message${stats.noSend !== 1 ? "s" : ""} that could have hurt you.`
                        : "Every pause is a win."}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tips */}
            {tips.length > 0 && (
              <div>
                <p className="section-label mb-2">Insights for you</p>
                <div className="space-y-3">
                  {tips.map((tip: any, i: number) => (
                    <div key={i} className="holdoff-card">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${TIP_ICON_COLORS[tip.type] || "bg-primary/20 text-primary"}`}>
                          {tip.icon}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-foreground">{tip.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tip.message}</p>
                          {tip.actionPath && (
                            <Link href={tip.actionPath} className="text-xs text-primary hover:underline mt-2 block">
                              {tip.action} →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent history */}
            {history.length > 0 && (
              <div>
                <p className="section-label mb-2">Recent verdicts</p>
                <div className="space-y-2">
                  {history.slice(0, 10).map((verdict) => {
                    const config = VERDICT_LABELS[verdict.verdict as string] || { label: verdict.verdict as string, color: "text-foreground" };
                    return (
                      <div key={verdict.id} className="holdoff-card">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(verdict.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 line-clamp-2">{verdict.message}</p>
                        {verdict.patternName && (
                          <p className="text-xs text-muted-foreground mt-1">Pattern: {verdict.patternName}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {(!stats || stats.total === 0) && tips.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <div className="text-4xl">📊</div>
                <p className="text-muted-foreground text-sm">No data yet.</p>
                <Link href="/filter" className="holdoff-btn inline-flex text-sm">
                  Take your first pause
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
