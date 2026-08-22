package live.shouldiholdoff.holdoff.domain.analysis

/**
 * Per-message analysis. Looks at a single SMS or draft and returns
 * inferred emotional state, attachment signal, and risk markers.
 *
 * Designed for on-device first-pass; deeper analysis can call the server
 * verdict-ai endpoint when the user is online and on premium.
 */
data class MessageAnalysis(
    val mood: Mood,
    val attachmentSignal: AttachmentSignal,
    val urgency: Int,        // 0..10
    val charge: Int,         // 0..10 emotional intensity
    val risk: List<RiskFlag>,
    val summary: String
)

enum class Mood { CALM, ANXIOUS, ANGRY, HURT, HOPEFUL, NUMB, EXCITED, AVOIDANT }
enum class AttachmentSignal { ANXIOUS, AVOIDANT, SECURE, DISORGANIZED, UNCLEAR }
enum class RiskFlag { LATE_NIGHT, REPEATED_SEND, ALL_CAPS, PROFANITY, ULTIMATUM, SELF_HARM_LANGUAGE }

object MessageAnalyzer {

    fun analyze(text: String, hourOfDay: Int, sendsLastHour: Int): MessageAnalysis {
        val lower = text.lowercase()
        val flags = mutableListOf<RiskFlag>()
        if (hourOfDay >= 23 || hourOfDay <= 4) flags += RiskFlag.LATE_NIGHT
        if (sendsLastHour >= 4) flags += RiskFlag.REPEATED_SEND
        if (text.count { it.isUpperCase() } > text.length / 3 && text.length > 12) flags += RiskFlag.ALL_CAPS
        if (PROFANITY.any { lower.contains(it) }) flags += RiskFlag.PROFANITY
        if (ULTIMATUMS.any { lower.contains(it) }) flags += RiskFlag.ULTIMATUM
        if (SELF_HARM.any { lower.contains(it) }) flags += RiskFlag.SELF_HARM_LANGUAGE

        val mood = inferMood(lower)
        val attachment = inferAttachment(lower)
        val charge = ((text.count { it == '!' } + text.count { it == '?' }) * 2).coerceAtMost(10)
        val urgency = (sendsLastHour + (if (flags.contains(RiskFlag.LATE_NIGHT)) 2 else 0)).coerceAtMost(10)

        val summary = buildString {
            append("Reads as ").append(mood.name.lowercase())
            if (attachment != AttachmentSignal.UNCLEAR) append(", ").append(attachment.name.lowercase()).append(" signal")
            if (flags.isNotEmpty()) append(". Flags: ").append(flags.joinToString { it.name })
        }
        return MessageAnalysis(mood, attachment, urgency, charge, flags, summary)
    }

    private fun inferMood(t: String): Mood = when {
        listOf("miss", "love", "can't wait", "yay").any { t.contains(it) } -> Mood.HOPEFUL
        listOf("why are you", "never", "always", "hate").any { t.contains(it) } -> Mood.ANGRY
        listOf("hurt", "crying", "alone", "abandoned").any { t.contains(it) } -> Mood.HURT
        listOf("are you mad", "are we okay", "answer me", "please").any { t.contains(it) } -> Mood.ANXIOUS
        listOf("whatever", "fine", "k", "ok then", "nvm").any { t.contains(it) } -> Mood.AVOIDANT
        listOf("i don't feel anything", "numb", "don't care").any { t.contains(it) } -> Mood.NUMB
        else -> Mood.CALM
    }

    private fun inferAttachment(t: String): AttachmentSignal = when {
        listOf("why aren't you", "please respond", "are you ignoring", "are you mad at me").any { t.contains(it) } -> AttachmentSignal.ANXIOUS
        listOf("i need space", "give me space", "leave me alone", "don't").any { t.contains(it) } -> AttachmentSignal.AVOIDANT
        listOf("i feel", "i need", "can we talk").any { t.contains(it) } -> AttachmentSignal.SECURE
        else -> AttachmentSignal.UNCLEAR
    }

    private val PROFANITY = listOf("fuck", "shit", "bitch", "asshole")
    private val ULTIMATUMS = listOf("if you don't", "or we're done", "last chance", "i'm leaving")
    private val SELF_HARM = listOf("hurt myself", "end it", "kill myself", "don't want to be here")
}
