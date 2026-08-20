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
 * – login()         → POST /api/auth/login, extracts JWT from Set-Cookie, stores in prefs
 * – companionChat() → POST /api/companion/chat with Bearer token
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
        prefs(ctx).edit().remove(KEY_TOKEN).remove(KEY_PREMIUM).apply()

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
}
