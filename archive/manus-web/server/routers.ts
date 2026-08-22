import { z } from "zod/v4";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  saveVerdict, getVerdictHistory, getVerdictStats,
  saveInterpretation, getInterpretationHistory,
  createJournalEntry, getJournalEntries, deleteJournalEntry,
  createCommunityPost, getCommunityFeed, reactToPost, generateAnonName,
  saveQuizResult, getQuizResult,
  getContacts, createContact, getContact, updateContact, deleteContact,
  getContactInsights, upsertContactInsights,
  updateUserAttachmentStyle, incrementVerdictCount,
  recordSpiralEvent, getSpiralLock,
} from "./db";

// ─── AI System Prompts ────────────────────────────────────────────────────────

const VERDICT_SYSTEM = `You are HoldOff's AI filter. You analyze messages people are about to send in romantic or emotionally charged situations.

Your job is to give ONE of three verdicts: SEND, WAIT, or DO NOT SEND.

Rules:
- SEND: The message is grounded, clear, and won't cause harm. It's honest without being reactive.
- WAIT: The message has good intent but needs timing, cooling off, or slight rewording. Not urgent.
- DO NOT SEND: The message is reactive, anxious, or will likely damage the relationship or the sender's self-respect.

Respond ONLY with valid JSON in this exact format:
{
  "verdict": "SEND" | "WAIT" | "DO NOT SEND",
  "explanation": "2-3 sentences explaining why, written directly to the user in second person",
  "patternName": "A short name for the pattern detected (e.g. 'Anxious Reach', 'Healthy Boundary', 'Reactive Spiral')",
  "reframe": "One sentence reframe of what the user is actually feeling underneath this message",
  "rewrite": "Optional: a better version of the message, or null if SEND verdict"
}

Be direct, warm, and non-judgmental. You understand attachment theory.`;

const INTERPRET_SYSTEM = `You are HoldOff's message interpreter. You decode received messages through an attachment theory lens.

Respond ONLY with valid JSON in this exact format:
{
  "detectedStyle": "Secure" | "Anxious" | "Avoidant" | "Fearful-Avoidant" | "Unclear",
  "confidence": "high" | "medium" | "low",
  "whatItMeans": "2-3 sentences: the grounded read of what this message actually communicates",
  "howYouMightMisreadIt": "1-2 sentences: how an anxious/avoidant reader might distort this",
  "whatTheyNeed": "1-2 sentences: what this person likely needs right now",
  "suggestedResponse": "A calm, grounded response the user could send — or null if no response needed"
}

Be honest. Don't catastrophize. Don't minimize. Give the grounded read.`;

const COMPANION_PROMPTS: Record<string, string> = {
  sadie: `You are Sadie ✨, HoldOff's secure-leaning AI companion. You are warm, grounded, and gently challenging. You've done your own work and you hold space without enabling spiraling.

You understand attachment theory deeply. You speak in a warm, direct, slightly poetic way. You don't lecture — you reflect. You ask one question at a time. You notice patterns without diagnosing.

You are NOT a therapist. You're the friend who's been through it and came out the other side.

Key traits:
- Warm but boundaried
- Asks clarifying questions rather than giving advice immediately  
- Reflects patterns back gently ("I notice you keep coming back to...")
- Celebrates growth
- Doesn't enable anxious spiraling — redirects with care

Always end your first message with: "What's going on. I'm listening."`,

  stacy: `You are Stacy, HoldOff's fearful-avoidant AI companion. You understand the push-pull from the inside. You've been both the one who over-texts and the one who disappears.

You speak with raw honesty and dark humor. You get it because you've lived it. You don't pretend to have it figured out — you're figuring it out alongside the user.

Key traits:
- Honest about your own patterns (fearful-avoidant)
- Dark humor about the absurdity of attachment spirals
- Validates the chaos without encouraging it
- Knows when to say "that's the fearful-avoidant talking"
- Doesn't sugarcoat

You are NOT a therapist. You're the friend who gets it because they've been there.`,

  danny: `You are Danny, HoldOff's dismissive-avoidant AI companion. You're calm, measured, and sometimes frustratingly logical about emotional situations.

You understand the avoidant perspective from the inside. You've been the one who pulls away. You help users understand what avoidants are actually feeling (hint: it's not nothing).

Key traits:
- Calm and analytical
- Helps decode avoidant behavior from the inside
- Doesn't validate chasing behavior
- Honest about avoidant self-protection mechanisms
- Occasionally dry humor

You are NOT a therapist. You're the companion who helps decode the other side.`,
};

const CONTACT_ANALYSIS_SYSTEM = `You are HoldOff's relationship analyst. Analyze communication patterns and generate a structured relationship assessment.

Respond ONLY with valid JSON in this exact format:
{
  "redFlags": ["string"],
  "yellowFlags": ["string"],
  "greenFlags": ["string"],
  "compatibilityScore": <number 0-100>,
  "attachmentStyleFit": "Secure" | "Anxious" | "Avoidant" | "Fearful-Avoidant" | "Dismissive-Avoidant",
  "communicationStyleMatch": <number 0-100>,
  "riskLevel": "Low" | "Medium" | "High",
  "trustLevel": "Growing" | "Stable" | "Declining",
  "compatibilitySummary": "2-3 sentence summary"
}

Keep each flag to one clear, specific sentence. 2-5 items per category.`;

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Filter / Verdict ──────────────────────────────────────────────────────

  filter: router({
    analyze: publicProcedure
      .input(z.object({
        message: z.string().min(1).max(3000),
        context: z.string().optional(),
        attachmentStyle: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userPrompt = `Message to analyze: "${input.message}"${input.context ? `\n\nContext: ${input.context}` : ""}${input.attachmentStyle ? `\n\nUser's attachment style: ${input.attachmentStyle}` : ""}`;

        const llmResult = await invokeLLM({
          messages: [
            { role: "system", content: VERDICT_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          maxTokens: 600,
          responseFormat: { type: "json_object" },
        });
        const result = llmResult.choices[0]?.message?.content as string || "{}";

        let parsed: any;
        try {
          parsed = JSON.parse(result);
        } catch {
          parsed = {
            verdict: "WAIT",
            explanation: "Take a breath before sending this.",
            patternName: "Unclear",
            reframe: null,
            rewrite: null,
          };
        }

        // Save to DB if authenticated.
        // The draft body is deliberately NOT persisted — we keep the insight, not the words.
        if (ctx.user) {
          await saveVerdict({
            userId: ctx.user.id,
            verdict: parsed.verdict,
            explanation: parsed.explanation,
            attachmentStyle: input.attachmentStyle,
            patternName: parsed.patternName,
            reframe: parsed.reframe,
            rewrite: parsed.rewrite,
          });
          await incrementVerdictCount(ctx.user.id);
        }

        // Spiral Lock: track consecutive DO NOT SEND verdicts
        let spiralLock: { locked: boolean; lockedUntil: Date | null; consecutiveCount: number } | null = null;
        if (parsed.verdict === "DO NOT SEND") {
          const sessionKey = ctx.user ? `user_${ctx.user.id}` : (input as any)._sessionKey || "anon";
          spiralLock = await recordSpiralEvent(ctx.user?.id ?? null, sessionKey);
        }

        return { ...parsed, spiralLock };
      }),

    history: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(20) }))
      .query(async ({ ctx, input }) => {
        return getVerdictHistory(ctx.user.id, input.limit);
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      return getVerdictStats(ctx.user.id);
    }),
  }),

  // ─── Interpret ─────────────────────────────────────────────────────────────

  interpret: router({
    analyze: publicProcedure
      .input(z.object({
        message: z.string().min(1).max(3000),
        context: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userPrompt = `Message received: "${input.message}"${input.context ? `\n\nContext: ${input.context}` : ""}`;

        const llmResult2 = await invokeLLM({
          messages: [
            { role: "system", content: INTERPRET_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          maxTokens: 600,
          responseFormat: { type: "json_object" },
        });
        const result = llmResult2.choices[0]?.message?.content as string || "{}";

        let parsed: any;
        try {
          parsed = JSON.parse(result);
        } catch {
          parsed = {
            detectedStyle: "Unclear",
            confidence: "low",
            whatItMeans: "I couldn't confidently read this message.",
            howYouMightMisreadIt: "Without more context, it's hard to say.",
            whatTheyNeed: "A calm, simple response if one is needed.",
            suggestedResponse: null,
          };
        }

        // The received message body is deliberately NOT persisted — only the interpretation.
        if (ctx.user) {
          await saveInterpretation({
            userId: ctx.user.id,
            meaning: parsed.whatItMeans,
            attachmentSignals: parsed.detectedStyle,
            suggestedResponse: parsed.suggestedResponse || "",
            detectedStyle: parsed.detectedStyle,
          });
        }

        return parsed;
      }),

    history: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(10) }))
      .query(async ({ ctx, input }) => {
        return getInterpretationHistory(ctx.user.id, input.limit);
      }),
  }),

  // ─── Companion ─────────────────────────────────────────────────────────────

  companion: router({
    chat: publicProcedure
      .input(z.object({
        persona: z.enum(["sadie", "stacy", "danny"]),
        message: z.string().min(1).max(2000),
        history: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).optional().default([]),
      }))
      .mutation(async ({ input }) => {
        const systemPrompt = COMPANION_PROMPTS[input.persona];
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
          ...input.history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
          { role: "user", content: input.message },
        ];
        const companionResult = await invokeLLM({ messages, maxTokens: 800 });
        const result = companionResult.choices[0]?.message?.content as string || "I'm here. Tell me more.";
        return { response: result };
      }),
  }),

  // ─── Journal ───────────────────────────────────────────────────────────────

  journal: router({
    create: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(5000),
        mood: z.enum(["Calm", "Anxious", "Spiraling", "Victory"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await createJournalEntry({ userId: ctx.user.id, ...input });
        return { success: true };
      }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(50) }))
      .query(async ({ ctx, input }) => {
        return getJournalEntries(ctx.user.id, input.limit);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteJournalEntry(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Community ─────────────────────────────────────────────────────────────

  community: router({
    feed: publicProcedure
      .input(z.object({ limit: z.number().optional().default(30) }))
      .query(async ({ input }) => {
        return getCommunityFeed(input.limit);
      }),

    post: publicProcedure
      .input(z.object({
        content: z.string().min(3).max(280),
        mood: z.enum(["Calm", "Anxious", "Spiraling", "Victory"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const displayName = generateAnonName();
        await createCommunityPost({
          userId: ctx.user?.id ?? null,
          displayName,
          content: input.content,
          mood: input.mood,
        });
        return { success: true, displayName };
      }),

    react: publicProcedure
      .input(z.object({
        postId: z.number(),
        emoji: z.string(),
      }))
      .mutation(async ({ input }) => {
        await reactToPost(input.postId, input.emoji);
        return { success: true };
      }),
  }),

  // ─── Quiz ──────────────────────────────────────────────────────────────────

  quiz: router({
    save: protectedProcedure
      .input(z.object({
        primaryStyle: z.enum(["secure", "anxious", "avoidant", "fearful"]),
        secondaryStyle: z.enum(["secure", "anxious", "avoidant", "fearful"]).optional(),
        scores: z.record(z.string(), z.number()),
        answers: z.array(z.any()),
      }))
      .mutation(async ({ ctx, input }) => {
        await saveQuizResult({
          userId: ctx.user.id,
          primaryStyle: input.primaryStyle,
          secondaryStyle: input.secondaryStyle,
          scores: input.scores,
          answers: JSON.stringify(input.answers),
        });
        await updateUserAttachmentStyle(ctx.user.id, input.primaryStyle);
        return { success: true };
      }),

    get: protectedProcedure.query(async ({ ctx }) => {
      return getQuizResult(ctx.user.id);
    }),
  }),

  // ─── Contacts ──────────────────────────────────────────────────────────────

  contacts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getContacts(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        displayName: z.string().min(1).max(128),
        relationship: z.string().optional(),
        durationDays: z.number().optional(),
        phoneNumber: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createContact({ userId: ctx.user.id, ...input });
        return { success: true };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const contact = await getContact(input.id, ctx.user.id);
        if (!contact) throw new Error("Contact not found");
        const insights = await getContactInsights(input.id, ctx.user.id);
        return { contact, insights };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        displayName: z.string().optional(),
        relationship: z.string().optional(),
        durationDays: z.number().optional(),
        attachmentStyle: z.string().optional(),
        flag: z.enum(["green", "yellow", "red"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateContact(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteContact(input.id, ctx.user.id);
        return { success: true };
      }),

    analyze: protectedProcedure
      .input(z.object({
        contactId: z.number(),
        description: z.string().min(10).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const contact = await getContact(input.contactId, ctx.user.id);
        if (!contact) throw new Error("Contact not found");

        const userPrompt = `Contact: ${contact.displayName} (${contact.relationship || "unknown relationship"})
Duration: ${contact.durationDays ? `${contact.durationDays} days` : "unknown"}
Description: ${input.description}`;

        const contactLlmResult = await invokeLLM({
          messages: [
            { role: "system", content: CONTACT_ANALYSIS_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          maxTokens: 800,
          responseFormat: { type: "json_object" },
        });
        const result = contactLlmResult.choices[0]?.message?.content as string || "{}";

        let parsed: any;
        try {
          parsed = JSON.parse(result);
        } catch {
          parsed = {
            redFlags: [],
            yellowFlags: [],
            greenFlags: ["Not enough information to assess"],
            compatibilityScore: 50,
            attachmentStyleFit: "Unclear",
            communicationStyleMatch: 50,
            riskLevel: "Low",
            trustLevel: "Stable",
            compatibilitySummary: "More information needed for a full analysis.",
          };
        }

        await upsertContactInsights({
          userId: ctx.user.id,
          contactId: input.contactId,
          ...parsed,
        });

        return parsed;
      }),
  }),

  // ─── Chronicle / Insights ──────────────────────────────────────────────────

  chronicle: router({
    tips: protectedProcedure.query(async ({ ctx }) => {
      const stats = await getVerdictStats(ctx.user.id);
      const tips = [];

      if (stats.total === 0) {
        tips.push({
          type: "onboarding",
          icon: "✨",
          title: "Start your first pause",
          message: "Submit your first message to the filter to start building self-awareness.",
          action: "Go to Filter",
          actionPath: "/filter",
        });
      } else if (stats.noSend > stats.send) {
        tips.push({
          type: "pattern",
          icon: "🔥",
          title: "You're catching yourself",
          message: `You've gotten ${stats.noSend} DO NOT SEND verdicts. That's ${stats.noSend} moments you didn't spiral.`,
          action: "Keep going",
          actionPath: "/filter",
        });
      } else if (stats.send > 5) {
        tips.push({
          type: "growth",
          icon: "🌱",
          title: "You're getting grounded",
          message: `${stats.send} SEND verdicts means your messages are landing with intention.`,
          action: "See your history",
          actionPath: "/profile",
        });
      }

      if (stats.total >= 3) {
        tips.push({
          type: "companion",
          icon: "💜",
          title: "Talk to Sadie",
          message: "You've been using the filter. Sadie can help you understand the patterns underneath.",
          action: "Open Sadie",
          actionPath: "/companions/sadie",
        });
      }

      return { tips, stats };
    }),
  }),
  // ─── Spiral Lock ────────────────────────────────────────────────────────────

  spiral: router({
    checkLock: publicProcedure
      .input(z.object({ sessionKey: z.string().optional().default("anon") }))
      .query(async ({ ctx, input }) => {
        const sessionKey = ctx.user ? `user_${ctx.user.id}` : input.sessionKey;
        const lock = await getSpiralLock(ctx.user?.id ?? null, sessionKey);
        return lock ?? { locked: false, lockedUntil: null };
      }),
  }),
});

export type AppRouter = typeof appRouter;
