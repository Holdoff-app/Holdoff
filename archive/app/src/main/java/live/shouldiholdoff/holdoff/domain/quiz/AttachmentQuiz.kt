package live.shouldiholdoff.holdoff.domain.quiz

/**
 * Attachment-style quiz. 16 short questions, four scales:
 *  - Anxious   (A)
 *  - Avoidant  (V)
 *  - Secure    (S)
 *  - Disorganized (D)
 *
 * Used to personalize verdicts, companion tone, and mood-color baseline.
 * Result feeds into DataStore and is editable in Settings.
 */
data class QuizQuestion(
    val id: Int,
    val text: String,
    val scale: Scale,
    val reverse: Boolean = false
)

enum class Scale { A, V, S, D }

data class QuizAnswer(val questionId: Int, val value: Int) // 1..5 Likert

data class QuizResult(
    val anxious: Int,
    val avoidant: Int,
    val secure: Int,
    val disorganized: Int,
    val primary: Scale,
    val secondary: Scale,
    val summary: String
)

object AttachmentQuiz {
    val QUESTIONS = listOf(
        QuizQuestion(1, "I worry the people I love will leave me.", Scale.A),
        QuizQuestion(2, "I need a lot of reassurance to feel safe.", Scale.A),
        QuizQuestion(3, "When they don't reply, I start spiraling.", Scale.A),
        QuizQuestion(4, "I overthink the wording of my messages.", Scale.A),
        QuizQuestion(5, "I prefer not to depend on anyone.", Scale.V),
        QuizQuestion(6, "I pull away when someone gets too close.", Scale.V),
        QuizQuestion(7, "I shut down when conversations get emotional.", Scale.V),
        QuizQuestion(8, "I need a lot of space to feel like myself.", Scale.V),
        QuizQuestion(9, "I can say what I need calmly.", Scale.S),
        QuizQuestion(10, "I trust the people close to me.", Scale.S),
        QuizQuestion(11, "I can handle conflict without falling apart.", Scale.S),
        QuizQuestion(12, "I believe I'm worth showing up for.", Scale.S),
        QuizQuestion(13, "I want closeness but also fear it.", Scale.D),
        QuizQuestion(14, "My feelings about people I love flip fast.", Scale.D),
        QuizQuestion(15, "I lash out and then feel guilty.", Scale.D),
        QuizQuestion(16, "I don't always trust my own read on a relationship.", Scale.D)
    )

    fun score(answers: List<QuizAnswer>): QuizResult {
        val byId = QUESTIONS.associateBy { it.id }
        val sums = mutableMapOf(Scale.A to 0, Scale.V to 0, Scale.S to 0, Scale.D to 0)
        for (a in answers) {
            val q = byId[a.questionId] ?: continue
            val v = if (q.reverse) 6 - a.value else a.value
            sums[q.scale] = (sums[q.scale] ?: 0) + v
        }
        val sorted = sums.entries.sortedByDescending { it.value }
        val primary = sorted[0].key
        val secondary = sorted[1].key
        val summary = when (primary) {
            Scale.A -> "You lean anxious. You feel love deeply and fear losing it. HoldOff will help you slow the spiral."
            Scale.V -> "You lean avoidant. You protect yourself with space. HoldOff will help you stay connected without losing self."
            Scale.S -> "You lean secure. You communicate clearly. HoldOff will be a gentle co-pilot, not a rescuer."
            Scale.D -> "You lean disorganized. Your feelings move fast. HoldOff will help you find ground before you send."
        }
        return QuizResult(
            sums[Scale.A] ?: 0,
            sums[Scale.V] ?: 0,
            sums[Scale.S] ?: 0,
            sums[Scale.D] ?: 0,
            primary, secondary, summary
        )
    }
}
