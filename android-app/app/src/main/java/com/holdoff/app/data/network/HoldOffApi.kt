package com.holdoff.app.data.network

import android.content.Context
import android.content.SharedPreferences
import com.holdoff.app.BuildConfig
import com.holdoff.app.data.model.Verdict
import com.holdoff.app.data.model.VerdictResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Thin OkHttp wrapper for the two services HoldOff actually talks to.
 *
 * – Supabase Auth   → sign-up, sign-in, password reset, and the premium flag on the profile row
 * – the PHP proxy   → verdicts and companion chat, keeping the Gemini key off the device
 *
 * There is no HoldOff-owned application server. Anything that used to point at
 * shouldiholdoff.live was pointing at nothing.
 */
object HoldOffApi {

    /** Separate deployment: the PHP proxy that keeps the Gemini key server-side. */
    private const val ANALYZE_URL = "https://api.smsholdoff.com/api/analyze"
    private const val PREFS_NAME = "holdoff_prefs"
    private const val KEY_TOKEN  = "auth_token"
    private const val KEY_PREMIUM = "is_premium"
    private const val KEY_ATTACHMENT_STYLE = "attachment_style"
    private const val KEY_EMAIL = "account_email"
    private const val KEY_ONBOARDED = "seen_onboarding"

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val JSON = "application/json".toMediaType()

    // ── token storage ────────────────────────────────────────────────────────

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun saveToken(ctx: Context, token: String) =
        prefs(ctx).edit().putString(KEY_TOKEN, token).apply()

    fun getToken(ctx: Context): String? =
        prefs(ctx).getString(KEY_TOKEN, null)

    fun savePremium(ctx: Context, isPremium: Boolean) =
        prefs(ctx).edit().putBoolean(KEY_PREMIUM, isPremium).apply()

    fun isPremium(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_PREMIUM, false)

    fun clearSession(ctx: Context) =
        prefs(ctx).edit().remove(KEY_TOKEN).remove(KEY_PREMIUM).remove(KEY_EMAIL).apply()

    fun getAccountEmail(ctx: Context): String? =
        prefs(ctx).getString(KEY_EMAIL, null)

    // Onboarding completion is tracked on its own, not inferred from having a token:
    // an account is optional, so "no token" must not mean "first launch" forever.
    fun setOnboarded(ctx: Context) =
        prefs(ctx).edit().putBoolean(KEY_ONBOARDED, true).apply()

    fun hasOnboarded(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_ONBOARDED, false)

    fun saveAttachmentStyle(ctx: Context, quizResult: String) =
        prefs(ctx).edit().putString(KEY_ATTACHMENT_STYLE, quizResult).apply()

    fun getAttachmentStyle(ctx: Context): String? =
        prefs(ctx).getString(KEY_ATTACHMENT_STYLE, null)

    // ── auth ─────────────────────────────────────────────────────────────────

    /**
     * Accounts run on Supabase Auth, over its REST API rather than the Kotlin SDK — this is
     * three POSTs and one GET, and OkHttp is already in the build.
     *
     * This replaced a call to shouldiholdoff.live, which has been dead for some time, so every
     * sign-in attempt in every previously shipped build failed at the network.
     *
     * An account is optional and currently carries nothing but premium entitlement, which
     * cannot yet be purchased. The pause works signed out and should stay that way.
     */
    private val SUPABASE_URL = BuildConfig.SUPABASE_URL.trimEnd('/')
    private val SUPABASE_ANON_KEY = BuildConfig.SUPABASE_ANON_KEY

    /**
     * False when no Supabase config was injected at build time. Account screens must check this
     * and say accounts are unavailable, rather than offering a sign-up that cannot succeed.
     */
    val isAuthConfigured: Boolean
        get() = SUPABASE_URL.isNotBlank() && SUPABASE_ANON_KEY.isNotBlank()

    data class LoginResult(
        val ok: Boolean,
        val error: String? = null,
        val isPremium: Boolean = false,
        /** Sign-up worked, but Supabase is waiting for the user to click the emailed link. */
        val needsEmailConfirmation: Boolean = false
    )

    private const val NOT_CONFIGURED =
        "Accounts aren't switched on in this build. The pause works without one."

    private fun authRequest(path: String, payload: JSONObject): Request =
        Request.Builder()
            .url("$SUPABASE_URL/auth/v1/$path")
            .addHeader("apikey", SUPABASE_ANON_KEY)
            .post(payload.toString().toRequestBody(JSON))
            .build()

    /** Supabase reports failures under a different key depending on which endpoint answered. */
    private fun authError(bodyStr: String, fallback: String): String {
        val json = runCatching { JSONObject(bodyStr) }.getOrNull() ?: return fallback
        for (key in listOf("error_description", "msg", "message", "error")) {
            val v = json.optString(key)
            if (v.isNotBlank()) return v
        }
        return fallback
    }

    private fun storeSession(ctx: Context, email: String, token: String?, premium: Boolean) {
        if (token != null) saveToken(ctx, token)
        savePremium(ctx, premium)
        prefs(ctx).edit().putString(KEY_EMAIL, email).apply()
    }

    suspend fun signUp(ctx: Context, email: String, password: String): LoginResult =
        withContext(Dispatchers.IO) {
            if (!isAuthConfigured) return@withContext LoginResult(false, NOT_CONFIGURED)
            val addr = email.trim().lowercase()
            try {
                val payload = JSONObject().put("email", addr).put("password", password)
                val response = client.newCall(authRequest("signup", payload)).execute()
                val bodyStr = response.body?.string() ?: "{}"

                if (!response.isSuccessful) {
                    return@withContext LoginResult(
                        false, authError(bodyStr, "Couldn’t create that account.")
                    )
                }

                // A session comes back only when email confirmation is switched off for the
                // project. Otherwise the account exists but cannot be used until confirmed —
                // the user has to be told that, or they will assume they are signed in.
                val token = runCatching { JSONObject(bodyStr).optString("access_token") }
                    .getOrNull()?.takeIf { it.isNotBlank() }

                if (token == null) {
                    LoginResult(ok = true, needsEmailConfirmation = true)
                } else {
                    val premium = fetchPremium(token)
                    storeSession(ctx, addr, token, premium)
                    LoginResult(ok = true, isPremium = premium)
                }
            } catch (e: Exception) {
                LoginResult(false, e.message ?: "Network error")
            }
        }

    suspend fun signIn(ctx: Context, email: String, password: String): LoginResult =
        withContext(Dispatchers.IO) {
            if (!isAuthConfigured) return@withContext LoginResult(false, NOT_CONFIGURED)
            val addr = email.trim().lowercase()
            try {
                val payload = JSONObject().put("email", addr).put("password", password)
                val response = client
                    .newCall(authRequest("token?grant_type=password", payload)).execute()
                val bodyStr = response.body?.string() ?: "{}"

                if (!response.isSuccessful) {
                    return@withContext LoginResult(
                        false, authError(bodyStr, "Check your email and password.")
                    )
                }

                val token = runCatching { JSONObject(bodyStr).optString("access_token") }
                    .getOrNull()?.takeIf { it.isNotBlank() }
                    ?: return@withContext LoginResult(false, "Signed in but got no session back.")

                val premium = fetchPremium(token)
                storeSession(ctx, addr, token, premium)
                LoginResult(ok = true, isPremium = premium)
            } catch (e: Exception) {
                LoginResult(false, e.message ?: "Network error")
            }
        }

    /**
     * Sends the real reset email. Supabase answers 200 whether or not the address exists, which
     * is deliberate — it stops the endpoint being used to test whether someone has an account.
     */
    suspend fun requestPasswordReset(email: String): LoginResult =
        withContext(Dispatchers.IO) {
            if (!isAuthConfigured) return@withContext LoginResult(false, NOT_CONFIGURED)
            try {
                val payload = JSONObject().put("email", email.trim().lowercase())
                val response = client.newCall(authRequest("recover", payload)).execute()
                if (response.isSuccessful) LoginResult(ok = true)
                else LoginResult(
                    false,
                    authError(response.body?.string() ?: "{}", "Couldn’t send the reset email.")
                )
            } catch (e: Exception) {
                LoginResult(false, e.message ?: "Network error")
            }
        }

    /**
     * Reads entitlement from the user's own profile row. Row-level security means this returns
     * their row or nothing, so no filter is needed here.
     *
     * Any failure is treated as "not premium". Since premium cannot be bought, that is the safe
     * direction to fail: nobody loses something they paid for.
     */
    private fun fetchPremium(token: String): Boolean = runCatching {
        val request = Request.Builder()
            .url("$SUPABASE_URL/rest/v1/profiles?select=is_premium&limit=1")
            .addHeader("apikey", SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer $token")
            .get()
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@runCatching false
            val rows = JSONArray(response.body?.string() ?: "[]")
            if (rows.length() == 0) false
            else rows.getJSONObject(0).optBoolean("is_premium", false)
        }
    }.getOrDefault(false)

    // ── companion chat ───────────────────────────────────────────────────────

    data class ChatResult(val reply: String?, val error: String? = null)

    /**
     * Companion chat.
     *
     * Runs on [ANALYZE_URL], the same prompt→text proxy the verdict uses, because the
     * old companion endpoint had no server behind it. That means no account is
     * needed to talk to Sadie, and no conversation is stored anywhere off the device.
     */
    suspend fun companionChat(
        ctx: Context,
        soulName: String,   // "Sadie" | "Dan"
        message: String,
        history: List<Pair<String, String>> = emptyList(),   // (role, content) pairs
        attachmentStyle: String? = null
    ): ChatResult = withContext(Dispatchers.IO) {
        if (message.isBlank()) return@withContext ChatResult(reply = null, error = "Nothing to send")

        val transcript = history.takeLast(12).joinToString("\n") { (role, content) ->
            val who = if (role.equals("user", ignoreCase = true)) "Them" else soulName
            "$who: $content"
        }.take(4000)

        val prompt = buildString {
            append("You are $soulName, a warm, plain-spoken companion inside HoldOff, an app that ")
            append("helps someone pause before sending a text they might regret. ")
            append("The person you are talking to may live with anxiety, ADHD, or be in recovery. ")
            append("Be direct and kind. Never clinical, never patronising, never diagnose. ")
            append("You are not a therapist and not a crisis service; if they are in danger, ")
            append("gently point them to a local crisis line.\n\n")
            if (attachmentStyle != null) append("They describe their attachment style as: $attachmentStyle\n\n")
            if (transcript.isNotBlank()) append("Conversation so far:\n$transcript\n\n")
            append("They just said:\n$message\n\n")
            append("Reply as $soulName in two or three sentences. Plain text only, no markdown.")
        }

        try {
            val request = Request.Builder()
                .url(ANALYZE_URL)
                .post(JSONObject().put("prompt", prompt).toString().toRequestBody(JSON))
                .build()

            val response = client.newCall(request).execute()
            val bodyStr = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                return@withContext ChatResult(reply = null, error = "Sadie is unreachable (${response.code})")
            }

            val reply = runCatching { JSONObject(bodyStr).getString("text") }
                .getOrNull()?.trim()?.takeIf { it.isNotBlank() }
                ?: return@withContext ChatResult(reply = null, error = "Unexpected response")

            ChatResult(reply = reply)

        } catch (e: Exception) {
            ChatResult(reply = null, error = e.message ?: "Network error")
        }
    }

    // ── draft analysis ───────────────────────────────────────────────────────

    data class AnalyzeResult(val verdict: VerdictResult? = null, val error: String? = null)

    /**
     * Analyses a draft against recent thread context.
     *
     * Hits the PHP proxy on [ANALYZE_URL], which holds the Gemini key server-side and
     * answers `{"prompt": "..."}` with `{"text": "..."}`. Distinct from Supabase, which
     * serves auth and companion chat from a different deployment.
     *
     * Returns an error rather than a placeholder when anything fails. A fabricated verdict
     * is worse than no verdict — users act on these.
     */
    suspend fun analyzeDraft(
        threadId: String,
        recentMessages: List<String>,
        draft: String,
        attachmentStyle: String? = null
    ): AnalyzeResult = withContext(Dispatchers.IO) {
        if (draft.isBlank()) return@withContext AnalyzeResult(error = "Nothing to analyse yet")

        val context = recentMessages.takeLast(12).joinToString("\n").take(4000)
        val prompt = buildString {
            append("You advise someone deciding whether to send a text they may regret. ")
            append("They live with anxiety, ADHD, or are in recovery, so be direct and kind, never clinical or patronising.\n\n")
            if (context.isNotBlank()) append("Recent conversation:\n$context\n\n")
            if (attachmentStyle != null) append("Their attachment style: $attachmentStyle\n\n")
            append("Draft they want to send:\n$draft\n\n")
            append("Reply with STRICT JSON and nothing else, no markdown fence:\n")
            append("""{"verdict":"HOLD_OFF|MAYBE|REACH_OUT","confidence":0.0-1.0,""")
            append(""""reasoning":"two sentences, second person","insights":["short observation","..."],""")
            append(""""suggested":"a calmer rewrite, or null"}""")
        }

        try {
            val request = Request.Builder()
                .url(ANALYZE_URL)
                .post(JSONObject().put("prompt", prompt).toString().toRequestBody(JSON))
                .build()

            val response = client.newCall(request).execute()
            val bodyStr = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                return@withContext AnalyzeResult(error = "Analysis unavailable (${response.code})")
            }

            val text = runCatching { JSONObject(bodyStr).getString("text") }.getOrNull()
                ?: return@withContext AnalyzeResult(error = "Unexpected response from analyser")

            val json = runCatching { JSONObject(extractJsonObject(text)) }.getOrNull()
                ?: return@withContext AnalyzeResult(error = "Could not read the analysis")

            val verdict = when (json.optString("verdict").uppercase()) {
                "HOLD_OFF" -> Verdict.HOLD_OFF
                "REACH_OUT" -> Verdict.REACH_OUT
                "MAYBE" -> Verdict.MAYBE
                else -> return@withContext AnalyzeResult(error = "Could not read the analysis")
            }

            val insights = json.optJSONArray("insights")?.let { arr ->
                (0 until arr.length()).mapNotNull { arr.optString(it).takeIf(String::isNotBlank) }
            }.orEmpty()

            AnalyzeResult(
                verdict = VerdictResult(
                    threadId = threadId,
                    verdict = verdict,
                    confidence = json.optDouble("confidence", 0.0).toFloat().coerceIn(0f, 1f),
                    reasoning = json.optString("reasoning").ifBlank { "No reasoning returned." },
                    patternInsights = insights,
                    suggestedResponse = json.optString("suggested").takeIf {
                        it.isNotBlank() && !it.equals("null", ignoreCase = true)
                    }
                )
            )
        } catch (e: Exception) {
            AnalyzeResult(error = e.message ?: "Network error")
        }
    }

    /** Models often wrap JSON in prose or a fence; take the outermost braced span. */
    private fun extractJsonObject(raw: String): String {
        val start = raw.indexOf('{')
        val end = raw.lastIndexOf('}')
        return if (start >= 0 && end > start) raw.substring(start, end + 1) else raw
    }
}
