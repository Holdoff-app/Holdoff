package com.holdoff.app.data.prefs

import android.content.Context
import android.content.SharedPreferences

/**
 * Whether the user has agreed to their text being sent to Google for analysis.
 *
 * The privacy policy names explicit consent as the lawful basis for that transfer, so this is
 * not a preference — it is the record that the basis exists. Three rules follow from that and
 * are enforced here rather than left to each call site:
 *
 *  - Default is [Decision.UNDECIDED], never granted. Silence is not consent.
 *  - Refusing must leave the app usable. Nothing here gates the pause, the timer, the thread
 *    list or the trusted contacts — only the calls that put text on the wire.
 *  - Withdrawal must be as easy as granting, so [withdraw] is a single call with no confirm
 *    step and takes effect on the next request.
 *
 * [VERSION] is bumped when the disclosure itself changes materially — a new recipient, a new
 * category of data. That resets everyone to UNDECIDED, because consent to the old text is not
 * consent to the new one.
 */
object AiConsent {

    /** Bump only when the disclosure changes materially. Re-asks everyone. */
    const val VERSION = 1

    enum class Decision { UNDECIDED, GRANTED, REFUSED }

    private const val PREFS_NAME = "holdoff_ai_consent"
    private const val KEY_DECISION = "decision"
    private const val KEY_VERSION = "version"
    private const val KEY_DECIDED_AT = "decided_at"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun decision(ctx: Context): Decision {
        val p = prefs(ctx)
        if (p.getInt(KEY_VERSION, 0) != VERSION) return Decision.UNDECIDED
        return runCatching { Decision.valueOf(p.getString(KEY_DECISION, null) ?: "") }
            .getOrDefault(Decision.UNDECIDED)
    }

    fun isGranted(ctx: Context): Boolean = decision(ctx) == Decision.GRANTED

    /** Epoch millis of the current decision, or 0 if there isn't one. Shown back to the user. */
    fun decidedAt(ctx: Context): Long =
        if (decision(ctx) == Decision.UNDECIDED) 0L else prefs(ctx).getLong(KEY_DECIDED_AT, 0L)

    fun grant(ctx: Context) = record(ctx, Decision.GRANTED)

    fun refuse(ctx: Context) = record(ctx, Decision.REFUSED)

    fun withdraw(ctx: Context) = record(ctx, Decision.REFUSED)

    private fun record(ctx: Context, decision: Decision) {
        prefs(ctx).edit()
            .putString(KEY_DECISION, decision.name)
            .putInt(KEY_VERSION, VERSION)
            .putLong(KEY_DECIDED_AT, System.currentTimeMillis())
            .apply()
    }
}
