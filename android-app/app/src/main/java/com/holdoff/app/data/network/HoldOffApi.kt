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
 *  – register()           POST /api/auth/signup   ← NEW: for new-user sign-up
 *  – companionChat()      POST /api/companion/chat
 *  – analyzeMessages()    POST /api/verdict  (Fix #3: sends full threadHistory)
 *  – interpretMessage()   POST /api/interpreter  (Fix #3: sends full threadHistory)
 *  – startCheckout()      POST /api/checkout/start  ← NEW: Stripe checkout URL
 *  – checkPremiumStatus() GET  /api/auth/me         ← NEW: post-payment unlock check
 */
object HoldOffApi {

    private const val BASE_URL    = "https://api.smsholdoff.com"
    private const val PREFS_NAME  = "holdoff_prefs"
    private const val KEY_TOKEN   = "auth_token"
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

    /**
     * Sign in an existing user. Calls POST /api/auth/login.
     * On success, saves the JWT from Set-Cookie and the subscription tier.
     *
     * Response shape: { ok, user: { id, email, name, subscription_tier } }
     */
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
                    val msg = runCatching { JSONObject(bodyStr).getString("error") }
                        .getOrDefault("Sign in failed")
                    return@withContext LoginResult(ok = false, error = msg)
                }

                // Extract JWT from Set-Cookie: holdoff_token=<jwt>; ...
                val token = response.headers("Set-Cookie")
                    .firstOrNull { it.startsWith("holdoff_token=") }
                    ?.substringAfter("holdoff_token=")
                    ?.substringBefore(";")
                if (token != null) saveToken(ctx, token)

                // /api/auth/login returns: { ok, user: { subscription_tier, ... } }
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

    /**
     * Register a new user. Calls POST /api/auth/signup.
     *
     * The backend creates the account, sends a verification email, and returns
     * a JWT in Set-Cookie so the user is immediately signed in (free tier).
     * New accounts are always free at sign-up — isPremium is false on first sign-up.
     *
     * Response shape: { ok, user: { id, email, name } }
     */
    suspend fun register(ctx: Context, email: String, password: String): LoginResult =
        withContext(Dispatchers.IO) {
            try {
                val body = JSONObject().apply {
                    put("email", email.trim().lowercase())
                    put("password", password)
                }.toString().toRequestBody(JSON)

                val request = Request.Builder()
                    .url("$BASE_URL/api/auth/signup")
                    .post(body)
                    .build()

                val response = client.newCall(request).execute()
                val bodyStr  = response.body?.string() ?: "{}"

                if (!response.isSuccessful) {
                    // 409 = email already taken; 400 = validation error (weak password, etc.)
                    val msg = runCatching { JSONObject(bodyStr).getString("error") }
                        .getOrDefault("Sign up failed. Try again.")
                    return@withContext LoginResult(ok = false, error = msg)
                }

                // Backend returns 201 with a JWT in Set-Cookie, same shape as login
                val token = response.headers("Set-Cookie")
                    .firstOrNull { it.startsWith("holdoff_token=") }
                    ?.substringAfter("holdoff_token=")
                    ?.substringBefore(";")
                if (token != null) saveToken(ctx, token)

                // New accounts are always free at sign-up
                savePremium(ctx, false)

                LoginResult(ok = true, isPremium = false)
            } catch (e: Exception) {
                LoginResult(ok = false, error = e.message ?: "Network error")
            }
        }

    // ── checkout ───────────────────────────────────────────────────────────

    data class CheckoutResult(val ok: Boolean, val url: String? = null, val error: String? = null)

    /**
     * Request a Stripe checkout URL for the given tier.
     * Calls POST /api/checkout/start — returns the Stripe Payment Link URL
     * with the user's email pre-filled where possible.
     *
     * Valid tier values that map to real Stripe links (from config/plans.js):
     *   "app_monthly"  → $14.99/mo
     *   "app_annual"   → $99.99/yr
     *   "lifetime"     → $149 once
     *
     * Response shape: { url, tier }
     */
    suspend fun startCheckout(ctx: Context, tier: String): CheckoutResult =
        withContext(Dispatchers.IO) {
            try {
                // Try to extract email from the stored JWT payload (middle segment).
                // This lets the backend pre-fill the Stripe checkout email field.
                val email = getToken(ctx)?.let { token ->
                    runCatching {
                        val payload = token.split(".").getOrNull(1) ?: return@runCatching null
                        val decoded = android.util.Base64.decode(
                            payload.padEnd((payload.length + 3) / 4 * 4, '='),
                            android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP
                        )
                        JSONObject(String(decoded)).optString("email").takeIf { it.isNotBlank() }
                    }.getOrNull()
                }

                val bodyJson = JSONObject().apply {
                    put("tier", tier)
                    if (email != null) put("email", email)
                }.toString().toRequestBody(JSON)

                val requestBuilder = Request.Builder()
                    .url("$BASE_URL/api/checkout/start")
                    .post(bodyJson)

                // Include auth token so the backend can pre-fill email server-side too
                val token = getToken(ctx)
                if (token != null) requestBuilder.addHeader("Authorization", "Bearer $token")

                val response = client.newCall(requestBuilder.build()).execute()
                val bodyStr  = response.body?.string() ?: "{}"

                if (!response.isSuccessful) {
                    val msg = runCatching { JSONObject(bodyStr).getString("error") }
                        .getOrDefault("Could not start checkout.")
                    return@withContext CheckoutResult(ok = false, error = msg)
                }

                val url = JSONObject(bodyStr).optString("url").takeIf { it.isNotBlank() }
                    ?: return@withContext CheckoutResult(ok = false, error = "No checkout URL returned.")

                CheckoutResult(ok = true, url = url)
            } catch (e: Exception) {
                CheckoutResult(ok = false, error = e.message ?: "Network error")
            }
        }

    /**
     * Re-check the user's subscription status from the server.
     * Calls GET /api/auth/me — used after returning from Stripe checkout to
     * see whether the payment went through and the account is now premium.
     *
     * /api/auth/me returns a FLAT object (no "user" wrapper):
     *   { id, email, name, subscription_tier, subscription_status, ... }
     *
     * Returns true if subscription_tier is a paid tier (not "free").
     */
    suspend fun checkPremiumStatus(ctx: Context): Boolean =
        withContext(Dispatchers.IO) {
            try {
                val token = getToken(ctx) ?: return@withContext false

                val request = Request.Builder()
                    .url("$BASE_URL/api/auth/me")
                    .addHeader("Authorization", "Bearer $token")
                    .get()
                    .build()

                val response = client.newCall(request).execute()
                val bodyStr  = response.body?.string() ?: "{}"

                if (!response.isSuccessful) return@withContext false

                // /api/auth/me is FLAT — subscription_tier is a top-level field,
                // NOT nested under a "user" key.
                val tier = runCatching {
                    JSONObject(bodyStr).optString("subscription_tier", "free")
                }.getOrDefault("free")

                val premium = tier.isNotBlank() && tier != "free"
                savePremium(ctx, premium)
                premium
            } catch (e: Exception) {
                false
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

    // ── verdict (outgoing message analysis with full thread context) ──────────

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

    // ── interpret (incoming message analysis with full thread context) ─────────

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
