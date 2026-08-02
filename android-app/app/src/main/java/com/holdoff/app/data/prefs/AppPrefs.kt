package com.holdoff.app.data.prefs

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

/**
 * Local settings and counters.
 *
 * Everything here used to be `remember { mutableStateOf(...) }` inside a Composable, so every
 * toggle silently reset on navigation and no other code could read it. Anything the user can
 * change, or that we show back to them as a fact, lives here instead.
 */
object AppPrefs {

    private const val PREFS_NAME = "holdoff_settings"

    private const val KEY_TRUSTED_CONTACTS = "trusted_contacts"
    private const val KEY_HOLD_MINUTES = "hold_minutes"

    private const val KEY_VERDICT_COUNT = "stat_verdicts"
    private const val KEY_HOLD_COUNT = "stat_holds"
    private const val KEY_FIRST_USE_DAY = "stat_first_use_day"

    const val DEFAULT_HOLD_MINUTES = 10

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** How long the hold sheet counts down for. User-set; [DEFAULT_HOLD_MINUTES] is a guess. */
    fun holdMinutes(ctx: Context): Int =
        prefs(ctx).getInt(KEY_HOLD_MINUTES, DEFAULT_HOLD_MINUTES)

    fun setHoldMinutes(ctx: Context, minutes: Int) =
        prefs(ctx).edit().putInt(KEY_HOLD_MINUTES, minutes.coerceIn(1, 120)).apply()

    // ── trusted contacts ─────────────────────────────────────────────────────

    data class TrustedContact(val name: String, val number: String)

    fun trustedContacts(ctx: Context): List<TrustedContact> {
        val raw = prefs(ctx).getString(KEY_TRUSTED_CONTACTS, null) ?: return emptyList()
        return runCatching {
            val arr = JSONArray(raw)
            (0 until arr.length()).map {
                val o = arr.getJSONObject(it)
                TrustedContact(o.getString("name"), o.getString("number"))
            }
        }.getOrDefault(emptyList())
    }

    fun setTrustedContacts(ctx: Context, contacts: List<TrustedContact>) {
        val arr = JSONArray()
        contacts.forEach {
            arr.put(org.json.JSONObject().apply {
                put("name", it.name)
                put("number", it.number)
            })
        }
        prefs(ctx).edit().putString(KEY_TRUSTED_CONTACTS, arr.toString()).apply()
    }

    // ── counters shown on the profile ────────────────────────────────────────

    fun verdictCount(ctx: Context): Int = prefs(ctx).getInt(KEY_VERDICT_COUNT, 0)

    fun holdCount(ctx: Context): Int = prefs(ctx).getInt(KEY_HOLD_COUNT, 0)

    /** One completed analysis. Counts only verdicts the analyser actually returned. */
    fun recordVerdict(ctx: Context) {
        val p = prefs(ctx)
        val edit = p.edit().putInt(KEY_VERDICT_COUNT, p.getInt(KEY_VERDICT_COUNT, 0) + 1)
        if (!p.contains(KEY_FIRST_USE_DAY)) edit.putLong(KEY_FIRST_USE_DAY, todayEpochDay())
        edit.apply()
    }

    /** One send that the pause actually stopped — not merely a HOLD_OFF verdict on screen. */
    fun recordHold(ctx: Context) {
        val p = prefs(ctx)
        p.edit().putInt(KEY_HOLD_COUNT, p.getInt(KEY_HOLD_COUNT, 0) + 1).apply()
    }

    /** Days since first recorded verdict, inclusive. 0 until the user analyses something. */
    fun daysActive(ctx: Context): Int {
        val first = prefs(ctx).getLong(KEY_FIRST_USE_DAY, -1L)
        if (first < 0) return 0
        return ((todayEpochDay() - first) + 1).toInt().coerceAtLeast(0)
    }

    private fun todayEpochDay(): Long = System.currentTimeMillis() / 86_400_000L
}
