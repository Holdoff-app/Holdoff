package live.shouldiholdoff.holdoff.domain.analysis

/**
 * Aggregates message-level analysis across a thread/contact to give a
 * relationship-level read: dominant attachment dynamic, balance of
 * outreach, escalation pattern, healthy days vs spiral days, and
 * Sadie's empathic summary.
 */
data class RelationshipAnalysis(
    val partnerName: String,
    val dominantUserStyle: AttachmentSignal,
    val dominantPartnerStyle: AttachmentSignal,
    val balance: Float,                  // -1.0 = you reach out far more, +1.0 = they do
    val averageMood: Mood,
    val spiralDays30: Int,
    val healthyDays30: Int,
    val sadieInsight: String,
    val danInsight: String,
    val trend: Trend
)

enum class Trend { IMPROVING, STABLE, ESCALATING, COOLING }

object RelationshipAnalyzer {

    fun analyze(
        partnerName: String,
        userMessages: List<MessageAnalysis>,
        partnerMessages: List<MessageAnalysis>,
        spiralDays30: Int,
        healthyDays30: Int
    ): RelationshipAnalysis {
        val userStyle = dominantStyle(userMessages)
        val partnerStyle = dominantStyle(partnerMessages)
        val balance = balanceFrom(userMessages.size, partnerMessages.size)
        val avgMood = avgMood(userMessages + partnerMessages)
        val trend = when {
            spiralDays30 > healthyDays30 -> Trend.ESCALATING
            healthyDays30 - spiralDays30 > 5 -> Trend.IMPROVING
            partnerMessages.size < userMessages.size / 3 -> Trend.COOLING
            else -> Trend.STABLE
        }

        val sadie = buildString {
            append("With $partnerName you tend to lean ")
            append(userStyle.name.lowercase())
            append(". ")
            append(when (trend) {
                Trend.IMPROVING -> "You're trending up — keep doing what you're doing."
                Trend.STABLE -> "It's steady. Steady is underrated."
                Trend.ESCALATING -> "This is spiraling. Let's pull back, breathe, and use a hold-off."
                Trend.COOLING -> "They're going quiet. That isn't always rejection — but protect your peace."
            })
        }
        val dan = buildString {
            append("From their side, signals lean ")
            append(partnerStyle.name.lowercase())
            append(". ")
            append(when (partnerStyle) {
                AttachmentSignal.AVOIDANT -> "They probably need slower pacing and less pressure to respond."
                AttachmentSignal.ANXIOUS -> "They likely need more reassurance and quicker check-ins."
                AttachmentSignal.SECURE -> "They're communicating clearly — meet them there."
                AttachmentSignal.DISORGANIZED -> "Mixed signals. Don't read it as a verdict on you."
                AttachmentSignal.UNCLEAR -> "Not enough signal yet — keep gentle."
            })
        }
        return RelationshipAnalysis(
            partnerName, userStyle, partnerStyle, balance, avgMood,
            spiralDays30, healthyDays30, sadie, dan, trend
        )
    }

    private fun dominantStyle(msgs: List<MessageAnalysis>): AttachmentSignal {
        if (msgs.isEmpty()) return AttachmentSignal.UNCLEAR
        return msgs.groupingBy { it.attachmentSignal }.eachCount()
            .maxByOrNull { it.value }?.key ?: AttachmentSignal.UNCLEAR
    }

    private fun balanceFrom(user: Int, partner: Int): Float {
        if (user + partner == 0) return 0f
        return (partner - user).toFloat() / (user + partner)
    }

    private fun avgMood(msgs: List<MessageAnalysis>): Mood {
        if (msgs.isEmpty()) return Mood.CALM
        return msgs.groupingBy { it.mood }.eachCount().maxByOrNull { it.value }?.key ?: Mood.CALM
    }
}
