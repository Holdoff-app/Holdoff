import { useEffect, useRef, useState } from "react";

export type AvatarExpression = "neutral" | "happy" | "thinking";
export type AvatarPersona = "sadie" | "stacy" | "danny" | "dan";

// All expression image URLs per persona
const AVATAR_IMAGES: Record<AvatarPersona, Record<AvatarExpression, string>> = {
  stacy: {
    neutral: "/manus-storage/stacy-avatar_601d0e66.png",
    happy: "/manus-storage/stacy-avatar_601d0e66.png",
    thinking: "/manus-storage/stacy-avatar_601d0e66.png",
  },
  danny: {
    neutral: "/manus-storage/danny-neutral_6187e252.png",
    happy: "/manus-storage/danny-happy_8192bed8.png",
    thinking: "/manus-storage/danny-thinking_789dee02.png",
  },
  dan: {
    neutral: "/manus-storage/dan-neutral_01595cb9.png",
    happy: "/manus-storage/dan-happy_599523c7.png",
    thinking: "/manus-storage/dan-thinking_77f4e9fc.png",
  },
  sadie: {
    neutral: "/manus-storage/sadie-neutral_81928032.png",
    happy: "/manus-storage/sadie-happy_f07eac98.png",
    thinking: "/manus-storage/sadie-thinking_7eff9727.png",
  },
};

// Base (original) avatar images for fallback / idle
const BASE_IMAGES: Record<AvatarPersona, string> = {
  stacy: "/manus-storage/stacy-avatar_601d0e66.png",
  danny: "/manus-storage/danny-avatar_74958fae.png",
  dan: "/manus-storage/dan-avatar_ce0d9d4d.png",
  sadie: "/manus-storage/sadie-avatar_b2e0f06d.png",
};

// Glow colors per persona
const PERSONA_GLOW: Record<AvatarPersona, string> = {
  stacy: "oklch(0.65 0.22 25 / 0.4)",
  danny: "oklch(0.7 0.18 75 / 0.4)",
  dan: "oklch(0.6 0.2 220 / 0.4)",
  sadie: "oklch(0.65 0.2 145 / 0.4)",
};

const PERSONA_RING: Record<AvatarPersona, string> = {
  stacy: "border-rose-500/40",
  danny: "border-amber-500/40",
  dan: "border-sky-500/40",
  sadie: "border-emerald-500/40",
};

interface AnimatedAvatarProps {
  persona: AvatarPersona;
  expression: AvatarExpression;
  isTyping?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSpeechBubble?: boolean;
  speechText?: string;
}

const SIZE_MAP = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
  xl: "w-48 h-48",
};

const FULL_BODY_PERSONAS: AvatarPersona[] = ["danny", "dan", "sadie"];

export default function AnimatedAvatar({
  persona,
  expression,
  isTyping = false,
  size = "lg",
  className = "",
  showSpeechBubble = false,
  speechText,
}: AnimatedAvatarProps) {
  const [displayExpression, setDisplayExpression] = useState<AvatarExpression>(expression);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [blinkState, setBlinkState] = useState(false);
  const prevExpressionRef = useRef(expression);

  // Smooth expression transition
  useEffect(() => {
    if (expression === prevExpressionRef.current) return;
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setDisplayExpression(expression);
      setIsTransitioning(false);
      prevExpressionRef.current = expression;
    }, 150);
    return () => clearTimeout(timer);
  }, [expression]);

  // Idle blink animation (every 3-5 seconds)
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 2000;
      return setTimeout(() => {
        setBlinkState(true);
        setTimeout(() => setBlinkState(false), 120);
        blinkTimerRef.current = scheduleBlink();
      }, delay);
    };
    const blinkTimerRef = { current: scheduleBlink() };
    return () => clearTimeout(blinkTimerRef.current);
  }, []);

  const imgSrc = AVATAR_IMAGES[persona]?.[displayExpression] ?? BASE_IMAGES[persona];
  const isFullBody = FULL_BODY_PERSONAS.includes(persona);
  const glowColor = PERSONA_GLOW[persona];
  const ringClass = PERSONA_RING[persona];

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Speech bubble */}
      {showSpeechBubble && speechText && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-10 max-w-[200px] animate-fade-up"
          style={{ bottom: "calc(100% + 8px)", top: "auto" }}
        >
          <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-foreground leading-relaxed shadow-lg">
            {speechText}
          </div>
          <div
            className="absolute bottom-0 left-6 translate-y-full w-0 h-0"
            style={{
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid var(--holdoff-border)",
            }}
          />
        </div>
      )}

      {/* Avatar container */}
      <div
        className={`
          relative overflow-hidden
          ${isFullBody ? "rounded-2xl" : "rounded-full"}
          border-2 ${ringClass}
          ${SIZE_MAP[size]}
          avatar-float
          ${isTyping ? "avatar-pulse" : ""}
        `}
        style={{
          boxShadow: `0 0 24px ${glowColor}, 0 8px 32px rgba(0,0,0,0.4)`,
          background: "var(--holdoff-surface)",
        }}
      >
        {/* Expression image */}
        <img
          src={imgSrc}
          alt={`${persona} ${displayExpression}`}
          className={`
            w-full h-full object-cover object-top
            transition-opacity duration-150
            ${isTransitioning ? "opacity-0" : "opacity-100"}
            ${blinkState ? "brightness-95" : ""}
          `}
          draggable={false}
        />

        {/* Typing indicator overlay */}
        {isTyping && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}

        {/* Shimmer effect on expression change */}
        {isTransitioning && (
          <div className="absolute inset-0 bg-white/10 animate-pulse" />
        )}
      </div>

      {/* Expression indicator dot */}
      <div className="mt-1.5 flex gap-1 justify-center">
        {(["neutral", "happy", "thinking"] as AvatarExpression[]).map((exp) => (
          <div
            key={exp}
            className={`w-1 h-1 rounded-full transition-all duration-300 ${
              displayExpression === exp
                ? "bg-primary scale-125"
                : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Utility: detect sentiment from AI response text
export function detectSentiment(text: string): AvatarExpression {
  const lower = text.toLowerCase();

  // Thinking/concerned keywords
  const thinkingWords = [
    "hmm", "i notice", "pattern", "let me think", "interesting", "curious",
    "concern", "worried", "careful", "wait", "hold on", "actually",
    "but", "however", "though", "question", "wonder", "consider",
    "attachment", "avoidant", "anxious", "spiral", "reactive",
  ];

  // Happy/warm keywords
  const happyWords = [
    "great", "amazing", "wonderful", "proud", "growth", "progress",
    "love", "beautiful", "celebrate", "yes!", "exactly", "perfect",
    "you've got this", "well done", "good", "strong", "healthy",
    "secure", "grounded", "calm", "peace", "better", "healing",
  ];

  const thinkingScore = thinkingWords.filter(w => lower.includes(w)).length;
  const happyScore = happyWords.filter(w => lower.includes(w)).length;

  if (thinkingScore > happyScore && thinkingScore > 0) return "thinking";
  if (happyScore > 0) return "happy";
  return "neutral";
}
