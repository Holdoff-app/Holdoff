import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { toast } from "sonner";

const STYLE_INFO: Record<string, { emoji: string; label: string; description: string; color: string }> = {
  secure: {
    emoji: "🌿",
    label: "Secure",
    description: "You're comfortable with closeness and independence. You communicate needs directly and trust your relationships.",
    color: "text-emerald-400",
  },
  anxious: {
    emoji: "🌊",
    label: "Anxious",
    description: "You crave closeness but fear abandonment. You're sensitive to emotional shifts and may over-communicate when stressed.",
    color: "text-amber-400",
  },
  avoidant: {
    emoji: "🌙",
    label: "Avoidant",
    description: "You value independence and may pull away when things get too close. Emotional distance feels safer.",
    color: "text-sky-400",
  },
  fearful: {
    emoji: "🌀",
    label: "Fearful-Avoidant",
    description: "You want closeness but also fear it. You may push people away and then miss them — the push-pull is real.",
    color: "text-rose-400",
  },
};

export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth();

  const { data: stats } = trpc.filter.stats.useQuery(undefined, { enabled: isAuthenticated });
  const { data: quizResult } = trpc.quiz.get.useQuery(undefined, { enabled: isAuthenticated });

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out.");
  };

  if (!isAuthenticated) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="font-display text-2xl font-bold">Profile</h1>
        </div>
        <div className="page-body flex flex-col items-center justify-center text-center gap-4 py-16">
          <div className="text-5xl">👤</div>
          <h2 className="font-display text-xl font-bold">Sign in to see your profile</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Track your verdicts, save your attachment style, and see your growth over time.
          </p>
          <a href={getLoginUrl()} className="holdoff-btn">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const attachmentStyle = quizResult?.primaryStyle || user?.attachmentStyle;
  const styleInfo = attachmentStyle ? STYLE_INFO[attachmentStyle] : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Profile</h1>
          <Link href="/chronicle" className="icon-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </Link>
        </div>
      </div>

      <div className="page-body space-y-4">
        {/* User info */}
        <div className="holdoff-card flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-display font-bold text-primary flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-semibold text-foreground">{user?.name || "Anonymous"}</p>
            <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
          </div>
        </div>

        {/* Attachment style */}
        {styleInfo ? (
          <div className="holdoff-card">
            <p className="section-label">Your attachment style</p>
            <div className="flex items-start gap-3 mt-2">
              <span className="text-3xl">{styleInfo.emoji}</span>
              <div>
                <p className={`font-display text-lg font-bold ${styleInfo.color}`}>{styleInfo.label}</p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">{styleInfo.description}</p>
              </div>
            </div>
            <Link href="/quiz" className="mt-3 block text-xs text-primary hover:underline">
              Retake the quiz →
            </Link>
          </div>
        ) : (
          <div className="holdoff-card text-center">
            <p className="text-sm text-muted-foreground mb-3">Discover your attachment style</p>
            <Link href="/quiz" className="holdoff-btn inline-flex">
              Take the quiz
            </Link>
          </div>
        )}

        {/* Verdict stats */}
        {stats && (
          <div className="holdoff-card">
            <p className="section-label">Your verdict history</p>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-emerald-400">{stats.send}</p>
                <p className="text-xs text-muted-foreground mt-0.5">SEND</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-amber-400">{stats.wait}</p>
                <p className="text-xs text-muted-foreground mt-0.5">WAIT</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-rose-400">{stats.noSend}</p>
                <p className="text-xs text-muted-foreground mt-0.5">DO NOT SEND</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-holdoff-border text-center">
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground font-semibold">{stats.total}</span> total pauses taken
              </p>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="holdoff-card">
          <p className="section-label">Quick links</p>
          <div className="space-y-1 mt-2">
            {[
              { href: "/chronicle", label: "Chronicle & Insights", icon: "📊" },
              { href: "/contacts", label: "Contacts", icon: "👥" },
              { href: "/pricing", label: "Upgrade plan", icon: "⭐" },
              { href: "/story", label: "Founder story", icon: "📖" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span className="text-lg">{link.icon}</span>
                <span className="text-sm text-foreground">{link.label}</span>
                <span className="ml-auto text-muted-foreground text-xs">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="holdoff-btn-secondary w-full text-rose-400 border-rose-500/20"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
