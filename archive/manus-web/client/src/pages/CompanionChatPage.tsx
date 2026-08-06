import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AnimatedAvatar, { detectSentiment, type AvatarExpression, type AvatarPersona } from "@/components/AnimatedAvatar";

const COMPANION_META: Record<string, {
  name: string;
  tagline: string;
  accent: string;
  border: string;
  bgGradient: string;
  prompts: string[];
  avatarPersona: AvatarPersona;
  introMessage: string;
}> = {
  sadie: {
    name: "Sadie",
    tagline: "Warm. Grounded. Gently challenging.",
    accent: "text-emerald-300",
    border: "border-emerald-500/30",
    bgGradient: "from-emerald-500/5 to-transparent",
    avatarPersona: "sadie",
    introMessage: "Hey. I'm here. What's going on — I'm listening.",
    prompts: [
      "I keep checking my phone for a reply...",
      "I don't know if I'm overreacting",
      "They went quiet and I'm spiraling",
      "I want to send something but I know I shouldn't",
    ],
  },
  stacy: {
    name: "Stacy",
    tagline: "Raw honesty. Dark humor. She gets it.",
    accent: "text-rose-300",
    border: "border-rose-500/30",
    bgGradient: "from-rose-500/5 to-transparent",
    avatarPersona: "stacy",
    introMessage: "Okay, spill. What did you do — or what did they do? No judgment, I've probably done worse.",
    prompts: [
      "I texted three times with no reply",
      "I pushed them away and now I miss them",
      "I don't know if I want them or just the chase",
      "Why do I always do this?",
    ],
  },
  danny: {
    name: "Danny",
    tagline: "Calm. Logical. The avoidant decoder.",
    accent: "text-amber-300",
    border: "border-amber-500/30",
    bgGradient: "from-amber-500/5 to-transparent",
    avatarPersona: "danny",
    introMessage: "I'm here. Tell me what's happening — I'll give you the straight read.",
    prompts: [
      "Why do they pull away when things get close?",
      "They said they need space — what does that mean?",
      "Are they avoidant or just not interested?",
      "How do I reach an avoidant without pushing them away?",
    ],
  },
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type Persona = "sadie" | "stacy" | "danny";

export default function CompanionChatPage() {
  const params = useParams<{ persona: string }>();
  const persona = (params.persona || "sadie") as Persona;
  const meta = COMPANION_META[persona] || COMPANION_META.sadie;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: meta.introMessage },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expression, setExpression] = useState<AvatarExpression>("neutral");
  const [lastAIText, setLastAIText] = useState(meta.introMessage);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = trpc.companion.chat.useMutation({
    onSuccess: (data) => {
      const response = data.response;
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setLastAIText(response);
      setExpression(detectSentiment(response));
      setIsLoading(false);
      // Return to neutral after 4 seconds
      setTimeout(() => setExpression("neutral"), 4000);
    },
    onError: () => {
      toast.error("Something went wrong. Try again.");
      setIsLoading(false);
      setExpression("neutral");
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Show thinking expression while loading
  useEffect(() => {
    if (isLoading) setExpression("thinking");
  }, [isLoading]);

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);

    chatMutation.mutate({
      persona: persona as "sadie" | "stacy" | "danny",
      message: content,
      history: updatedMessages
        .slice(-10)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100dvh - var(--bottom-nav-height))" }}
    >
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${meta.border} bg-background/95 backdrop-blur-sm sticky top-0 z-10`}>
        <Link href="/companions" className="icon-btn flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        {/* Mini avatar in header */}
        <AnimatedAvatar
          persona={meta.avatarPersona}
          expression={expression}
          isTyping={isLoading}
          size="sm"
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h1 className={`font-display text-base font-bold ${meta.accent} leading-tight`}>{meta.name}</h1>
          <p className="text-xs text-muted-foreground truncate">{meta.tagline}</p>
        </div>
        {/* Expression label */}
        <span className="text-xs text-muted-foreground/60 capitalize hidden sm:block">{expression}</span>
      </div>

      {/* Avatar + Chat area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Floating avatar panel */}
        <div className={`flex justify-center items-center py-4 bg-gradient-to-b ${meta.bgGradient} border-b border-border/30`}>
          <AnimatedAvatar
            persona={meta.avatarPersona}
            expression={expression}
            isTyping={isLoading}
            size="xl"
          />
        </div>

        {/* Mental health disclaimer */}
        <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/20 flex items-start gap-2">
          <svg className="flex-shrink-0 mt-0.5 text-amber-400/70" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs text-amber-400/70 leading-snug">
            {meta.name} is an AI companion, not a licensed therapist. If you're in crisis, please reach out to a mental health professional or call/text 988 (Suicide & Crisis Lifeline).
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-up`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border text-foreground rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start animate-fade-up">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested prompts (only when no messages beyond intro) */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {meta.prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSuggestedPrompt(prompt)}
                className="text-xs bg-secondary text-secondary-foreground border border-border rounded-full px-3 py-1.5 hover:border-primary/50 hover:text-primary transition-all active:scale-95"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="px-4 pb-4 pt-2 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Talk to ${meta.name}...`}
              rows={1}
              className="holdoff-textarea flex-1 resize-none min-h-[44px] max-h-[120px] overflow-y-auto py-2.5"
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              className="holdoff-btn px-4 py-2.5 flex-shrink-0 rounded-xl"
              style={{ minWidth: "52px" }}
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground/50 text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
