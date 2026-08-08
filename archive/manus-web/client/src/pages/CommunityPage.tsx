import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const MOODS = [
  { value: "Calm", emoji: "🌊", label: "Calm" },
  { value: "Anxious", emoji: "😬", label: "Anxious" },
  { value: "Spiraling", emoji: "🌀", label: "Spiraling" },
  { value: "Victory", emoji: "✨", label: "Victory" },
] as const;

type Mood = "Calm" | "Anxious" | "Spiraling" | "Victory";

const MOOD_CLASSES: Record<Mood, string> = {
  Calm: "mood-calm",
  Anxious: "mood-anxious",
  Spiraling: "mood-spiraling",
  Victory: "mood-victory",
};

const MOOD_EMOJIS: Record<Mood, string> = {
  Calm: "🌊",
  Anxious: "😬",
  Spiraling: "🌀",
  Victory: "✨",
};

const REACTIONS = ["💜", "🔥", "💙", "✨"];

function timeAgo(date: Date | string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function CommunityPage() {
  const [showForm, setShowForm] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood>("Calm");
  const [filterMood, setFilterMood] = useState<Mood | "All">("All");

  const utils = trpc.useUtils();

  const { data: posts = [], isLoading } = trpc.community.feed.useQuery({ limit: 50 });

  const postMutation = trpc.community.post.useMutation({
    onSuccess: (data) => {
      toast.success(`Posted as ${data.displayName}`);
      setPostContent("");
      setShowForm(false);
      utils.community.feed.invalidate();
    },
    onError: () => toast.error("Couldn't post. Try again."),
  });

  const reactMutation = trpc.community.react.useMutation({
    onSuccess: () => utils.community.feed.invalidate(),
  });

  const handlePost = () => {
    if (!postContent.trim()) {
      toast.error("Write something first.");
      return;
    }
    if (postContent.trim().length < 3) {
      toast.error("Post is too short.");
      return;
    }
    postMutation.mutate({ content: postContent.trim(), mood: selectedMood });
  };

  const filteredPosts = filterMood === "All"
    ? posts
    : posts.filter((p) => p.mood === filterMood);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Community</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Anonymous. Honest. Real.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="holdoff-btn"
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
          >
            {showForm ? "Cancel" : "Share"}
          </button>
        </div>

        {/* Mood filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setFilterMood("All")}
            className={`pill-btn flex-shrink-0 text-xs ${filterMood === "All" ? "pill-btn-active" : ""}`}
          >
            All
          </button>
          {MOODS.map((mood) => (
            <button
              key={mood.value}
              onClick={() => setFilterMood(filterMood === mood.value ? "All" : mood.value)}
              className={`pill-btn flex-shrink-0 text-xs ${filterMood === mood.value ? "pill-btn-active" : ""}`}
            >
              {mood.emoji} {mood.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {/* Post form */}
        {showForm && (
          <div className="holdoff-card mb-4 animate-fade-in">
            <p className="text-xs text-muted-foreground mb-3">
              You'll be posted as an anonymous name like <span className="text-foreground font-medium">CalmHeart</span>.
            </p>

            {/* Mood selector */}
            <div className="mb-3">
              <label className="input-label">Your mood right now</label>
              <div className="flex gap-2 mt-2">
                {MOODS.map((mood) => (
                  <button
                    key={mood.value}
                    onClick={() => setSelectedMood(mood.value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all duration-150 ${
                      selectedMood === mood.value
                        ? `${MOOD_CLASSES[mood.value]} border-current bg-current/10`
                        : "border-holdoff-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="text-lg">{mood.emoji}</span>
                    <span>{mood.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className="input-label">What's on your mind?</label>
              <textarea
                className="holdoff-textarea"
                placeholder="Share what you're going through. Keep it real."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={4}
                maxLength={280}
              />
              <div className="text-right text-xs text-muted-foreground mt-1">{postContent.length} / 280</div>
            </div>

            <button
              onClick={handlePost}
              disabled={postMutation.isPending || !postContent.trim()}
              className="holdoff-btn w-full"
            >
              {postMutation.isPending ? "Posting..." : "Post anonymously"}
            </button>
          </div>
        )}

        {/* Feed */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="animate-spin w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl">💜</div>
            <p className="text-muted-foreground text-sm">
              {filterMood === "All" ? "No posts yet. Be the first to share." : `No ${filterMood} posts yet.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {filteredPosts.map((post) => {
              const mood = post.mood as Mood;
              const reactions = (post.reactions as Record<string, number>) || {};
              return (
                <div key={post.id} className="holdoff-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{post.displayName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${MOOD_CLASSES[mood]}`}>
                        {MOOD_EMOJIS[mood]} {mood}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
                  </div>

                  <p className="text-sm leading-relaxed text-foreground/90 mb-3">{post.content}</p>

                  {/* Reactions */}
                  <div className="flex gap-2">
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => reactMutation.mutate({ postId: post.id, emoji })}
                        className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded-full transition-colors"
                      >
                        <span>{emoji}</span>
                        {reactions[emoji] ? (
                          <span className="text-muted-foreground">{reactions[emoji]}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
