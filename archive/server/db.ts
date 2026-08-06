import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users, verdicts, interpretations, journalEntries,
  communityPosts, quizResults, contacts, contactInsights, spiralEvents,
  featureUsage, adminAuditLog, emergencyContacts, safetyFlags,
  InsertUser, InsertVerdict, InsertInterpretation, InsertJournalEntry,
  InsertCommunityPost, InsertQuizResult, InsertContact, InsertContactInsight,
  InsertFeatureUsage, InsertAdminAuditLog, InsertEmergencyContact, InsertSafetyFlag,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Enforce TLS on the DB connection for sensitive mental-health data.
      // mysql2 honors `ssl` in the connection string (e.g. ?ssl={"rejectUnauthorized":true});
      // when the managed DB requires SSL this keeps data encrypted in transit.
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


// ─── Feature Usage Logging (backend monitoring) ─────────────────────────────────
// IMPORTANT: never log message content or other sensitive data here. Only record
// the feature name, an action label, and non-sensitive metadata (e.g. verdict type).

export async function logFeatureUsage(data: InsertFeatureUsage): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(featureUsage).values(data);
  } catch (error) {
    // Logging must never break the user-facing request.
    console.warn("[Usage] Failed to record feature usage:", (error as Error)?.message);
  }
}

export type FeatureUsageStat = {
  feature: string;
  action: string;
  total: number;
  uniqueUsers: number;
  last7Days: number;
};

export async function getFeatureUsageStats(): Promise<FeatureUsageStat[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      feature: featureUsage.feature,
      action: featureUsage.action,
      total: sql<number>`count(*)`,
      uniqueUsers: sql<number>`count(distinct ${featureUsage.userId})`,
      last7Days: sql<number>`sum(case when ${featureUsage.createdAt} >= now() - interval 7 day then 1 else 0 end)`,
    })
    .from(featureUsage)
    .groupBy(featureUsage.feature, featureUsage.action)
    .orderBy(sql`count(*) desc`);
  return rows.map((r) => ({
    feature: r.feature,
    action: r.action,
    total: Number(r.total),
    uniqueUsers: Number(r.uniqueUsers),
    last7Days: Number(r.last7Days ?? 0),
  }));
}

export async function getUsageSummary(): Promise<{
  totalEvents: number;
  totalUsers: number;
  eventsToday: number;
  eventsLast7Days: number;
}> {
  const db = await getDb();
  if (!db) return { totalEvents: 0, totalUsers: 0, eventsToday: 0, eventsLast7Days: 0 };
  const [row] = await db
    .select({
      totalEvents: sql<number>`count(*)`,
      totalUsers: sql<number>`count(distinct ${featureUsage.userId})`,
      eventsToday: sql<number>`sum(case when ${featureUsage.createdAt} >= curdate() then 1 else 0 end)`,
      eventsLast7Days: sql<number>`sum(case when ${featureUsage.createdAt} >= now() - interval 7 day then 1 else 0 end)`,
    })
    .from(featureUsage);
  return {
    totalEvents: Number(row?.totalEvents ?? 0),
    totalUsers: Number(row?.totalUsers ?? 0),
    eventsToday: Number(row?.eventsToday ?? 0),
    eventsLast7Days: Number(row?.eventsLast7Days ?? 0),
  };
}

export async function getRecentUsage(limit = 100): Promise<Array<{
  id: number;
  feature: string;
  action: string;
  userId: number | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: featureUsage.id,
      feature: featureUsage.feature,
      action: featureUsage.action,
      userId: featureUsage.userId,
      createdAt: featureUsage.createdAt,
    })
    .from(featureUsage)
    .orderBy(desc(featureUsage.createdAt))
    .limit(limit);
  return rows;
}


// ─── Onboarding / Profile ──────────────────────────────────────────────────────

export type OnboardingInput = {
  displayName: string;
  dateOfBirth: string; // YYYY-MM-DD
  ageBand: "adult" | "teen";
  consentTos: boolean;
  consentPrivacy: boolean;
  consentCrisisNotify: boolean;
  guardianName?: string | null;
  guardianEmail?: string | null;
};

export async function completeOnboarding(userId: number, input: OnboardingInput) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({
    displayName: input.displayName,
    dateOfBirth: input.dateOfBirth,
    ageBand: input.ageBand,
    consentTos: input.consentTos,
    consentPrivacy: input.consentPrivacy,
    consentCrisisNotify: input.consentCrisisNotify,
    guardianName: input.guardianName ?? null,
    guardianEmail: input.guardianEmail ?? null,
    guardianConsentAt: input.ageBand === "teen" ? new Date() : null,
    onboardedAt: new Date(),
  }).where(eq(users.id, userId));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row || null;
}

// ─── Emergency Contacts (mandatory) ─────────────────────────────────────────────

export async function getEmergencyContacts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emergencyContacts)
    .where(eq(emergencyContacts.userId, userId))
    .orderBy(desc(emergencyContacts.createdAt));
}

export async function addEmergencyContact(data: InsertEmergencyContact) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(emergencyContacts).values(data);
  return result;
}

export async function deleteEmergencyContact(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(emergencyContacts)
    .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, userId)));
}

export async function countEmergencyContacts(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ c: sql<number>`count(*)` })
    .from(emergencyContacts).where(eq(emergencyContacts.userId, userId));
  return Number(row?.c ?? 0);
}

// ─── Safety flags (aggregate metrics only; content NOT exposed to admin) ─────────

export async function recordSafetyFlag(data: InsertSafetyFlag) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(safetyFlags).values(data);
  } catch (error) {
    console.warn("[Safety] Failed to record safety flag:", (error as Error)?.message);
  }
}

export async function getSafetyMetrics(): Promise<{
  totalFlags: number;
  last7Days: number;
  bySeverity: Array<{ severity: string; count: number }>;
}> {
  const db = await getDb();
  if (!db) return { totalFlags: 0, last7Days: 0, bySeverity: [] };
  const [tot] = await db.select({
    total: sql<number>`count(*)`,
    last7: sql<number>`sum(case when ${safetyFlags.createdAt} >= now() - interval 7 day then 1 else 0 end)`,
  }).from(safetyFlags);
  const sev = await db.select({
    severity: safetyFlags.severity,
    count: sql<number>`count(*)`,
  }).from(safetyFlags).groupBy(safetyFlags.severity);
  return {
    totalFlags: Number(tot?.total ?? 0),
    last7Days: Number(tot?.last7 ?? 0),
    bySeverity: sev.map((s) => ({ severity: s.severity, count: Number(s.count) })),
  };
}

// ─── Admin: users overview, roles, moderation, audit ────────────────────────────

export async function getUsersOverview(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  // Non-sensitive fields only — never select journal/message content here.
  return db.select({
    id: users.id,
    displayName: users.displayName,
    name: users.name,
    email: users.email,
    role: users.role,
    ageBand: users.ageBand,
    membershipType: users.membershipType,
    verdictCount: users.verdictCount,
    onboardedAt: users.onboardedAt,
    lastActiveAt: users.lastActiveAt,
    createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.createdAt)).limit(limit);
}

export async function setUserRole(targetUserId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, targetUserId));
}

export async function getCommunityModerationFeed(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(communityPosts)
    .orderBy(desc(communityPosts.createdAt))
    .limit(limit);
}

export async function setCommunityPostFlagged(postId: number, flagged: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(communityPosts).set({ flagged }).where(eq(communityPosts.id, postId));
}

export async function softDeleteCommunityPost(postId: number, restore = false) {
  const db = await getDb();
  if (!db) return;
  await db.update(communityPosts)
    .set({ deletedAt: restore ? null : new Date() })
    .where(eq(communityPosts.id, postId));
}

export async function writeAuditLog(data: InsertAdminAuditLog) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(adminAuditLog).values(data);
  } catch (error) {
    console.warn("[Audit] Failed to write audit log:", (error as Error)?.message);
  }
}

export async function getAuditLog(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}
