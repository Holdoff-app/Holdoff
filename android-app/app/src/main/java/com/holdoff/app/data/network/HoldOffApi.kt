package com.holdoff.app.data.network

import android.content.Context
import android.content.SharedPreferences
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
 * Thin OkHttp wrapper for shouldiholdoff.live API.
 * – login()         → POST /api/auth/login, extracts JWT from Set-Cookie, stores in prefs
 * – companionChat() → POST /api/companion/chat with Bearer token
 */
object HoldOffApi {

    private const val BASE_URL   = "https://shouldiholdoff.live"
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

    data class LoginResult(val ok: Boolean, val error: String? = null, val isPremium: Boolean = false)

    suspend fun login(ctx: Context, email: String, password: String): LoginResult =
        withContext(Dispatchers.IO) {
            try {
                val body = JSONObject().apply {
                    put("email", email.trim().lowercase())
                    put("password", password)
                }.toString().toRequestBody(JSON)

                val request = Request.Builder()
                    .url("$BASE_URL/api/auth/login")
                    .post(body)
                    .build()

                val response = client.newCall(request).execute()
                val bodyStr  = response.body?.string() ?: "{}"

                if (!response.isSuccessful) {
                    val msg = runCatching { JSONObject(bodyStr).getString("error") }.getOrDefault("Login failed")
                    return@withContext LoginResult(ok = false, error = msg)
                }

                // Extract JWT from Set-Cookie header (holdoff_token=<jwt>; ...)
                val token = response.headers("Set-Cookie")
                    .firstOrNull { it.startsWith("holdoff_token=") }
                    ?.substringAfter("holdoff_token=")
                    ?.substringBefore(";")

                if (token != null) saveToken(ctx, token)

                // Read subscription tier from response body
                val tier = runCatching {
                    JSONObject(bodyStr).getJSONObject("user").getString("subscription_tier")
                }.getOrDefault("free")
                val premium = tier != "free" && tier.isNotBlank()
                savePremium(ctx, premium)
                prefs(ctx).edit().putString(KEY_EMAIL, email.trim().lowercase()).apply()

                LoginResult(ok = true, isPremium = premium)

            } catch (e: Exception) {
                LoginResult(ok = false, error = e.message ?: "Network error")
            }
        }

    // ── companion chat ───────────────────────────────────────────────────────

    data class ChatResult(val reply: String?, val error: String? = null)

    suspend fun companionChat(
        ctx: Context,
        soulName: String,   // "Sadie" | "Dan"
        message: String,
        history: List<Pair<String, String>> = emptyList(),   // (role, content) pairs
        attachmentStyle: String? = null
    ): ChatResult = withContext(Dispatchers.IO) {
        val token = getToken(ctx)
            ?: return@withContext ChatResult(reply = null, error = "Not authenticated")

        try {
            val historyArr = JSONArray().apply {
                history.forEach { (role, content) ->
                    put(JSONObject().apply { put("role", role); put("content", content) })
                }
            }
            val bodyObj = JSONObject().apply {
                put("soulName", soulName)
                put("message", message)
                put("conversationHistory", historyArr)
                if (attachmentStyle != null) put("attachmentStyle", attachmentStyle)
            }

            val request = Request.Builder()
                .url("$BASE_URL/api/companion/chat")
                .post(bodyObj.toString().toRequestBody(JSON))
                .addHeader("Authorization", "Bearer $token")
                .build()

            val response = client.newCall(request).execute()
            val bodyStr  = response.body?.string() ?: "{}"

            if (!response.isSuccessful) {
                val msg = runCatching { JSONObject(bodyStr).getString("error") }.getOrDefault("Request failed")
                return@withContext ChatResult(reply = null, error = msg)
            }

            val reply = JSONObject(bodyStr).getString("reply")
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
     * answers `{"prompt": "..."}` with `{"text": "..."}`. Distinct from [BASE_URL], which
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
