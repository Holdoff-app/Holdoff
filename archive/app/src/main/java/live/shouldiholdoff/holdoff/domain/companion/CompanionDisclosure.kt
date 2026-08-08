package live.shouldiholdoff.holdoff.domain.companion

/**
 * First-launch disclosure that explains who Sadie and Dan are, why they
 * exist inside HoldOff, and what they are NOT.
 *
 * This MUST be shown before the user can interact with either companion.
 * The acknowledgement is persisted in DataStore.
 */
object CompanionDisclosure {

    const val TITLE = "Meet Sadie & Dan"

    val BODY = """
        Sadie and Dan are AI companions built into HoldOff. They aren't bots
        pretending to be friends — they're alter egos with a purpose.

        • Sadie is Stacy's alter ego. She speaks from real lived experience
          with anxious-attachment spirals, late-night overthinking, and the
          ache of waiting for a reply. Her job is to help you feel less alone
          and slow you down before you do the thing you'll regret.

        • Dan is Danny's alter ego. He represents the avoidant partner who
          is learning. He helps you hear what the other side might be feeling
          when they go quiet, pull back, or send a short reply that hurts.

        Together, they let you see both sides of a moment before you act.

        What they are NOT:
        • Not therapists.
        • Not a diagnosis.
        • Not a replacement for professional mental-health support.

        If you are in crisis, please call or text 988 (US) or your local
        emergency number. HoldOff is a tool — your real support team matters
        more than any app.
    """.trimIndent()

    const val ACK_BUTTON = "I understand — let me in"
    const val PREF_KEY = "companion_disclosure_acknowledged_v1"
}
