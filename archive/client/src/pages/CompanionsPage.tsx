import { Link } from "wouter";
import AnimatedAvatar, { type AvatarPersona } from "@/components/AnimatedAvatar";

const COMPANIONS: {
  id: string;
  name: string;
  tagline: string;
  description: string;
  style: string;
  gradient: string;
  border: string;
  accent: string;
  avatarPersona: AvatarPersona;
  route: string;
}[] = [
  {
    id: "sadie",
    name: "Sadie",
    tagline: "Warm. Grounded. Gently challenging.",
    description: "Sadie is the friend who's done her own work. She holds space without enabling your spiral. Secure-leaning and deeply wise.",
    style: "Secure-leaning",
    gradient: "from-emerald-500/15 to-teal-500/10",
    border: "border-emerald-500/30",
    accent: "text-emerald-300",
    avatarPersona: "sadie",
    route: "/companions/sadie",
  },
  {
    id: "stacy",
    name: "Stacy",
    tagline: "Raw honesty. Dark humor. She gets it.",
    description: "Stacy has been both the one who over-texts and the one who disappears. She doesn't sugarcoat. Fearful-avoidant and figuring it out.",
    style: "Fearful-Avoidant",
    gradient: "from-rose-500/15 to-orange-500/10",
    border: "border-rose-500/30",
    accent: "text-rose-300",
    avatarPersona: "stacy",
    route: "/companions/stacy",
  },
  {
    id: "danny",
    name: "Danny",
    tagline: "Calm. Logical. The avoidant decoder.",
    description: "Danny helps you understand what avoidants are actually feeling — hint: it's not nothing. Dismissive-avoidant and surprisingly insightful.",
    style: "Dismissive-Avoidant",
    gradient: "from-amber-500/15 to-yellow-500/10",
    border: "border-amber-500/30",
    accent: "text-amber-300",
    avatarPersona: "danny",
    route: "/companions/danny",
  },
  {
    id: "dan",
    name: "Dan",
    tagline: "Grounded. Direct. The resilience coach.",
    description: "Dan has worked through his own anxious attachment and helps you find the middle ground between chasing and shutting down. Secure-anxious bridge.",
    style: "Secure-Anxious Bridge",
    gradient: "from-sky-500/15 to-blue-500/10",
    border: "border-sky-500/30",
    accent: "text-sky-300",
    avatarPersona: "dan",
    route: "/companions/dan",
  },
];

export default function CompanionsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="font-display text-2xl font-bold">Companions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Choose who you need right now</p>
      </div>

      <div className="page-body space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Four AI companions, each with a different attachment lens. They're not therapists — they're the friends who've been there.
        </p>

        {COMPANIONS.map((companion) => (
          <Link key={companion.id} href={companion.route}>
            <div
              className={`holdoff-card bg-gradient-to-br ${companion.gradient} border ${companion.border} cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all duration-150`}
            >
              <div className="flex gap-4 items-center">
                {/* Animated avatar */}
                <div className="flex-shrink-0">
                  <AnimatedAvatar
                    persona={companion.avatarPersona}
                    expression="neutral"
                    size="md"
                  />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-display text-lg font-bold ${companion.accent}`}>
                      {companion.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${companion.accent} opacity-70`}>
                      {companion.style}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground/80 mb-1">{companion.tagline}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{companion.description}</p>
                </div>

                {/* Arrow */}
                <svg className="flex-shrink-0 text-muted-foreground/40" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </Link>
        ))}

        <div className="holdoff-card border-primary/20 bg-primary/5 text-center mt-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Not sure who to talk to? Start with <span className="text-emerald-300 font-medium">Sadie</span> — she's the most grounded. Come to <span className="text-rose-300 font-medium">Stacy</span> when you need someone who gets the chaos. Go to <span className="text-amber-300 font-medium">Danny</span> when you're trying to decode someone else.
          </p>
        </div>
      </div>
    </div>
  );
}
