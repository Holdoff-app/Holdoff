import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { toast } from "sonner";

const FLAG_COLORS: Record<string, string> = {
  green: "text-emerald-400",
  yellow: "text-amber-400",
  red: "text-rose-400",
};

const FLAG_EMOJIS: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

const RELATIONSHIP_TYPES = ["Partner", "Ex", "Situationship", "Crush", "Friend", "Family", "Other"];

export default function ContactsPage() {
  const { isAuthenticated } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [durationDays, setDurationDays] = useState("");

  const utils = trpc.useUtils();

  const { data: contacts = [], isLoading } = trpc.contacts.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("Contact added.");
      setDisplayName("");
      setRelationship("");
      setDurationDays("");
      setShowForm(false);
      utils.contacts.list.invalidate();
    },
    onError: () => toast.error("Couldn't add contact. Try again."),
  });

  const handleCreate = () => {
    if (!displayName.trim()) {
      toast.error("Enter a name.");
      return;
    }
    createMutation.mutate({
      displayName: displayName.trim(),
      relationship: relationship || undefined,
      durationDays: durationDays ? parseInt(durationDays) : undefined,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="font-display text-2xl font-bold">Contacts</h1>
        </div>
        <div className="page-body flex flex-col items-center justify-center text-center gap-4 py-16">
          <div className="text-5xl">👥</div>
          <h2 className="font-display text-xl font-bold">Track your relationships</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Add contacts and get AI-powered relationship analysis with red, yellow, and green flags.
          </p>
          <a href={getLoginUrl()} className="holdoff-btn">
            Sign in to add contacts
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
            <h1 className="font-display text-2xl font-bold">Contacts</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your relationship tracker</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="holdoff-btn"
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
          >
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Add contact form */}
        {showForm && (
          <div className="holdoff-card mb-4 animate-fade-in space-y-3">
            <div>
              <label className="input-label">Name or nickname</label>
              <input
                type="text"
                className="holdoff-input"
                placeholder="e.g. Alex, my ex, the situationship..."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={128}
              />
            </div>

            <div>
              <label className="input-label">Relationship type</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {RELATIONSHIP_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setRelationship(relationship === type ? "" : type)}
                    className={`pill-btn text-xs ${relationship === type ? "pill-btn-active" : ""}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="input-label">How long have you known them? <span className="text-muted-foreground font-normal">(days)</span></label>
              <input
                type="number"
                className="holdoff-input"
                placeholder="e.g. 90"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                min={0}
                max={36500}
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !displayName.trim()}
              className="holdoff-btn w-full"
            >
              {createMutation.isPending ? "Adding..." : "Add contact"}
            </button>
          </div>
        )}

        {/* Contacts list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="animate-spin w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl">👥</div>
            <p className="text-muted-foreground text-sm">No contacts yet.</p>
            <button onClick={() => setShowForm(true)} className="holdoff-btn-secondary text-sm">
              Add your first contact
            </button>
          </div>
        ) : (
          <div className="space-y-2 stagger-children">
            {contacts.map((contact) => (
              <Link key={contact.id} href={`/contacts/${contact.id}`}>
                <div className="holdoff-card flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors active:scale-[0.99]">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-lg font-display font-bold text-primary flex-shrink-0">
                    {contact.displayName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{contact.displayName}</p>
                    {contact.relationship && (
                      <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {contact.flag && (
                      <span className={`text-xs font-medium ${FLAG_COLORS[contact.flag]}`}>
                        {FLAG_EMOJIS[contact.flag]}
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
