package live.shouldiholdoff.holdoff

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import live.shouldiholdoff.holdoff.data.api.CompanionRequest
import live.shouldiholdoff.holdoff.data.api.RetrofitClient
import live.shouldiholdoff.holdoff.data.db.AppDatabase
import live.shouldiholdoff.holdoff.data.repositories.AuthRepository
import live.shouldiholdoff.holdoff.data.repositories.SMSRepository
import live.shouldiholdoff.holdoff.domain.analysis.MessageAnalyzer
import live.shouldiholdoff.holdoff.domain.analysis.RelationshipAnalyzer
import live.shouldiholdoff.holdoff.domain.models.CompanionMessage
import live.shouldiholdoff.holdoff.domain.models.SMSThread
import live.shouldiholdoff.holdoff.domain.models.User
import live.shouldiholdoff.holdoff.domain.quiz.QuizResult
import live.shouldiholdoff.holdoff.domain.spiral.SpiralLock
import live.shouldiholdoff.holdoff.domain.spiral.SpiralState
import live.shouldiholdoff.holdoff.domain.verdict.LocalVerdictResult
import live.shouldiholdoff.holdoff.domain.verdict.VerdictInterpreter
import live.shouldiholdoff.holdoff.domain.verdict.VerdictSignals
import java.util.Calendar

data class AppUiState(
    val threads: List<SMSThread> = emptyList(),
    val companionMessages: List<CompanionMessage> = emptyList(),
    val user: User? = null,
    val isLoadingThreads: Boolean = false,
    val isCompanionLoading: Boolean = false,
    val selectedThread: SMSThread? = null,
    val isAnalyzingThread: Boolean = false,
    val error: String? = null,
    // Spiral lock state — exposed so UI can show countdown
    val spiralState: SpiralState = SpiralState.Idle,
    // Local pre-flight verdict before API call
    val localVerdict: LocalVerdictResult? = null,
    // Paywall gate — number of analyses used in this session
    val localVerdictCount: Int = 0,
    val showPaywall: Boolean = false,
    // Quiz result
    val quizResult: QuizResult? = null,
    // Companion disclosure acknowledged
    val companionDisclosureAcknowledged: Boolean = false
)

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val db          = AppDatabase.getDatabase(application)
    private val smsRepo     = SMSRepository(application)
    private val authRepo    = AuthRepository(application)
    private val spiralLock  = SpiralLock()

    private val _uiState = MutableStateFlow(AppUiState())
    val uiState: StateFlow<AppUiState> = _uiState.asStateFlow()

    init {
        loadCachedThreads()
        loadUser()
        // Reflect spiral lock state changes into UI state
        viewModelScope.launch {
            spiralLock.state.collect { spiralState ->
                _uiState.value = _uiState.value.copy(spiralState = spiralState)
            }
        }
    }

    // ── Threads ────────────────────────────────────────────────────────────────

    fun loadThreads() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingThreads = true)
            try {
                val threads = smsRepo.readThreads()
                if (threads.isNotEmpty()) {
                    db.threadDao().upsertThreads(threads)
                }
                val allThreads = db.threadDao().getAllThreads()
                _uiState.value = _uiState.value.copy(
                    threads = allThreads,
                    isLoadingThreads = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoadingThreads = false,
                    error = e.message
                )
            }
        }
    }

    private fun loadCachedThreads() {
        viewModelScope.launch {
            val cached = db.threadDao().getAllThreads()
            _uiState.value = _uiState.value.copy(threads = cached)
        }
    }

    fun selectThread(thread: SMSThread) {
        _uiState.value = _uiState.value.copy(selectedThread = thread, isAnalyzingThread = true)
        // Run local MessageAnalyzer pre-flight on the last message
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val localAnalysis = MessageAnalyzer.analyze(thread.lastMessage, hour, 0)
        analyzeThread(thread)
    }

    fun clearSelectedThread() {
        _uiState.value = _uiState.value.copy(selectedThread = null, localVerdict = null)
    }

    /**
     * Run a local pre-flight verdict on a draft text before calling the API.
     * Shows [LocalVerdictResult] immediately; paywall fires if over free limit.
     */
    fun runLocalVerdict(draftText: String, minutesSinceTheirReply: Long = 0) {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val signals = VerdictSignals(
            draftText = draftText,
            recentSendsLastHour = 0,
            minutesSinceTheirReply = minutesSinceTheirReply,
            hourOfDay = hour,
            recentSpiralCount = 0
        )
        val localVerdict = VerdictInterpreter.interpret(signals)

        // Engage spiral lock if HOLD_OFF
        if (localVerdict.kind == live.shouldiholdoff.holdoff.domain.verdict.VerdictKind.HOLD_OFF) {
            spiralLock.engage()
        }

        // Check paywall gate (3 free analyses)
        val newCount = _uiState.value.localVerdictCount + 1
        val showPaywall = newCount > live.shouldiholdoff.holdoff.billing.BillingManager.FREE_VERDICT_LIMIT && !isPremium

        _uiState.value = _uiState.value.copy(
            localVerdict = localVerdict,
            localVerdictCount = newCount,
            showPaywall = showPaywall
        )
    }

    /**
     * Run per-contact RelationshipAnalyzer against cached thread messages.
     */
    fun analyzeRelationship(thread: SMSThread) {
        viewModelScope.launch {
            // For now use the last message as a single-message sample —
            // full analysis requires message history which arrives via sync.
            val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
            val userMsg = MessageAnalyzer.analyze(thread.lastMessage, hour, 0)
            val rel = RelationshipAnalyzer.analyze(
                partnerName = thread.contactName,
                userMessages = listOf(userMsg),
                partnerMessages = emptyList(),
                spiralDays30 = 0,
                healthyDays30 = 0
            )
            val insight = "${rel.sadieInsight} ${rel.danInsight}"
            db.threadDao().updateVerdict(
                id = thread.threadId,
                verdict = thread.verdict,
                score = thread.verdictScore,
                insight = insight
            )
            val updated = db.threadDao().getThread(thread.threadId)
            _uiState.value = _uiState.value.copy(selectedThread = updated)
        }
    }

    fun dismissPaywall() {
        _uiState.value = _uiState.value.copy(showPaywall = false)
    }

    // ── Quiz ──────────────────────────────────────────────────────────────────

    fun saveQuizResult(result: QuizResult) {
        _uiState.value = _uiState.value.copy(quizResult = result)
    }

    // ── Companion disclosure ──────────────────────────────────────────────────

    fun acknowledgeCompanionDisclosure() {
        _uiState.value = _uiState.value.copy(companionDisclosureAcknowledged = true)
    }

    // ── Spiral lock helpers ───────────────────────────────────────────────────

    fun tickSpiralLock() = spiralLock.tick()

    fun releaseSpiralLock() = spiralLock.release(live.shouldiholdoff.holdoff.domain.spiral.ReleaseReason.MANUAL_OVERRIDE)

    private fun analyzeThread(thread: SMSThread) {
        viewModelScope.launch {
            try {
                val result = RetrofitClient.api.analyze(
                    request = live.shouldiholdoff.holdoff.data.api.AnalyzeRequest(
                        message = thread.lastMessage,
                        contactName = thread.contactName
                    ),
                    token = authRepo.authToken ?: ""
                )
                db.threadDao().updateVerdict(
                    id = thread.threadId,
                    verdict = result.verdict,
                    score = result.score,
                    insight = result.insight
                )
                val updated = db.threadDao().getThread(thread.threadId)
                _uiState.value = _uiState.value.copy(
                    selectedThread = updated,
                    isAnalyzingThread = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isAnalyzingThread = false)
            }
        }
    }

    // ── Companion ──────────────────────────────────────────────────────────────

    fun loadCompanionMessages() {
        viewModelScope.launch {
            val messages = db.companionDao().getAllMessages()
            _uiState.value = _uiState.value.copy(companionMessages = messages)
        }
    }

    fun sendCompanionMessage(text: String) {
        viewModelScope.launch {
            val userMsg = CompanionMessage(role = "user", content = text)
            db.companionDao().insertMessage(userMsg)
            val current = db.companionDao().getAllMessages()
            _uiState.value = _uiState.value.copy(
                companionMessages = current,
                isCompanionLoading = true
            )

            try {
                val history = current.takeLast(10).map { msg ->
                    mapOf("role" to msg.role, "content" to msg.content)
                }
                val response = RetrofitClient.api.companion(
                    request = CompanionRequest(
                        message = text,
                        conversationHistory = history,
                        userId = authRepo.userId ?: ""
                    ),
                    token = authRepo.authToken ?: ""
                )
                val assistantMsg = CompanionMessage(
                    role = "assistant",
                    content = response.reply,
                    mood = response.mood
                )
                db.companionDao().insertMessage(assistantMsg)
                db.companionDao().pruneOldMessages()
                val updated = db.companionDao().getAllMessages()
                _uiState.value = _uiState.value.copy(
                    companionMessages = updated,
                    isCompanionLoading = false
                )
            } catch (e: Exception) {
                val errorMsg = CompanionMessage(
                    role = "assistant",
                    content = "I'm having a little trouble connecting right now. Try again in a moment? 💜"
                )
                db.companionDao().insertMessage(errorMsg)
                val updated = db.companionDao().getAllMessages()
                _uiState.value = _uiState.value.copy(
                    companionMessages = updated,
                    isCompanionLoading = false
                )
            }
        }
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    private fun loadUser() {
        if (authRepo.isSignedIn) {
            _uiState.value = _uiState.value.copy(
                user = User(
                    userId = authRepo.userId ?: "",
                    email = authRepo.userEmail ?: "",
                    displayName = authRepo.userEmail?.substringBefore("@") ?: "User",
                    subscriptionStatus = authRepo.subscriptionStatus
                )
            )
        }
    }

    suspend fun signInWithGoogle(idToken: String): Result<Unit> {
        val result = authRepo.signInWithGoogle(idToken)
        if (result.isSuccess) loadUser()
        return result
    }

    fun signOut() {
        authRepo.signOut()
        _uiState.value = _uiState.value.copy(user = null)
    }

    val isPremium get() = authRepo.isPremium
    val authToken get() = authRepo.authToken
}
