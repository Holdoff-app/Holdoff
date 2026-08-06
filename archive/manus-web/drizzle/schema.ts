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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const verdicts = mysqlTable("verdicts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  // Draft body is analyzed in-flight and never persisted; nullable so old rows can be purged.
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
  // Incoming message body is analyzed in-flight and never persisted.
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
