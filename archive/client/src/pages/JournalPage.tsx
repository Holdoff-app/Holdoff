import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

const MOODS = [
  { value: "Calm", emoji: "🌊", color: "mood-calm", label: "Calm" },
  { value: "Anxious", emoji: "😬", color: "mood-anxious", label: "Anxious" },
  { value: "Spiraling", emoji: "🌀", color: "mood-spiraling", label: "Spiraling" },
  { value: "Victory", emoji: "✨", color: "mood-victory", label: "Victory" },
] as const;

type Mood = "Calm" | "Anxious" | "Spiraling" | "Victory";

const MOOD_COLORS: Record<Mood, string> = {
  Calm: "text-sky-400",
  Anxious: "text-amber-400",
  Spiraling: "text-rose-400",
  Victory: "text-emerald-400",
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function JournalPage() {
  const { isAuthenticated } = useAuth();
  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood>("Calm");
  const [showForm, setShowForm] = useState(false);

  const utils = trpc.useUtils();

  const { data: entries = [], isLoading } = trpc.journal.list.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );

  const createMutation = trpc.journal.create.useMutation({
    onSuccess: () => {
      toast.success("Entry saved.");
      setContent("");
      setShowForm(false);
      utils.journal.list.invalidate();
    },
    onError: () => toast.error("Couldn't save. Try again."),
  });

  const deleteMutation = trpc.journal.delete.useMutation({
    onSuccess: () => {
      toast.success("Entry deleted.");
      utils.journal.list.invalidate();
    },
    onError: () => toast.error("Couldn't delete. Try again."),
  });

  const handleSave = () => {
    if (!content.trim()) {
      toast.error("Write something first.");
      return;
    }
    createMutation.mutate({ content: content.trim(), mood: selectedMood });
  };

  if (!isAuthenticated) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="font-display text-2xl font-bold">Journal</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your private space</p>
        </div>
        <div className="page-body flex flex-col items-center justify-center text-center gap-4 py-16">
          <div className="text-5xl">📓</div>
          <h2 className="font-display text-xl font-bold">Your private journal</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Journal entries are private and only visible to you. Sign in to start writing.
          </p>
          <a href={getLoginUrl()} className="holdoff-btn">
            Sign in to journal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Journal</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your private space</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="holdoff-btn"
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
          >
            {showForm ? "Cancel" : "+ New entry"}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* New entry form */}
        {showForm && (
          <div className="holdoff-card mb-4 animate-fade-in">
            {/* Mood selector */}
            <div className="mb-3">
              <label className="input-label">How are you feeling?</label>
              <div className="flex gap-2 mt-2">
                {MOODS.map((mood) => (
                  <button
                    key={mood.value}
                    onClick={() => setSelectedMood(mood.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all duration-150 ${
                      selectedMood === mood.value
                        ? `${mood.color} border-current bg-current/10`
                        : "border-holdoff-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="text-lg">{mood.emoji}</span>
                    <span>{mood.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="mb-3">
              <label className="input-label">What's on your mind?</label>
              <textarea
                className="holdoff-textarea"
                placeholder="Write freely. This is just for you."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                maxLength={5000}
              />
              <div className="text-right text-xs text-muted-foreground mt-1">{content.length} / 5000</div>
            </div>

            <button
              onClick={handleSave}
              disabled={createMutation.isPending || !content.trim()}
              className="holdoff-btn w-full"
            >
              {createMutation.isPending ? "Saving..." : "Save entry"}
            </button>
          </div>
        )}

        {/* Entries list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="animate-spin w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl">📓</div>
            <p className="text-muted-foreground text-sm">No entries yet.</p>
            <button onClick={() => setShowForm(true)} className="holdoff-btn-secondary text-sm">
              Write your first entry
            </button>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {entries.map((entry) => {
              const mood = entry.mood as Mood;
              const moodMeta = MOODS.find((m) => m.value === mood);
              return (
                <div key={entry.id} className="holdoff-card group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{moodMeta?.emoji}</span>
                      <span className={`text-xs font-semibold ${MOOD_COLORS[mood]}`}>{mood}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                      <button
                        onClick={() => {
                          if (confirm("Delete this entry?")) {
                            deleteMutation.mutate({ id: entry.id });
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-400 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{entry.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
