package live.shouldiholdoff.holdoff.domain.models

import androidx.room.Entity
import androidx.room.PrimaryKey

// ── SMS Thread ────────────────────────────────────────────────────────────────
@Entity(tableName = "sms_threads")
data class SMSThread(
    @PrimaryKey val threadId: String,
    val contactName: String,
    val phoneNumber: String,
    val lastMessage: String,
    val lastMessageTime: Long,
    val unreadCount: Int,
    val verdict: String = "pending",       // "hold_off" | "reach_out" | "wait" | "pending"
    val verdictScore: Float = 0f,
    val relationshipInsight: String = "",
    val avatarUrl: String = "",
    val syncedAt: Long = 0L
)

// ── Contact ───────────────────────────────────────────────────────────────────
@Entity(tableName = "contacts")
data class Contact(
    @PrimaryKey val contactId: String,
    val name: String,
    val phoneNumber: String,
    val email: String = "",
    val avatarUrl: String = "",
    val attachmentStyle: String = "",     // avoidant | anxious | secure | fearful
    val noteCount: Int = 0
)

// ── Companion Message ─────────────────────────────────────────────────────────
@Entity(tableName = "companion_messages")
data class CompanionMessage(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val role: String,                     // "user" | "assistant"
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val mood: String = "neutral",
    val threadId: String? = null
)

// ── Verdict ───────────────────────────────────────────────────────────────────
data class VerdictResult(
    val verdict: String,                  // "hold_off" | "reach_out" | "wait"
    val score: Float,
    val reasoning: String,
    val insight: String,
    val mood: String,
    val suggestion: String
)

// ── User ──────────────────────────────────────────────────────────────────────
data class User(
    val userId: String,
    val email: String,
    val displayName: String,
    val subscriptionStatus: String,       // "free" | "trial" | "active" | "expired"
    val trialEndsAt: Long = 0L,
    val avatarUrl: String = ""
)

// ── Subscription ──────────────────────────────────────────────────────────────
data class SubscriptionStatus(
    val isActive: Boolean,
    val tier: String,                     // "free" | "monthly" | "annual"
    val expiresAt: Long = 0L,
    val isOnTrial: Boolean = false
)
