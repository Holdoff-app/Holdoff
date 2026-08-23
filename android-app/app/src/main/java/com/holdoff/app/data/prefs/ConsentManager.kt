package com.holdoff.app.data.prefs

import android.content.Context
import android.content.SharedPreferences

/**
 * ConsentManager — single source of truth for onboarding state,
 * age confirmation, explicit data-processing consent, and setup mode.
 *
 * Consent is explicit, timestamped, versioned, and REVOCABLE.
 * Revoking consent forces the app back through onboarding and
 * disables any feature that processes message content.
 *
 * Nothing here grants SMS/default-handler roles — those are requested
 * later, only during explicit Full-setup, never at onboarding.
 */
object ConsentManager {

    private const val PREFS_NAME = "holdoff_consent"

    private const val KEY_AGE_CONFIRMED       = "age_confirmed_13_plus"
    private const val KEY_CONSENT_GIVEN       = "processing_consent_given"
    private const val KEY_CONSENT_AT          = "processing_consent_at"
    private const val KEY_CONSENT_VERSION     = "processing_consent_version"
    private const val KEY_SETUP_MODE          = "setup_mode"
    private const val KEY_ONBOARDING_COMPLETE = "onboarding_complete"

    /** Bump when the disclosure text changes materially; re-consent is required. */
    const val CONSENT_VERSION = 1

    const val MODE_FULL   = "full"    // SMS + contact sync (permissions requested later, explicitly)
    const val MODE_MANUAL = "manual"  // Limited mode: paste/share messages by hand, no SMS permissions

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // ── during onboarding ────────────────────────────────────────────────

    fun setAgeConfirmed(ctx: Context, confirmed: Boolean) =
        prefs(ctx).edit().putBoolean(KEY_AGE_CONFIRMED, confirmed).apply()

    fun isAgeConfirmed(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_AGE_CONFIRMED, false)

    /**
     * Records explicit consent with timestamp + version and completes onboarding.
     * Called only when the user has checked every required box and tapped finish.
     */
    fun recordConsentAndFinish(ctx: Context, setupMode: String) =
        prefs(ctx).edit()
            .putBoolean(KEY_CONSENT_GIVEN, true)
            .putLong(KEY_CONSENT_AT, System.currentTimeMillis())
            .putInt(KEY_CONSENT_VERSION, CONSENT_VERSION)
            .putString(KEY_SETUP_MODE, setupMode)
            .putBoolean(KEY_ONBOARDING_COMPLETE, true)
            .apply()

    // ── steady state ─────────────────────────────────────────────────────

    fun isOnboardingComplete(ctx: Context): Boolean {
        val p = prefs(ctx)
        return p.getBoolean(KEY_ONBOARDING_COMPLETE, false)
            && p.getBoolean(KEY_AGE_CONFIRMED, false)
            && p.getBoolean(KEY_CONSENT_GIVEN, false)
            && p.getInt(KEY_CONSENT_VERSION, 0) == CONSENT_VERSION
    }

    fun hasProcessingConsent(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_CONSENT_GIVEN, false)
            && prefs(ctx).getInt(KEY_CONSENT_VERSION, 0) == CONSENT_VERSION

    fun consentGivenAt(ctx: Context): Long =
        prefs(ctx).getLong(KEY_CONSENT_AT, 0L)

    fun getSetupMode(ctx: Context): String =
        prefs(ctx).getString(KEY_SETUP_MODE, MODE_MANUAL) ?: MODE_MANUAL

    fun isManualMode(ctx: Context): Boolean =
        getSetupMode(ctx) == MODE_MANUAL

    /** Switch modes later from Settings without re-running onboarding. */
    fun setSetupMode(ctx: Context, mode: String) =
        prefs(ctx).edit().putString(KEY_SETUP_MODE, mode).apply()

    // ── revocation ───────────────────────────────────────────────────────

    /**
     * Revokes processing consent and resets onboarding. The app must route
     * back to onboarding and must not process message content until the
     * user consents again. Account/session tokens are left untouched —
     * this is about data processing, not sign-in.
     */
    fun revokeConsent(ctx: Context) =
        prefs(ctx).edit()
            .putBoolean(KEY_CONSENT_GIVEN, false)
            .putBoolean(KEY_ONBOARDING_COMPLETE, false)
            .remove(KEY_CONSENT_AT)
            .apply()
}
