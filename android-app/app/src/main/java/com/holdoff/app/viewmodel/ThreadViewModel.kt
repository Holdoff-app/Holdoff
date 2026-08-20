package com.holdoff.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.holdoff.app.data.model.Message
import com.holdoff.app.data.model.Verdict
import com.holdoff.app.data.model.VerdictResult
import com.holdoff.app.data.repository.SMSRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ThreadUiState(
    val messages: List<Message> = emptyList(),
    val contactName: String = "",
    val isLoading: Boolean = true,
    val verdict: VerdictResult? = null,
    val isAnalyzing: Boolean = false,
    val draftMessage: String = "",
    val error: String? = null
)

class ThreadViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = SMSRepository(application)

    private val _state = MutableStateFlow(ThreadUiState())
    val state: StateFlow<ThreadUiState> = _state

    fun loadThread(threadId: String, contactName: String) {
        viewModelScope.launch {
            try {
                _state.value = _state.value.copy(isLoading = true, contactName = contactName)
                val msgs = repo.getMessagesForThread(threadId)
                _state.value = _state.value.copy(messages = msgs, isLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    /** TODO: call api.smsholdoff.com/api/analyze — for now returns a stub. */
    fun analyzeThread(threadId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isAnalyzing = true)
            delay(2000)
            val verdict = VerdictResult(
                threadId = threadId,
                verdict = Verdict.HOLD_OFF,
                confidence = 0.78f,
                reasoning = "This conversation shows signs of emotional pressure. Give it 24 hours before sending.",
                patternInsights = listOf(
                    "Rapid back-to-back messages detected",
                    "Response time gap is increasing",
                    "Anxious attachment pattern emerging"
                ),
                suggestedResponse = null  // premium only
            )
            _state.value = _state.value.copy(isAnalyzing = false, verdict = verdict)
        }
    }

    fun updateDraft(text: String) {
        _state.value = _state.value.copy(draftMessage = text)
    }
}
