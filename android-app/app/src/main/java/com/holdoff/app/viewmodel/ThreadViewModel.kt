package com.holdoff.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.holdoff.app.data.model.Message
import com.holdoff.app.data.model.Verdict
import com.holdoff.app.data.model.VerdictResult
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.data.repository.SMSRepository
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

    /**
     * Analyze the loaded thread by sending the full message history to Sadie.
     * Passes all loaded messages as threadHistory (up to 30) so the AI has
     * the full relationship context, not just a single message.
     */
    fun analyzeThread(threadId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isAnalyzing = true, error = null)
            try {
                // Build thread history from the messages already loaded in state
                val threadHistory = _state.value.messages.map { msg ->
                    mapOf(
                        "direction" to if (msg.isOutgoing) "sent" else "received",
                        "body"      to msg.body,
                        "timestamp" to msg.timestamp
                    )
                }

                // Use last outgoing message as the "draft" for the verdict endpoint,
                // or the most recent message if there is no outgoing message
                val draftText = _state.value.draftMessage.takeIf { it.isNotBlank() }
                    ?: _state.value.messages.lastOrNull { it.isOutgoing }?.body
                    ?: _state.value.messages.lastOrNull()?.body
                    ?: ""

                val apiResult = HoldOffApi.analyzeMessages(
                    ctx           = getApplication(),
                    messageText   = draftText,
                    threadHistory = threadHistory
                )

                val verdict = VerdictResult(
                    threadId        = threadId,
                    verdict         = when (apiResult.optString("verdict", "HOLD")) {
                        "SEND"    -> Verdict.REACH_OUT
                        "REWRITE" -> Verdict.MAYBE
                        else      -> Verdict.HOLD_OFF
                    },
                    confidence      = apiResult.optDouble("confidence", 0.75).toFloat(),
                    reasoning       = apiResult.optString("feedback_text",
                        apiResult.optString("reasoning", "Review before sending.")),
                    patternInsights = buildList {
                        apiResult.optString("attachmentPattern").takeIf { it.isNotBlank() }?.let {
                            add("Attachment pattern: $it")
                        }
                        apiResult.optString("safetyLevel").takeIf { it.isNotBlank() }?.let {
                            add("Safety level: $it")
                        }
                    },
                    suggestedResponse = apiResult.optString("rewrite").takeIf { it.isNotBlank() }
                )
                _state.value = _state.value.copy(isAnalyzing = false, verdict = verdict)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isAnalyzing = false,
                    error = "Sadie couldn't reach the server. Try again in a moment."
                )
            }
        }
    }

    fun updateDraft(text: String) {
        _state.value = _state.value.copy(draftMessage = text)
    }
}
