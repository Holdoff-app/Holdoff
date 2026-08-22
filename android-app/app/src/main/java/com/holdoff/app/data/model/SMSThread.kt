package com.holdoff.app.data.model

/** One SMS conversation thread — displayed in HomeScreen list. */
data class SMSThread(
    val threadId: String,
    val contactName: String,            // Resolved from Contacts, or phone number
    val phoneNumber: String,
    val lastMessage: String,
    val lastMessageTime: Long,
    val messageCount: Int,
    val unreadCount: Int,
    val photoUri: String? = null,
    val attachmentStyle: String? = null,  // inferred: "avoidant" | "anxious" | "secure" | "fearful_avoidant"
    val riskScore: Float = 0f,            // 0.0 safe → 1.0 hold off
    val verdictCached: VerdictResult? = null
)
