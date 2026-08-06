import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  attachmentStyle: mysqlEnum("attachmentStyle", ["secure", "anxious", "avoidant", "fearful"]),
  membershipType: varchar("membershipType", { length: 32 }).default("free"),
  verdictCount: int("verdictCount").default(0),
  currentStreak: int("currentStreak").default(0),
  longestStreak: int("longestStreak").default(0),
  lastActiveAt: timestamp("lastActiveAt"),
  // Onboarding / profile
  displayName: varchar("displayName", { length: 128 }),
  dateOfBirth: varchar("dateOfBirth", { length: 10 }), // YYYY-MM-DD
  ageBand: varchar("ageBand", { length: 8 }), // 'adult' | 'teen'
  onboardedAt: timestamp("onboardedAt"),
  consentTos: boolean("consentTos").default(false).notNull(),
  consentPrivacy: boolean("consentPrivacy").default(false).notNull(),
  consentCrisisNotify: boolean("consentCrisisNotify").default(false).notNull(),
  guardianName: varchar("guardianName", { length: 128 }),
  guardianEmail: varchar("guardianEmail", { length: 320 }),
  guardianConsentAt: timestamp("guardianConsentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// Emergency / trusted contacts — mandatory (>=1 per user). For minors, guardian = contact.
export const emergencyContacts = mysqlTable("emergency_contacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  relationship: varchar("relationship", { length: 64 }),
  isGuardian: boolean("isGuardian").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmergencyContact = typeof emergencyContacts.$inferSelect;
export type InsertEmergencyContact = typeof emergencyContacts.$inferInsert;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const verdicts = mysqlTable("verdicts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  // Draft body is analyzed in-flight and never persisted. Retained as a nullable
  // column only so historical rows can be purged; do not write to it.
  message: text("message"),
  context: text("context"),
  verdict: mysqlEnum("verdict", ["SEND", "WAIT", "DO NOT SEND"]).notNull(),
  explanation: text("explanation").notNull(),
  attachmentStyle: varchar("attachmentStyle", { length: 32 }),
  patternName: varchar("patternName", { length: 128 }),
  reframe: text("reframe"),
  rewrite: text("rewrite"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Verdict = typeof verdicts.$inferSelect;
export type InsertVerdict = typeof verdicts.$inferInsert;

export const interpretations = mysqlTable("interpretations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  // Incoming message body is analyzed in-flight and never persisted. See verdicts.message.
  receivedMessage: text("receivedMessage"),
  meaning: text("meaning").notNull(),
  attachmentSignals: text("attachmentSignals").notNull(),
  suggestedResponse: text("suggestedResponse").notNull(),
  detectedStyle: varchar("detectedStyle", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Interpretation = typeof interpretations.$inferSelect;
export type InsertInterpretation = typeof interpretations.$inferInsert;

export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  mood: mysqlEnum("mood", ["Calm", "Anxious", "Spiraling", "Victory"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;

export const communityPosts = mysqlTable("community_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  displayName: varchar("displayName", { length: 64 }).notNull(),
  content: text("content").notNull(),
  mood: mysqlEnum("mood", ["Calm", "Anxious", "Spiraling", "Victory"]).notNull(),
  reactions: json("reactions"),
  flagged: boolean("flagged").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = typeof communityPosts.$inferInsert;

export const quizResults = mysqlTable("quiz_results", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  primaryStyle: mysqlEnum("primaryStyle", ["secure", "anxious", "avoidant", "fearful"]).notNull(),
  secondaryStyle: mysqlEnum("secondaryStyle", ["secure", "anxious", "avoidant", "fearful"]),
  scores: json("scores").notNull(),
  answers: text("answers").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuizResult = typeof quizResults.$inferSelect;
export type InsertQuizResult = typeof quizResults.$inferInsert;

export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  relationship: varchar("relationship", { length: 64 }),
  durationDays: int("durationDays"),
  phoneNumber: varchar("phoneNumber", { length: 32 }),
  flag: mysqlEnum("flag", ["green", "yellow", "red"]).default("green"),
  attachmentStyle: varchar("attachmentStyle", { length: 64 }),
  lastMessagedAt: timestamp("lastMessagedAt"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

export const contactInsights = mysqlTable("contact_insights", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contactId: int("contactId").notNull(),
  redFlags: json("redFlags"),
  yellowFlags: json("yellowFlags"),
  greenFlags: json("greenFlags"),
  compatibilityScore: int("compatibilityScore"),
  attachmentStyleFit: varchar("attachmentStyleFit", { length: 64 }),
  communicationStyleMatch: int("communicationStyleMatch"),
  riskLevel: mysqlEnum("riskLevel", ["Low", "Medium", "High"]).default("Low"),
  trustLevel: mysqlEnum("trustLevel", ["Growing", "Stable", "Declining"]).default("Stable"),
  compatibilitySummary: text("compatibilitySummary"),
  analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
});

export type ContactInsight = typeof contactInsights.$inferSelect;
export type InsertContactInsight = typeof contactInsights.$inferInsert;

export const spiralEvents = mysqlTable("spiral_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  sessionKey: varchar("sessionKey", { length: 128 }).notNull(),
  threadId: varchar("threadId", { length: 128 }),
  eventType: varchar("eventType", { length: 32 }).notNull(),
  locked: boolean("locked").default(false),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SpiralEvent = typeof spiralEvents.$inferSelect;
export type InsertSpiralEvent = typeof spiralEvents.$inferInsert;

// Feature usage log — one row per feature invocation, for backend monitoring
export const featureUsage = mysqlTable("feature_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  sessionKey: varchar("sessionKey", { length: 128 }),
  feature: varchar("feature", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeatureUsage = typeof featureUsage.$inferSelect;
export type InsertFeatureUsage = typeof featureUsage.$inferInsert;

// Admin audit log — records every admin / Sadie-admin action for accountability
export const adminAuditLog = mysqlTable("admin_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull(),
  actor: varchar("actor", { length: 32 }).default("admin").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("targetType", { length: 32 }),
  targetId: varchar("targetId", { length: 64 }),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

// Safety flags — crisis-signal triage queue (self-harm / harm-to-others / risk)
export const safetyFlags = mysqlTable("safety_flags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  sessionKey: varchar("sessionKey", { length: 128 }),
  source: varchar("source", { length: 32 }).notNull(),
  severity: varchar("severity", { length: 16 }).default("medium").notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).default("open").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SafetyFlag = typeof safetyFlags.$inferSelect;
export type InsertSafetyFlag = typeof safetyFlags.$inferInsert;
