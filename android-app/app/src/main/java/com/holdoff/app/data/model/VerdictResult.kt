package com.holdoff.app.data.model

/** The AI's verdict on a thread — displayed on VerdictScreen. */
data class VerdictResult(
    val threadId: String,
    val verdict: Verdict,
    val confidence: Float,                  // 0.0 → 1.0
    val reasoning: String,
    val patternInsights: List<String>,
    val suggestedResponse: String? = null,  // premium only
    val attachmentInsight: String? = null,  // premium only
    val timestamp: Long = System.currentTimeMillis()
)

enum class Verdict {
    HOLD_OFF,   // don't send that message yet
    REACH_OUT,  // safe to reach out
    MAYBE       // proceed with caution
}
