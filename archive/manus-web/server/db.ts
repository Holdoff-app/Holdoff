import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users, verdicts, interpretations, journalEntries,
  communityPosts, quizResults, contacts, contactInsights, spiralEvents,
  InsertUser, InsertVerdict, InsertInterpretation, InsertJournalEntry,
  InsertCommunityPost, InsertQuizResult, InsertContact, InsertContactInsight,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function updateUserAttachmentStyle(userId: number, style: "secure" | "anxious" | "avoidant" | "fearful") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ attachmentStyle: style }).where(eq(users.id, userId));
}

export async function incrementVerdictCount(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({
    verdictCount: sql`${users.verdictCount} + 1`,
    lastActiveAt: new Date(),
  }).where(eq(users.id, userId));
}

// ─── Verdicts ─────────────────────────────────────────────────────────────────

export async function saveVerdict(data: InsertVerdict) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(verdicts).values(data);
  return result;
}

export async function getVerdictHistory(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(verdicts)
    .where(eq(verdicts.userId, userId))
    .orderBy(desc(verdicts.createdAt))
    .limit(limit);
}

export async function getVerdictStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, send: 0, wait: 0, noSend: 0 };
  const rows = await db.select().from(verdicts).where(eq(verdicts.userId, userId));
  return {
    total: rows.length,
    send: rows.filter(r => r.verdict === "SEND").length,
    wait: rows.filter(r => r.verdict === "WAIT").length,
    noSend: rows.filter(r => r.verdict === "DO NOT SEND").length,
  };
}

// ─── Interpretations ──────────────────────────────────────────────────────────

export async function saveInterpretation(data: InsertInterpretation) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(interpretations).values(data);
  return result;
}

export async function getInterpretationHistory(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(interpretations)
    .where(eq(interpretations.userId, userId))
    .orderBy(desc(interpretations.createdAt))
    .limit(limit);
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export async function createJournalEntry(data: InsertJournalEntry) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(journalEntries).values(data);
  return result;
}

export async function getJournalEntries(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.createdAt))
    .limit(limit);
}

export async function deleteJournalEntry(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
}

// ─── Community ────────────────────────────────────────────────────────────────

const ANON_ADJECTIVES = ["Calm", "Grounded", "Quiet", "Steady", "Brave", "Soft", "Still", "Clear", "Warm", "Open"];
const ANON_NOUNS = ["Heart", "Mind", "Soul", "Wave", "Pause", "Moment", "Breath", "Voice", "Space", "Light"];

export function generateAnonName() {
  const adj = ANON_ADJECTIVES[Math.floor(Math.random() * ANON_ADJECTIVES.length)];
  const noun = ANON_NOUNS[Math.floor(Math.random() * ANON_NOUNS.length)];
  return `${adj}${noun}`;
}

export async function createCommunityPost(data: InsertCommunityPost) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(communityPosts).values({
    ...data,
    reactions: { "💜": 0, "🔥": 0, "💙": 0, "✨": 0 },
  });
  return result;
}

export async function getCommunityFeed(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(communityPosts)
    .where(and(eq(communityPosts.flagged, false), isNull(communityPosts.deletedAt)))
    .orderBy(desc(communityPosts.createdAt))
    .limit(limit);
}

export async function reactToPost(postId: number, emoji: string) {
  const db = await getDb();
  if (!db) return;
  const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
  if (!post) return;
  const reactions = (post.reactions as Record<string, number>) || {};
  reactions[emoji] = (reactions[emoji] || 0) + 1;
  await db.update(communityPosts).set({ reactions }).where(eq(communityPosts.id, postId));
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export async function saveQuizResult(data: InsertQuizResult) {
  const db = await getDb();
  if (!db) return;
  await db.insert(quizResults).values(data).onDuplicateKeyUpdate({
    set: {
      primaryStyle: data.primaryStyle,
      secondaryStyle: data.secondaryStyle,
      scores: data.scores,
      answers: data.answers,
    },
  });
}

export async function getQuizResult(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(quizResults).where(eq(quizResults.userId, userId)).limit(1);
  return result || null;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContacts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contacts)
    .where(and(eq(contacts.userId, userId), isNull(contacts.deletedAt)))
    .orderBy(desc(contacts.updatedAt));
}

export async function createContact(data: InsertContact) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(contacts).values(data);
  return result;
}

export async function getContact(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
    .limit(1);
  return result || null;
}

export async function updateContact(id: number, userId: number, data: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contacts).set(data).where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
}

export async function deleteContact(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contacts).set({ deletedAt: new Date() })
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
}

export async function getContactInsights(contactId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(contactInsights)
    .where(and(eq(contactInsights.contactId, contactId), eq(contactInsights.userId, userId)))
    .limit(1);
  return result || null;
}

export async function upsertContactInsights(data: InsertContactInsight) {
  const db = await getDb();
  if (!db) return;
  await db.insert(contactInsights).values(data).onDuplicateKeyUpdate({ set: data });
}

// ─── Spiral Lock ──────────────────────────────────────────────────────────────

const SPIRAL_WINDOW_MS = 30 * 60 * 1000; // 30-minute rolling window
const SPIRAL_THRESHOLD = 3; // 3 consecutive DO NOT SEND triggers lock
const SPIRAL_LOCK_DURATION_MS = 60 * 60 * 1000; // 1-hour cooldown

/** Record a DO NOT SEND event and return lock state */
export async function recordSpiralEvent(userId: number | null, sessionKey: string): Promise<{
  locked: boolean;
  lockedUntil: Date | null;
  consecutiveCount: number;
}> {
  const db = await getDb();
  if (!db) return { locked: false, lockedUntil: null, consecutiveCount: 0 };

  // Check if already locked
  const existing = await getSpiralLock(userId, sessionKey);
  if (existing?.locked && existing.lockedUntil && existing.lockedUntil > new Date()) {
    return { locked: true, lockedUntil: existing.lockedUntil, consecutiveCount: SPIRAL_THRESHOLD };
  }

  // Insert new event
  await db.insert(spiralEvents).values({
    userId: userId ?? undefined,
    sessionKey,
    eventType: "DO_NOT_SEND",
    locked: false,
  });

  // Count recent DO NOT SEND events in the rolling window
  const windowStart = new Date(Date.now() - SPIRAL_WINDOW_MS);
  const recentEvents = await db.select().from(spiralEvents)
    .where(
      userId
        ? and(eq(spiralEvents.userId, userId), sql`${spiralEvents.createdAt} >= ${windowStart}`)
        : and(eq(spiralEvents.sessionKey, sessionKey), sql`${spiralEvents.createdAt} >= ${windowStart}`)
    )
    .orderBy(desc(spiralEvents.createdAt));

  const count = recentEvents.length;

  if (count >= SPIRAL_THRESHOLD) {
    const lockedUntil = new Date(Date.now() + SPIRAL_LOCK_DURATION_MS);
    // Update the most recent event to be the lock record
    await db.update(spiralEvents)
      .set({ locked: true, lockedUntil })
      .where(eq(spiralEvents.id, recentEvents[0].id));
    return { locked: true, lockedUntil, consecutiveCount: count };
  }

  return { locked: false, lockedUntil: null, consecutiveCount: count };
}

/** Check if a user/session is currently locked */
export async function getSpiralLock(userId: number | null, sessionKey: string): Promise<{
  locked: boolean;
  lockedUntil: Date | null;
} | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select().from(spiralEvents)
    .where(
      userId
        ? and(eq(spiralEvents.userId, userId), eq(spiralEvents.locked, true))
        : and(eq(spiralEvents.sessionKey, sessionKey), eq(spiralEvents.locked, true))
    )
    .orderBy(desc(spiralEvents.createdAt))
    .limit(1);

  if (!rows.length) return { locked: false, lockedUntil: null };
  const row = rows[0];
  const isStillLocked = row.locked && row.lockedUntil ? row.lockedUntil > new Date() : false;
  return { locked: isStillLocked, lockedUntil: row.lockedUntil ?? null };
}

/** Clear a spiral lock (e.g. after cooldown or manual unlock) */
export async function clearSpiralLock(userId: number | null, sessionKey: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(spiralEvents)
    .set({ locked: false, lockedUntil: null })
    .where(
      userId
        ? and(eq(spiralEvents.userId, userId), eq(spiralEvents.locked, true))
        : and(eq(spiralEvents.sessionKey, sessionKey), eq(spiralEvents.locked, true))
    );
}
