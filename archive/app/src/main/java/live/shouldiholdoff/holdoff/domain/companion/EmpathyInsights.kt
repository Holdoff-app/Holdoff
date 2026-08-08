package live.shouldiholdoff.holdoff.domain.companion

import live.shouldiholdoff.holdoff.domain.analysis.Mood
import live.shouldiholdoff.holdoff.domain.analysis.RelationshipAnalysis

/**
 * Empathy Insights = what Sadie and Dan want you to know in the moment.
 *
 * Three flavors:
 *  - Reflection (what I'm noticing in you)
 *  - Mirror     (what the other side might be feeling)
 *  - Permission (the thing you needed someone to say out loud)
 *
 * All copy is gentle, non-clinical, no diagnostic language.
 */
data class EmpathyInsight(
    val fromCompanion: AiCompanion,
    val flavor: Flavor,
    val text: String
)

enum class Flavor { REFLECTION, MIRROR, PERMISSION }

object EmpathyInsights {

    fun forMood(mood: Mood): List<EmpathyInsight> = when (mood) {
        Mood.ANXIOUS -> listOf(
            EmpathyInsight(AiCompanion.SADIE, Flavor.REFLECTION,
                "I can feel you holding your breath. You're not crazy. You're just scared."),
            EmpathyInsight(AiCompanion.DAN, Flavor.MIRROR,
                "If I went quiet, it might not be about you. I sometimes need to come back to myself first."),
            EmpathyInsight(AiCompanion.SADIE, Flavor.PERMISSION,
                "You're allowed to not send anything tonight. The world won't end. I promise.")
        )
        Mood.HURT -> listOf(
            EmpathyInsight(AiCompanion.SADIE, Flavor.REFLECTION,
                "That one landed. I see it. Let's not pretend you're fine."),
            EmpathyInsight(AiCompanion.DAN, Flavor.MIRROR,
                "If I hurt you, I'm capable of hearing it. Say it clean, not loud."),
            EmpathyInsight(AiCompanion.SADIE, Flavor.PERMISSION,
                "You're allowed to grieve a small moment without grieving the whole thing.")
        )
        Mood.ANGRY -> listOf(
            EmpathyInsight(AiCompanion.SADIE, Flavor.REFLECTION,
                "This anger is information, not a personality flaw."),
            EmpathyInsight(AiCompanion.DAN, Flavor.MIRROR,
                "If you send this hot, I'll defend, not hear. Cool it first, then I can listen."),
            EmpathyInsight(AiCompanion.SADIE, Flavor.PERMISSION,
                "You're allowed to be furious AND choose not to text it at 1 AM.")
        )
        Mood.NUMB -> listOf(
            EmpathyInsight(AiCompanion.SADIE, Flavor.REFLECTION,
                "Numb is a feeling too. Often it's the one that comes after too much."),
            EmpathyInsight(AiCompanion.DAN, Flavor.MIRROR,
                "I'd rather hear 'I don't know what I feel' than a perfect lie."),
            EmpathyInsight(AiCompanion.SADIE, Flavor.PERMISSION,
                "You're allowed to put the phone down and come back tomorrow.")
        )
        Mood.HOPEFUL -> listOf(
            EmpathyInsight(AiCompanion.SADIE, Flavor.REFLECTION,
                "Look at you. You're soft today. Keep that."),
            EmpathyInsight(AiCompanion.DAN, Flavor.MIRROR,
                "Short and warm lands so much better than long and explaining."),
            EmpathyInsight(AiCompanion.SADIE, Flavor.PERMISSION,
                "You're allowed to lead with love. It's not weakness.")
        )
        Mood.AVOIDANT -> listOf(
            EmpathyInsight(AiCompanion.DAN, Flavor.REFLECTION,
                "I get this one. Distance feels safer than disappointment."),
            EmpathyInsight(AiCompanion.SADIE, Flavor.MIRROR,
                "On the other side, 'fine' sounds like a door closing. One real word changes that."),
            EmpathyInsight(AiCompanion.DAN, Flavor.PERMISSION,
                "You're allowed to take space. Just tell them it's space, not a verdict.")
        )
        Mood.EXCITED -> listOf(
            EmpathyInsight(AiCompanion.SADIE, Flavor.REFLECTION,
                "You're sparkling. Save some of this for after you sleep on it."),
            EmpathyInsight(AiCompanion.DAN, Flavor.MIRROR,
                "I can match your energy if you bring me into it slowly."),
            EmpathyInsight(AiCompanion.SADIE, Flavor.PERMISSION,
                "You're allowed to feel big things without performing them.")
        )
        Mood.CALM -> listOf(
            EmpathyInsight(AiCompanion.SADIE, Flavor.REFLECTION,
                "This is the version of you I love. Calm isn't boring — it's earned."),
            EmpathyInsight(AiCompanion.DAN, Flavor.MIRROR,
                "Calm reaches me. Loud doesn't."),
            EmpathyInsight(AiCompanion.SADIE, Flavor.PERMISSION,
                "You're allowed to rest here for a minute before doing anything else.")
        )
    }

    fun forRelationship(r: RelationshipAnalysis): List<EmpathyInsight> = listOf(
        EmpathyInsight(AiCompanion.SADIE, Flavor.REFLECTION, r.sadieInsight),
        EmpathyInsight(AiCompanion.DAN, Flavor.MIRROR, r.danInsight)
    )
}
