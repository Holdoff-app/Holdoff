import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function PricingPage() {
  const { isAuthenticated, user } = useAuth();
  const { data: plans, isLoading } = trpc.pricing.plans.useQuery();
  const checkout = trpc.pricing.getCheckoutUrl.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast.error("Couldn't open checkout. Please try again.");
    },
  });

  const handleSelect = (tier: string) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    checkout.mutate({ tier, email: user?.email || undefined });
  };

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
            <h1 className="font-display text-2xl font-bold">Pricing</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Choose your pause practice</p>
          </div>
        </div>
      </div>

      <div className="page-body space-y-4">
        {/* Free tier — always shown */}
        <div className="holdoff-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Free</h2>
              <p className="text-xs text-muted-foreground">Start your pause practice</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-foreground">$0</p>
              <p className="text-xs text-muted-foreground">forever</p>
            </div>
          </div>
          <ul className="space-y-1.5 mb-4">
            {["3 AI verdicts per day", "Message Interpreter (3/day)", "Attachment Style Quiz", "Community Feed (read)", "Basic companion chat"].map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <a href={isAuthenticated ? "/filter" : getLoginUrl()} className="holdoff-btn-secondary w-full text-center block">
            {isAuthenticated ? "Go to the app" : "Get started free"}
          </a>
        </div>

        {isLoading && (
          <div className="text-center py-6 text-sm text-muted-foreground">Loading plans…</div>
        )}

        {plans?.map((plan) => (
          <div
            key={plan.id}
            className={`holdoff-card relative ${plan.highlight ? "border-primary/50 bg-primary/5" : ""}`}
          >
            {plan.badge && (
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                plan.highlight ? "bg-primary text-primary-foreground" : "bg-white/10 text-foreground"
              }`}>
                {plan.badge}
              </div>
            )}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">{plan.label}</h2>
                <p className="text-xs text-muted-foreground capitalize">{plan.interval === "once" ? "one-time" : plan.interval}</p>
              </div>
              <div className="text-right">
                <p className={`font-display text-2xl font-bold ${plan.highlight ? "text-primary" : "text-foreground"}`}>
                  {plan.priceDisplay}
                </p>
              </div>
            </div>
            {plan.description && (
              <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>
            )}
            <ul className="space-y-1.5 mb-4">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSelect(plan.id)}
              disabled={checkout.isPending}
              className={`${plan.highlight ? "holdoff-btn" : "holdoff-btn-secondary"} w-full`}
            >
              {checkout.isPending ? "Opening checkout…" : isAuthenticated ? `Choose ${plan.label}` : "Sign in to subscribe"}
            </button>
          </div>
        ))}

        <div className="holdoff-card text-center">
          <p className="text-xs text-muted-foreground">
            Questions? Reach out at{" "}
            <a href="mailto:hello@holdoff.app" className="text-primary hover:underline">
              hello@holdoff.app
            </a>
          </p>
          <p className="text-xs text-muted-foreground mt-2 opacity-60">
            Payments are securely processed by Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
