import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { toast } from "sonner";

type StyleKey = "secure" | "anxious" | "avoidant" | "fearful";

type QuizQuestion = {
  id: number;
  question: string;
  options: {
    text: string;
    scores: Partial<Record<StyleKey, number>>;
  }[];
};

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "When someone you're dating doesn't text back for a few hours, you usually...",
    options: [
      { text: "Assume they're busy and move on with my day", scores: { secure: 3 } },
      { text: "Check my phone repeatedly and wonder if I said something wrong", scores: { anxious: 3 } },
      { text: "Feel relieved — I needed space too", scores: { avoidant: 3 } },
      { text: "Panic, then tell myself I don't care, then panic again", scores: { fearful: 3 } },
    ],
  },
  {
    id: 2,
    question: "When a relationship starts getting really close and intimate, you tend to...",
    options: [
      { text: "Feel comfortable and lean in", scores: { secure: 3 } },
      { text: "Want even more closeness and worry they don't feel the same", scores: { anxious: 3 } },
      { text: "Feel a little suffocated and need to pull back", scores: { avoidant: 3 } },
      { text: "Feel excited but also terrified — and sometimes sabotage it", scores: { fearful: 3 } },
    ],
  },
  {
    id: 3,
    question: "After a fight with someone you care about, you typically...",
    options: [
      { text: "Talk it through calmly and feel closer after", scores: { secure: 3 } },
      { text: "Need reassurance that they're not leaving, even if the fight was small", scores: { anxious: 3 } },
      { text: "Need time alone to process before I can reconnect", scores: { avoidant: 3 } },
      { text: "Alternate between wanting to fix it and wanting to end everything", scores: { fearful: 3 } },
    ],
  },
  {
    id: 4,
    question: "How do you feel about depending on a partner emotionally?",
    options: [
      { text: "Natural — I'm comfortable needing and being needed", scores: { secure: 3 } },
      { text: "I want it badly but it terrifies me they'll leave", scores: { anxious: 3 } },
      { text: "Uncomfortable — I prefer handling things myself", scores: { avoidant: 3 } },
      { text: "I want it but I don't trust it — I've been hurt before", scores: { fearful: 3 } },
    ],
  },
  {
    id: 5,
    question: "When you're really into someone, your biggest fear is...",
    options: [
      { text: "That it won't work out, but I trust we can handle it", scores: { secure: 3 } },
      { text: "That they'll leave or lose interest in me", scores: { anxious: 3 } },
      { text: "That I'll lose my independence or sense of self", scores: { avoidant: 3 } },
      { text: "That I'll push them away or they'll hurt me — or both", scores: { fearful: 3 } },
    ],
  },
];

const STYLE_RESULTS: Record<StyleKey, {
  label: string;
  emoji: string;
  tagline: string;
  description: string;
  companion: string;
  companionPath: string;
  color: string;
}> = {
  secure: {
    label: "Secure",
    emoji: "🌿",
    tagline: "Grounded in connection",
    description: "You're comfortable with both closeness and independence. You communicate your needs directly, trust your relationships, and can handle conflict without catastrophizing. This is the gold standard — and you've done the work to get here.",
    companion: "Sadie ✨",
    companionPath: "/companions/sadie",
    color: "text-emerald-400",
  },
  anxious: {
    label: "Anxious",
    emoji: "🌊",
    tagline: "Craving closeness, fearing loss",
    description: "You crave deep connection but fear abandonment. You're highly attuned to emotional shifts and may over-communicate or seek reassurance when stressed. Your sensitivity is a gift — it just needs grounding.",
    companion: "Sadie ✨",
    companionPath: "/companions/sadie",
    color: "text-amber-400",
  },
  avoidant: {
    label: "Dismissive-Avoidant",
    emoji: "🌙",
    tagline: "Independent by design",
    description: "You value self-sufficiency and may pull away when relationships get too close. Emotional distance feels safer than vulnerability. You're not cold — you're self-protective. Understanding this is the first step.",
    companion: "Danny",
    companionPath: "/companions/danny",
    color: "text-sky-400",
  },
  fearful: {
    label: "Fearful-Avoidant",
    emoji: "🌀",
    tagline: "Wanting love, fearing it too",
    description: "You want closeness but also fear it deeply. You may push people away and then miss them — the push-pull is exhausting and real. You've likely been hurt before. Healing is possible, and it starts with understanding the pattern.",
    companion: "Stacy",
    companionPath: "/companions/stacy",
    color: "text-rose-400",
  },
};

export default function QuizPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<StyleKey | null>(null);
  const [scores, setScores] = useState<Record<StyleKey, number>>({ secure: 0, anxious: 0, avoidant: 0, fearful: 0 });

  const saveMutation = trpc.quiz.save.useMutation({
    onSuccess: () => toast.success("Attachment style saved to your profile."),
    onError: () => {},
  });

  const handleAnswer = (optionIndex: number) => {
    const question = QUESTIONS[currentQ];
    const option = question.options[optionIndex];
    const newScores = { ...scores };
    for (const [style, score] of Object.entries(option.scores)) {
      newScores[style as StyleKey] = (newScores[style as StyleKey] || 0) + (score || 0);
    }
    setScores(newScores);
    setAnswers([...answers, optionIndex]);

    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // Calculate result
      const primary = Object.entries(newScores).sort((a, b) => b[1] - a[1])[0][0] as StyleKey;
      setResult(primary);

      if (isAuthenticated) {
        saveMutation.mutate({
          primaryStyle: primary,
          scores: newScores,
          answers: [...answers, optionIndex],
        });
      }
    }
  };

  const handleReset = () => {
    setCurrentQ(0);
    setAnswers([]);
    setResult(null);
    setScores({ secure: 0, anxious: 0, avoidant: 0, fearful: 0 });
  };

  const progress = ((currentQ) / QUESTIONS.length) * 100;

  if (result) {
    const styleInfo = STYLE_RESULTS[result];
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="font-display text-2xl font-bold">Your result</h1>
        </div>
        <div className="page-body space-y-4 animate-fade-in">
          <div className="holdoff-card text-center">
            <div className="text-5xl mb-3">{styleInfo.emoji}</div>
            <p className={`font-display text-2xl font-bold ${styleInfo.color}`}>{styleInfo.label}</p>
            <p className="text-sm text-muted-foreground mt-1 italic">{styleInfo.tagline}</p>
          </div>

          <div className="holdoff-card">
            <p className="text-sm leading-relaxed text-foreground">{styleInfo.description}</p>
          </div>

          {/* Score breakdown */}
          <div className="holdoff-card">
            <p className="section-label">Score breakdown</p>
            <div className="space-y-2 mt-3">
              {Object.entries(scores).map(([style, score]) => {
                const info = STYLE_RESULTS[style as StyleKey];
                const pct = Math.round((score / (QUESTIONS.length * 3)) * 100);
                return (
                  <div key={style}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-medium ${info.color}`}>{info.label}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: `currentColor` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="holdoff-card">
            <p className="text-sm text-muted-foreground mb-3">
              Talk to <span className="text-foreground font-medium">{styleInfo.companion}</span> — they understand your pattern from the inside.
            </p>
            <a href={styleInfo.companionPath} className="holdoff-btn w-full text-center block">
              Talk to {styleInfo.companion}
            </a>
          </div>

          {!isAuthenticated && (
            <div className="holdoff-card text-center">
              <p className="text-sm text-muted-foreground mb-3">Sign in to save your result to your profile.</p>
              <a href={getLoginUrl()} className="holdoff-btn-secondary inline-flex">
                Sign in to save
              </a>
            </div>
          )}

          <button onClick={handleReset} className="holdoff-btn-secondary w-full">
            Retake the quiz
          </button>
        </div>
      </div>
    );
  }

  const question = QUESTIONS[currentQ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-2xl font-bold">Attachment Quiz</h1>
          <span className="text-sm text-muted-foreground">{currentQ + 1} / {QUESTIONS.length}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="page-body">
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-bold leading-snug mb-6 text-foreground">
            {question.question}
          </h2>

          <div className="space-y-3">
            {question.options.map((option, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className="w-full text-left holdoff-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-150 active:scale-[0.99] cursor-pointer"
              >
                <p className="text-sm leading-relaxed text-foreground">{option.text}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
