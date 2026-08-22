package live.shouldiholdoff.holdoff.data.repositories

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import live.shouldiholdoff.holdoff.data.api.RetrofitClient
import live.shouldiholdoff.holdoff.data.api.AuthRequest

class AuthRepository(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "holdoff_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var authToken: String?
        get() = prefs.getString("auth_token", null)
        set(value) = prefs.edit().putString("auth_token", value).apply()

    var userId: String?
        get() = prefs.getString("user_id", null)
        set(value) = prefs.edit().putString("user_id", value).apply()

    var userEmail: String?
        get() = prefs.getString("user_email", null)
        set(value) = prefs.edit().putString("user_email", value).apply()

    var subscriptionStatus: String
        get() = prefs.getString("sub_status", "free") ?: "free"
        set(value) = prefs.edit().putString("sub_status", value).apply()

    val isSignedIn: Boolean get() = authToken != null

    val isPremium: Boolean get() = subscriptionStatus in listOf("trial", "active")

    suspend fun signInWithGoogle(idToken: String): Result<Unit> {
        return try {
            val response = RetrofitClient.api.signInWithGoogle(AuthRequest(idToken))
            authToken = "Bearer ${response.token}"
            userId = response.userId
            userEmail = response.email
            subscriptionStatus = response.subscriptionStatus
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun signOut() {
        prefs.edit()
            .remove("auth_token")
            .remove("user_id")
            .remove("user_email")
            .remove("sub_status")
            .apply()
    }
}
