/**
 * HoldOff Core tRPC Procedure Tests
 * Tests for filter, interpret, companion, journal, and spiral lock features
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { InvokeResult } from "./_core/llm";

// ─── Mock LLM to avoid real API calls ────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// ─── Mock context helpers ────────────────────────────────────────────────────
vi.mock("./_core/context", () => ({
  createContext: vi.fn(),
}));

// ─── Mock DB helpers to avoid real DB calls ──────────────────────────────────
vi.mock("./db", () => ({
  saveVerdict: vi.fn().mockResolvedValue({ id: 1 }),
  getVerdictHistory: vi.fn().mockResolvedValue([]),
  getVerdictStats: vi.fn().mockResolvedValue({ total: 0, send: 0, wait: 0, doNotSend: 0, noSend: 0 }),
  saveInterpretation: vi.fn().mockResolvedValue({ id: 1 }),
  getInterpretationHistory: vi.fn().mockResolvedValue([]),
  createJournalEntry: vi.fn().mockResolvedValue({ id: 1, content: "Test content", mood: "Calm", createdAt: new Date() }),
  getJournalEntries: vi.fn().mockResolvedValue([]),
  deleteJournalEntry: vi.fn().mockResolvedValue(true),
  createCommunityPost: vi.fn().mockResolvedValue({ id: 1 }),
  getCommunityFeed: vi.fn().mockResolvedValue([]),
  reactToPost: vi.fn().mockResolvedValue(true),
  generateAnonName: vi.fn().mockReturnValue("Anonymous Owl"),
  saveQuizResult: vi.fn().mockResolvedValue({ id: 1 }),
  getQuizResult: vi.fn().mockResolvedValue(null),
  getContacts: vi.fn().mockResolvedValue([]),
  createContact: vi.fn().mockResolvedValue({ id: 1 }),
  getContact: vi.fn().mockResolvedValue(null),
  updateContact: vi.fn().mockResolvedValue({ id: 1 }),
  deleteContact: vi.fn().mockResolvedValue(true),
  getContactInsights: vi.fn().mockResolvedValue(null),
  upsertContactInsights: vi.fn().mockResolvedValue({ id: 1 }),
  updateUserAttachmentStyle: vi.fn().mockResolvedValue(true),
  incrementVerdictCount: vi.fn().mockResolvedValue(1),
  recordSpiralEvent: vi.fn().mockResolvedValue({ id: 1, consecutiveCount: 1, locked: false, lockedUntil: null }),
  logFeatureUsage: vi.fn().mockResolvedValue({ id: 1 }),
  getUsageSummary: vi.fn().mockResolvedValue({ totalUsers: 0, totalEvents: 0, eventsToday: 0, eventsLast7Days: 0 }),
  getFeatureUsageStats: vi.fn().mockResolvedValue([]),
  getRecentUsage: vi.fn().mockResolvedValue([]),
  getSpiralLock: vi.fn().mockResolvedValue(null),
  getDb: vi.fn().mockReturnValue({}),
}));

// ─── Helper: create a mock InvokeResult ──────────────────────────────────────
function mockLLMResult(content: string): InvokeResult {
  return {
    id: "mock-id",
    created: Date.now(),
    model: "mock-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

// ─── Context helpers ──────────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-user-open-id",
    email: "test@holdoff.app",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Filter (Verdict) Tests ───────────────────────────────────────────────────
describe("filter.analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a valid SEND verdict from the LLM (new prompt format)", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      mockLLMResult(JSON.stringify({
        verdict: "SEND",
        pattern: "Clean Accountability",
        whats_happening: "This message is grounded and clear.",
        grounded_voice: "You are communicating your needs calmly.",
        rewrite: null,
        confidence: 0.9,
        attachment_style: "SEC",
      }))
    );

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filter.analyze({
      message: "I need some space to think things through.",
      context: "",
      attachmentStyle: "secure",
    });

    expect(result.verdict).toBe("SEND");
    expect(result.explanation).toBeTruthy();
    expect(result.patternName).toBe("Clean Accountability");
    expect(result.rewrite).toBeNull();
  });

  it("maps a HOLD verdict and triggers spiral tracking", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      mockLLMResult(JSON.stringify({
        verdict: "HOLD",
        pattern: "Reactive Spiral",
        whats_happening: "This message is reactive and may damage the relationship.",
        grounded_voice: "You are feeling abandoned and scared.",
        rewrite: null,
        confidence: 0.85,
        attachment_style: "ANX",
      }))
    );

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filter.analyze({
      message: "Why haven't you texted me back?! Do you even care?!",
      context: "They haven't replied in 2 hours",
      attachmentStyle: "anxious",
    });

    expect(result.verdict).toBe("HOLD");
    expect(result.patternName).toBe("Reactive Spiral");
    expect(result.spiralLock).not.toBeNull();
  });

  it("maps a REWRITE verdict and surfaces the rewrite", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      mockLLMResult(JSON.stringify({
        verdict: "REWRITE",
        pattern: "Anxious Confession",
        whats_happening: "You're apologizing for existing.",
        grounded_voice: "Drop the self-flagellation.",
        rewrite: "I'm feeling disconnected. Can we talk when you have time?",
        confidence: 0.8,
        attachment_style: "ANX",
      }))
    );

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.filter.analyze({
      message: "i'm sorry for being too much, i always ruin everything",
    });

    expect(result.verdict).toBe("REWRITE");
    expect(result.rewrite).toBeTruthy();
  });

  it("falls back gracefully when LLM returns malformed JSON", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      mockLLMResult("This is not valid JSON at all")
    );

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw — falls back to default HOLD verdict
    const result = await caller.filter.analyze({
      message: "Test message",
      context: "",
      attachmentStyle: "secure",
    });

    expect(result.verdict).toBe("HOLD");
  });

  it("returns the curated examples list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const examples = await caller.filter.examples();
    expect(Array.isArray(examples)).toBe(true);
    expect(examples.length).toBe(12);
  });
});

// ─── Interpret Tests ──────────────────────────────────────────────────────────
describe("interpret.analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a valid interpretation with attachment style detection", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      mockLLMResult(JSON.stringify({
        detected_style: "Avoidant",
        confidence: 0.9,
        what_it_means: "They need space and are pulling back.",
        how_you_might_misread_it: "You might think they don't care.",
        attachment_style_reasoning: "They use distancing language under stress.",
        red_flags: null,
        grounded_response: "I understand. Take the time you need.",
      }))
    );

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.interpret.analyze({
      message: "I just need some time to myself right now.",
      context: "My partner of 2 years",
    });

    expect(result.detectedStyle).toBe("Avoidant");
    expect(result.whatItMeans).toBeTruthy();
    expect(result.groundedResponse).toBeTruthy();
  });

  it("falls back gracefully when LLM returns malformed JSON", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      mockLLMResult("not json")
    );

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.interpret.analyze({
      message: "Test message",
    });

    expect(result.detectedStyle).toBe("Unclear");
  });
});

// ─── Companion Chat Tests ─────────────────────────────────────────────────────
describe("companion.chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a companion response with expression", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce(
      mockLLMResult("That sounds really hard. You're not alone in feeling this way.")
    );

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.companion.chat({
      persona: "sadie",
      message: "I feel like I'm always the one reaching out.",
      history: [],
    });

    expect(result.response).toBeTruthy();
    expect(result.response).toContain("hard");
    // expression is derived from detectSentiment — check it's a valid value
    expect(["neutral", "happy", "thinking"]).toContain(result.expression);
  });

  it("supports all four companion personas", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const personas = ["sadie", "stacy", "danny", "dan"] as const;

    for (const persona of personas) {
      vi.mocked(invokeLLM).mockResolvedValueOnce(
        mockLLMResult(`I hear you. That's a lot to carry.`)
      );

      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.companion.chat({
        persona,
        message: "Hello",
        history: [],
      });

      expect(result.response).toBeTruthy();
    }
  });
});

// ─── Journal Tests ────────────────────────────────────────────────────────────
describe("journal", () => {
  it("requires authentication to create a journal entry", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.journal.create({
        content: "Today I felt anxious...",
        mood: "Anxious",
      })
    ).rejects.toThrow();
  });

  it("creates a journal entry for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.journal.create({
      content: "Today I felt anxious...",
      mood: "Anxious",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("lists journal entries for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.journal.list({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Spiral Lock Tests ────────────────────────────────────────────────────────
describe("spiral.checkLock", () => {
  it("returns unlocked state when no spiral lock is active", async () => {
    const { getSpiralLock } = await import("./db");
    vi.mocked(getSpiralLock).mockResolvedValueOnce(null);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spiral.checkLock({ sessionKey: "test-session" });
    expect(result).toMatchObject({ locked: false, lockedUntil: null });
  });

  it("returns spiral lock data when active", async () => {
    const { getSpiralLock } = await import("./db");
    const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min from now
    vi.mocked(getSpiralLock).mockResolvedValueOnce({
      id: 1,
      sessionId: "test-session",
      userId: null,
      consecutiveCount: 3,
      lockedUntil: lockUntil,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.spiral.checkLock({ sessionKey: "test-session" });
    expect(result).toBeDefined();
    expect(result.consecutiveCount).toBe(3);
  });
});

// ─── Pricing Tests ────────────────────────────────────────────────────────────
describe("pricing.plans", () => {
  it("returns the list of paid plans with Stripe checkout links", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const plans = await caller.pricing.plans();
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(plan.id).toBeTruthy();
      expect(plan.label).toBeTruthy();
      expect(plan.priceDisplay).toBeTruthy();
      expect(Array.isArray(plan.features)).toBe(true);
    }
  });
});

// ─── Auth Tests ───────────────────────────────────────────────────────────────
describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@holdoff.app");
    expect(result?.name).toBe("Test User");
  });
});
