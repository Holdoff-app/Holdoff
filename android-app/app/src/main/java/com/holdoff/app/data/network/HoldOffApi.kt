package com.holdoff.app.data.network

import android.content.Context
import android.content.SharedPreferences
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
 * Thin OkHttp wrapper for api.smsholdoff.com API.
 *
 * Methods:
 *  – login()              POST /api/auth/login
 *  – companionChat()      POST /api/companion/chat
 *  – analyzeMessages()    POST /api/verdict  (Fix #3: sends full threadHistory)
 *  – interpretMessage()   POST /api/interpreter  (Fix #3: sends full threadHistory)
 */
object HoldOffApi {

    private const val BASE_URL   = "https://api.smsholdoff.com"
    private const val PREFS_NAME = "holdoff_prefs"
    private const val KEY_TOKEN  = "auth_token"
    private const val KEY_PREMIUM = "is_premium"
    private const val KEY_ATTACHMENT_STYLE = "attachment_style"

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val JSON = "application/json".toMediaType()

    // ── token storage ──────────────────────────────────────────────────────

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
        prefs(ctx).edit().remove(KEY_TOKEN).remove(KEY_PREMIUM).apply()

    fun saveAttachmentStyle(ctx: Context, quizResult: String) =
        prefs(ctx).edit().putString(KEY_ATTACHMENT_STYLE, quizResult).apply()

    fun getAttachmentStyle(ctx: Context): String? =
        prefs(ctx).getString(KEY_ATTACHMENT_STYLE, null)

    // ── auth ───────────────────────────────────────────────────────────────

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

                LoginResult(ok = true, isPremium = premium)
            } catch (e: Exception) {
                LoginResult(ok = false, error = e.message ?: "Network error")
            }
        }

    // ── companion chat ───────────────────────────────────────────────────────

    suspend fun companionChat(ctx: Context, message: String): String =
        withContext(Dispatchers.IO) {
            val token = getToken(ctx) ?: return@withContext "Please log in to chat with Sadie."
            try {
                val body = JSONObject().apply {
                    put("message", message)
                }.toString().toRequestBody(JSON)

                val request = Request.Builder()
                    .url("$BASE_URL/api/companion/chat")
                    .addHeader("Authorization", "Bearer $token")
                    .post(body)
                    .build()

                val response = client.newCall(request).execute()
                val bodyStr  = response.body?.string() ?: "{}"
                JSONObject(bodyStr).optString("reply", "Sadie is thinking...")
            } catch (e: Exception) {
                "Sadie couldn't reach the server. Try again."
            }
        }

    // ── verdict (outgoing message analysis with full thread context) ─────────────

    /**
     * Sends an outgoing message draft to /api/verdict along with the full
     * thread history (up to 30 messages) for full-context AI analysis.
     *
     * @param messageText    The draft the user is about to send.
     * @param threadHistory  List of maps with keys: direction, body, timestamp.
     * @return               The raw JSON verdict object from the server.
     */
    suspend fun analyzeMessages(
        ctx: Context,
        messageText: String,
        threadHistory: List<Map<String, Any>>
    ): JSONObject = withContext(Dispatchers.IO) {
        val token = getToken(ctx)

        val historyArr = JSONArray()
        for (msg in threadHistory) {
            JSONObject().apply {
                put("direction",  msg["direction"] ?: "received")
                put("body",       msg["body"] ?: "")
                put("timestamp",  msg["timestamp"] ?: 0L)
            }.also { historyArr.put(it) }
        }

        val body = JSONObject().apply {
            put("outgoingMessage", messageText)
            put("threadHistory",   historyArr)
        }.toString().toRequestBody(JSON)

        val requestBuilder = Request.Builder()
            .url("$BASE_URL/api/verdict")
            .post(body)
        if (token != null) requestBuilder.addHeader("Authorization", "Bearer $token")

        val response = client.newCall(requestBuilder.build()).execute()
        val bodyStr  = response.body?.string() ?: "{}"
        JSONObject(bodyStr)
    }

    // ── interpret (incoming message analysis with full thread context) ───────────

    /**
     * Sends an incoming message to /api/interpreter along with the full
     * thread history (up to 20 messages) so Sadie can pattern-match against
     * the relationship context, not just the single message.
     *
     * @param messageText    The incoming message body.
     * @param from           The sender's phone number (used for logging only).
     * @param threadHistory  List of maps with keys: direction, body, timestamp.
     */
    suspend fun interpretMessage(
        ctx: Context,
        messageText: String,
        from: String,
        threadHistory: List<Map<String, Any>>
    ): JSONObject = withContext(Dispatchers.IO) {
        val token = getToken(ctx)

        val historyArr = JSONArray()
        for (msg in threadHistory) {
            JSONObject().apply {
                put("direction",  msg["direction"] ?: "received")
                put("body",       msg["body"] ?: "")
                put("timestamp",  msg["timestamp"] ?: 0L)
            }.also { historyArr.put(it) }
        }

        val body = JSONObject().apply {
            put("message",       messageText)
            put("threadHistory", historyArr)
        }.toString().toRequestBody(JSON)

        val requestBuilder = Request.Builder()
            .url("$BASE_URL/api/interpreter")
            .post(body)
        if (token != null) requestBuilder.addHeader("Authorization", "Bearer $token")

        val response = client.newCall(requestBuilder.build()).execute()
        val bodyStr  = response.body?.string() ?: "{}"
        JSONObject(bodyStr)
    }
}
