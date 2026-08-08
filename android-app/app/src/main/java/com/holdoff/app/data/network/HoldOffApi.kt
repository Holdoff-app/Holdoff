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
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Thin OkHttp wrapper for the HoldOff API.
 * – analyzeDraft()   → POST /analyze, the draft review behind ProcessTextActivity
 * – companionChat()  → POST /analyze, the Sadie/Dan conversation
 *
 * There is no user account: premium entitlement comes from Google Play, and the
 * only thing kept on device is the handful of preferences below.
 */
object HoldOffApi {

    private const val BASE_URL   = "https://api.smsholdoff.com"
    private val ANALYZE_KEY = BuildConfig.HOLDOFF_API_KEY
    private const val PREFS_NAME = "holdoff_prefs"
    private const val KEY_PREMIUM = "is_premium"
    private const val KEY_ATTACHMENT_STYLE = "attachment_style"
    private const val KEY_ONBOARDED = "onboarded"

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val JSON = "application/json".toMediaType()

    // ── on-device preferences ────────────────────────────────────────────────

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun savePremium(ctx: Context, isPremium: Boolean) =
        prefs(ctx).edit().putBoolean(KEY_PREMIUM, isPremium).apply()

    fun isPremium(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_PREMIUM, false)

    /** Everything HoldOff has ever written to this device. */
    fun clearAll(ctx: Context) =
        prefs(ctx).edit().clear().apply()

    fun saveAttachmentStyle(ctx: Context, quizResult: String) =
        prefs(ctx).edit().putString(KEY_ATTACHMENT_STYLE, quizResult).apply()

    fun getAttachmentStyle(ctx: Context): String? =
        prefs(ctx).getString(KEY_ATTACHMENT_STYLE, null)

    fun hasOnboarded(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_ONBOARDED, false)

    fun markOnboarded(ctx: Context) =
        prefs(ctx).edit().putBoolean(KEY_ONBOARDED, true).apply()

    // ── draft analysis ───────────────────────────────────────────────────────

    private const val ANALYZE_INSTRUCTIONS = """You are HoldOff, a tool that helps someone decide whether to send a message they have just written. You are not a therapist and you must not diagnose.

Read the draft and reply with ONLY a JSON object, no markdown fence, in this exact shape:
{"verdict":"HOLD_OFF|MAYBE|REACH_OUT","confidence":0.0-1.0,"reasoning":"one or two sentences, warm and direct, addressed to the writer as 'you'","insights":["short observation","short observation"],"rewrite":"a calmer version of the same message that keeps the writer's intent, or null if the draft is already fine","crisis":true|false}

Set "crisis" to true only if the draft suggests the writer may be at risk of harming themselves or someone else.
Judge the draft on its own terms; do not invent context you were not given.

DRAFT:
"""

    /**
     * Sends one draft for review. Nothing is stored: the proxy holds the text only
     * for the lifetime of the request, which is what keeps this out of Play's
     * "collected data" definition.
     */
    suspend fun analyzeDraft(draft: String): Result<VerdictResult> = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject()
                .put("prompt", ANALYZE_INSTRUCTIONS + draft)
                .toString()
                .toRequestBody(JSON)

            val request = Request.Builder()
                .url("$BASE_URL/analyze")
                .post(body)
                .addHeader("X-HoldOff-Key", ANALYZE_KEY)
                .build()

            val response = client.newCall(request).execute()
            val bodyStr = response.body?.string() ?: "{}"

            if (!response.isSuccessful) {
                val msg = runCatching { JSONObject(bodyStr).getString("error") }
                    .getOrDefault("Couldn't reach HoldOff (${response.code})")
                return@withContext Result.failure(IllegalStateException(msg))
            }

            val raw = JSONObject(bodyStr).optString("text").trim()
            Result.success(parseVerdict(raw, draft))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Models sometimes wrap JSON in prose or a fence, so pull out the object. */
    private fun parseVerdict(raw: String, draft: String): VerdictResult {
        val start = raw.indexOf('{')
        val end = raw.lastIndexOf('}')
        if (start < 0 || end <= start) {
            throw IllegalStateException("HoldOff couldn't read that response. Try again.")
        }
        val json = JSONObject(raw.substring(start, end + 1))

        val insights = json.optJSONArray("insights")?.let { arr ->
            (0 until arr.length()).mapNotNull { arr.optString(it).takeIf(String::isNotBlank) }
        } ?: emptyList()

        return VerdictResult(
            threadId = "draft:${draft.hashCode()}",
            verdict = when (json.optString("verdict").uppercase()) {
                "REACH_OUT" -> Verdict.REACH_OUT
                "MAYBE" -> Verdict.MAYBE
                else -> Verdict.HOLD_OFF
            },
            confidence = json.optDouble("confidence", 0.5).toFloat().coerceIn(0f, 1f),
            reasoning = json.optString("reasoning").ifBlank { "Give this one a moment before you send it." },
            patternInsights = insights,
            suggestedResponse = json.optString("rewrite").takeIf { it.isNotBlank() && it != "null" },
            isCrisis = json.optBoolean("crisis", false)
        )
    }

    // ── companion chat ───────────────────────────────────────────────────────

    data class ChatResult(val reply: String?, val error: String? = null)

    suspend fun companionChat(
        soulName: String,   // "Sadie" | "Dan"
        message: String,
        history: List<Pair<String, String>> = emptyList(),   // (role, content) pairs
        attachmentStyle: String? = null
    ): ChatResult = withContext(Dispatchers.IO) {
        try {
            val transcript = buildString {
                append(companionPersona(soulName, attachmentStyle))
                append("\n\nCONVERSATION SO FAR:\n")
                history.takeLast(20).forEach { (role, content) ->
                    append(if (role == "assistant") soulName else "Them")
                    append(": ").append(content).append('\n')
                }
                append("Them: ").append(message).append('\n')
                append(soulName).append(':')
            }

            val request = Request.Builder()
                .url("$BASE_URL/analyze")
                .post(JSONObject().put("prompt", transcript).toString().toRequestBody(JSON))
                .addHeader("X-HoldOff-Key", ANALYZE_KEY)
                .build()

            val response = client.newCall(request).execute()
            val bodyStr = response.body?.string() ?: "{}"

            if (!response.isSuccessful) {
                val msg = runCatching { JSONObject(bodyStr).getString("error") }.getOrDefault("Request failed")
                return@withContext ChatResult(reply = null, error = msg)
            }

            val reply = JSONObject(bodyStr).optString("text").trim()
            if (reply.isEmpty()) ChatResult(reply = null, error = "Empty response")
            else ChatResult(reply = reply.removePrefix("$soulName:").trim())

        } catch (e: Exception) {
            ChatResult(reply = null, error = e.message ?: "Network error")
        }
    }

    private fun companionPersona(soulName: String, attachmentStyle: String?): String {
        val voice = if (soulName == "Dan") {
            "You are Dan: steady, plain-spoken, a little dry. Short sentences. You don't gush."
        } else {
            "You are Sadie: warm, direct, a bit playful. You never talk down to anyone."
        }
        val style = attachmentStyle?.replace('_', ' ')?.let {
            " The person tends toward a $it attachment style; keep that in mind without naming it at them."
        } ?: ""
        return "$voice$style You are a supportive companion inside HoldOff, an app that helps " +
            "people pause before sending a message they might regret. You are NOT a therapist: " +
            "never diagnose, never give medical advice. If they sound at risk of harming " +
            "themselves or someone else, gently point them to 988 (US Suicide & Crisis " +
            "Lifeline) or texting HOME to 741741. Reply with one short conversational " +
            "message — no lists, no headings, no roleplay stage directions."
    }
}
