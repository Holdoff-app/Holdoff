package com.holdoff.app.data.model

/** A single SMS message inside a thread. */
data class Message(
    val id: String,
    val threadId: String,
    val body: String,
    val timestamp: Long,
    val isOutgoing: Boolean,          // true = sent by user
    val senderName: String? = null,
    val sentimentScore: Float? = null,  // -1.0 negative → 1.0 positive
    val urgencyScore: Float? = null     // 0.0 calm → 1.0 urgent
)
