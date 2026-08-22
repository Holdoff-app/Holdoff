package com.example.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * HoldOff AI client.
 *
 * IMPORTANT: The app NEVER holds a Gemini/AI API key. All AI calls go to the
 * HoldOff backend proxy, which holds the key server-side and forwards the
 * request to the model. This satisfies the "no secret in client code" rule and
 * removes the old "Please set your GEMINI_API_KEY" failure.
 *
 * Backend contract:
 *   POST {BASE_URL}analyze   body: { "prompt": "...", "systemInstruction": "..." }
 *                            -> { "text": "..." }  (or { "error": "..." })
 *   POST {BASE_URL}music     body: { "prompt": "..." }
 *                            -> { "mimeType": "...", "data": "<base64>" } (or { "error": "..." })
 */

@Serializable
data class AnalyzeRequest(
    val prompt: String,
    val systemInstruction: String? = null
)

@Serializable
data class AnalyzeResponse(
    val text: String? = null,
    val error: String? = null
)

// Kept for audio/music feature compatibility (com.example.api.InlineData).
@Serializable
data class InlineData(
    val mimeType: String,
    val data: String
)

@Serializable
data class MusicResponse(
    val mimeType: String? = null,
    val data: String? = null,
    val error: String? = null
)

interface HoldOffBackendService {
    @POST("analyze")
    suspend fun analyze(@Body request: AnalyzeRequest): AnalyzeResponse

    @POST("music")
    suspend fun music(@Body request: AnalyzeRequest): MusicResponse
}

object RetrofitClient {
    // HoldOff backend proxy. Holds the AI key server-side; no key in the app.
    private const val BASE_URL = "https://api.smsholdoff.com/"

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    val service: HoldOffBackendService by lazy {
        val json = Json { ignoreUnknownKeys = true }
        val retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
        retrofit.create(HoldOffBackendService::class.java)
    }
}

suspend fun analyzeWithGemini(prompt: String, systemInstruction: String? = null): String = withContext(Dispatchers.IO) {
    try {
        val response = RetrofitClient.service.analyze(AnalyzeRequest(prompt, systemInstruction))
        response.text
            ?: response.error?.let { "Error: $it" }
            ?: "No response text"
    } catch (e: Exception) {
        "Error: ${e.message}"
    }
}

suspend fun generateMusic(prompt: String): InlineData? = withContext(Dispatchers.IO) {
    try {
        val response = RetrofitClient.service.music(AnalyzeRequest(prompt))
        val mime = response.mimeType
        val data = response.data
        if (mime != null && data != null) InlineData(mime, data) else null
    } catch (e: Exception) {
        null
    }
}
