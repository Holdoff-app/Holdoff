import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Start your pause practice",
    features: [
      "3 AI verdicts per day",
      "Message Interpreter (3/day)",
      "Attachment Style Quiz",
      "Community Feed (read)",
      "Basic companion chat",
    ],
    cta: "Get started free",
    ctaStyle: "holdoff-btn-secondary",
    highlight: false,
  },
  {
    id: "weekly",
    name: "Weekly",
    price: "$3.99",
    period: "per week",
    tagline: "For when you're in it",
    features: [
      "Unlimited AI verdicts",
      "Unlimited Interpreter",
      "Full companion chat (Sadie, Stacy, Danny)",
      "Private Journal",
      "Community posting",
      "Verdict history",
    ],
    cta: "Start weekly",
    ctaStyle: "holdoff-btn-secondary",
    highlight: false,
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "$9.99",
    period: "per month",
    tagline: "Most popular",
    features: [
      "Everything in Weekly",
      "Contacts + AI relationship analysis",
      "Chronicle & Insights",
      "Spiral Lock protection",
      "Pattern recognition tips",
      "Priority support",
    ],
    cta: "Start monthly",
    ctaStyle: "holdoff-btn",
    highlight: true,
    badge: "Most Popular",
  },
  {
    id: "annual",
    name: "Annual",
    price: "$59.99",
    period: "per year",
    tagline: "Save 50% vs monthly",
    features: [
      "Everything in Monthly",
      "Early access to new features",
      "Extended history (1 year)",
      "Export your data",
    ],
    cta: "Start annual",
    ctaStyle: "holdoff-btn-secondary",
    highlight: false,
    badge: "Save 50%",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: "$149",
    period: "one time",
    tagline: "Own it forever",
    features: [
      "Everything, forever",
      "All future features included",
      "Founding member status",
      "Direct founder access",
    ],
    cta: "Get lifetime access",
    ctaStyle: "holdoff-btn-secondary",
    highlight: false,
    badge: "Best Value",
  },
];

export default function PricingPage() {
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
            <h1 className="font-display text-2xl font-bold">Pricing</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Choose your pause practice</p>
          </div>
        </div>
      </div>

      <div className="page-body space-y-4">
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">
            Every plan includes the core HoldOff experience. Upgrade when you're ready.
          </p>
        </div>

        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`holdoff-card relative ${plan.highlight ? "border-primary/50 bg-primary/5" : ""}`}
          >
            {plan.badge && (
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${
                plan.highlight
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/10 text-foreground"
              }`}>
                {plan.badge}
              </div>
            )}

            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">{plan.name}</h2>
                <p className="text-xs text-muted-foreground">{plan.tagline}</p>
              </div>
              <div className="text-right">
                <p className={`font-display text-2xl font-bold ${plan.highlight ? "text-primary" : "text-foreground"}`}>
                  {plan.price}
                </p>
                <p className="text-xs text-muted-foreground">{plan.period}</p>
              </div>
            </div>

            <ul className="space-y-1.5 mb-4">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                if (!isAuthenticated) {
                  window.location.href = getLoginUrl();
                } else {
                  // Pricing/payment integration placeholder
                  window.location.href = getLoginUrl();
                }
              }}
              className={`${plan.ctaStyle} w-full`}
            >
              {plan.cta}
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
        </div>
      </div>
    </div>
  );
}
