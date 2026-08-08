package live.shouldiholdoff.holdoff.domain.verdict

/**
 * VerdictInterpreter turns a raw verdict (HOLD_OFF / REACH_OUT / WAIT)
 * into something Sadie can SAY in plain language.
 *
 * The interpreter weighs:
 *  - typing speed / message frequency (urgency / spiral signal)
 *  - emotional charge in the draft text (caps, exclamation, profanity, repeated punctuation)
 *  - recency of last reply from the other person
 *  - time of day (late-night spiral risk)
 *  - history of recent verdicts (are we cycling?)
 */
enum class VerdictKind { HOLD_OFF, REACH_OUT, WAIT_AND_SEE }

data class VerdictSignals(
    val draftText: String,
    val recentSendsLastHour: Int,
    val minutesSinceTheirReply: Long,
    val hourOfDay: Int,
    val recentSpiralCount: Int
)

/**
 * Local computed verdict result.
 * Distinct from [live.shouldiholdoff.holdoff.domain.models.VerdictResult] which is the API response DTO.
 */
data class LocalVerdictResult(
    val kind: VerdictKind,
    val confidence: Int,
    val sadieMessage: String,
    val danMessage: String,
    val reasoning: List<String>
)

object VerdictInterpreter {

    fun interpret(s: VerdictSignals): LocalVerdictResult {
        val reasoning = mutableListOf<String>()
        var holdScore = 0
        var reachScore = 0

        // Spiral signals
        if (s.recentSendsLastHour >= 4) {
            holdScore += 3
            reasoning += "You've sent ${s.recentSendsLastHour} messages in the last hour — that's a spiral signal."
        }
        if (s.recentSpiralCount >= 2) {
            holdScore += 2
            reasoning += "You've hit hold-off twice already today."
        }

        // Charge in the draft
        val charged = s.draftText.count { it == '!' } + s.draftText.count { it == '?' }
        val caps = s.draftText.count { it.isUpperCase() }
        if (charged >= 3 || caps > s.draftText.length / 3) {
            holdScore += 2
            reasoning += "This draft reads HOT. Let's cool it for ten minutes."
        }

        // Late-night risk
        if (s.hourOfDay >= 23 || s.hourOfDay <= 4) {
            holdScore += 1
            reasoning += "It's late. Late-night sends almost never land the way you want."
        }

        // Waiting for them
        if (s.minutesSinceTheirReply < 60 && s.recentSendsLastHour == 0) {
            reachScore += 1
            reasoning += "They replied recently and you haven't piled on. Reaching out is reasonable."
        }
        if (s.minutesSinceTheirReply > 60 * 24 * 2) {
            holdScore += 1
            reasoning += "It's been more than two days. One clean message — not three."
        }

        val kind = when {
            holdScore >= reachScore + 2 -> VerdictKind.HOLD_OFF
            reachScore > holdScore -> VerdictKind.REACH_OUT
            else -> VerdictKind.WAIT_AND_SEE
        }
        val confidence = (kotlin.math.abs(holdScore - reachScore) * 20).coerceIn(40, 95)

        val sadie = when (kind) {
            VerdictKind.HOLD_OFF -> "Babe, hold off. I've been here. Ten minutes from now you'll thank yourself."
            VerdictKind.REACH_OUT -> "Okay — one clean message. Not three. You've got this."
            VerdictKind.WAIT_AND_SEE -> "I don't love this draft yet. Walk away from the phone for five and come back to me."
        }
        val dan = when (kind) {
            VerdictKind.HOLD_OFF -> "From this side: more messages right now will feel like pressure, not love."
            VerdictKind.REACH_OUT -> "Short and warm lands better with me than long and explaining. Promise."
            VerdictKind.WAIT_AND_SEE -> "I might just need space. Space isn't rejection. Let me come back to you."
        }

        return LocalVerdictResult(kind, confidence, sadie, dan, reasoning)
    }
}
