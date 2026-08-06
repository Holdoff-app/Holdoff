package live.shouldiholdoff.holdoff.data.api

import live.shouldiholdoff.holdoff.domain.models.VerdictResult
import retrofit2.http.*

// ── Request / Response DTOs ───────────────────────────────────────────────────
data class AnalyzeRequest(
    val message: String,
    val contactName: String = "",
    val conversationHistory: List<Map<String, String>> = emptyList()
)

data class CompanionRequest(
    val message: String,
    val conversationHistory: List<Map<String, String>> = emptyList(),
    val userId: String = ""
)

data class CompanionResponse(
    val reply: String,
    val mood: String = "neutral",
    val suggestion: String = ""
)

data class SyncThreadRequest(
    val threads: List<Map<String, Any>>,
    val lastSyncAt: Long = 0L
)

data class AuthRequest(val idToken: String)

data class AuthResponse(
    val token: String,
    val userId: String,
    val email: String,
    val subscriptionStatus: String
)

data class RedeemRequest(val code: String)

// ── API Interface ─────────────────────────────────────────────────────────────
interface HoldOffApi {

    @POST("api/analyze")
    @Headers("Content-Type: application/json")
    suspend fun analyze(
        @Body request: AnalyzeRequest,
        @Header("Authorization") token: String = ""
    ): VerdictResult

    @POST("api/message/companion")
    @Headers("Content-Type: application/json")
    suspend fun companion(
        @Body request: CompanionRequest,
        @Header("Authorization") token: String = ""
    ): CompanionResponse

    @POST("api/auth/google")
    @Headers("Content-Type: application/json")
    suspend fun signInWithGoogle(@Body request: AuthRequest): AuthResponse

    @POST("api/sync/threads")
    @Headers("Content-Type: application/json")
    suspend fun syncThreads(
        @Body request: SyncThreadRequest,
        @Header("Authorization") token: String
    ): Map<String, Any>

    @GET("api/subscription/status")
    suspend fun getSubscriptionStatus(
        @Header("Authorization") token: String
    ): Map<String, Any>

    @POST("api/redeem")
    @Headers("Content-Type: application/json")
    suspend fun redeemCode(
        @Body request: RedeemRequest,
        @Header("Authorization") token: String
    ): Map<String, Any>
}

// ── Retrofit Client ───────────────────────────────────────────────────────────
object RetrofitClient {
    private const val BASE_URL = "https://shouldiholdoff.live/"

    val api: HoldOffApi by lazy {
        retrofit2.Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(retrofit2.converter.gson.GsonConverterFactory.create())
            .client(
                okhttp3.OkHttpClient.Builder()
                    .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                    .addInterceptor(okhttp3.logging.HttpLoggingInterceptor().apply {
                        level = okhttp3.logging.HttpLoggingInterceptor.Level.BASIC
                    })
                    .build()
            )
            .build()
            .create(HoldOffApi::class.java)
    }
}
