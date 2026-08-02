package com.holdoff.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.holdoff.app.data.model.Message
import com.holdoff.app.data.model.Verdict
import com.holdoff.app.data.model.VerdictResult
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.data.repository.SMSRepository
import com.holdoff.app.data.sms.DefaultSmsRole
import com.holdoff.app.data.sms.SmsSender
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * What stands between the draft and the wire.
 *
 * [Unchecked] exists so a failed analysis is neither a silent block nor a silent send — the
 * user is told we could not check it and chooses.
 */
sealed interface SendGate {
    data object None : SendGate
    data class Held(val verdict: VerdictResult, val holdUntilMillis: Long) : SendGate
    data class Unchecked(val reason: String) : SendGate
}

data class ThreadUiState(
    val messages: List<Message> = emptyList(),
    val contactName: String = "",
    val address: String = "",
    val isLoading: Boolean = true,
    val verdict: VerdictResult? = null,
    val isAnalyzing: Boolean = false,
    val isSending: Boolean = false,
    val gate: SendGate = SendGate.None,
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
                val address = repo.getAddressForThread(threadId)
                _state.value = _state.value.copy(
                    messages = msgs, address = address, isLoading = false
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    /**
     * Sends the current draft to the analyser and surfaces a real verdict.
     *
     * On failure this sets [ThreadUiState.error] and leaves [ThreadUiState.verdict] null.
     * It must never invent a verdict: users decide whether to send based on this.
     */
    fun analyzeThread(threadId: String) {
        viewModelScope.launch {
            val draft = _state.value.draftMessage
            if (draft.isBlank()) {
                _state.value = _state.value.copy(error = "Type your message first")
                return@launch
            }
            _state.value = _state.value.copy(isAnalyzing = true, error = null, verdict = null)
            val result = analyze(threadId, draft)
            _state.value = _state.value.copy(
                isAnalyzing = false,
                verdict = result.verdict,
                error = result.error
            )
        }
    }

    /**
     * The product. Pressing send does not send — it asks first, and a HOLD_OFF verdict starts a
     * countdown instead of putting the message on the wire.
     *
     * The override in [sendAnyway] is deliberate and always available. HoldOff is the user's
     * default messaging app; trapping a message they have decided to send is a worse failure
     * than letting through one they regret.
     */
    fun sendOrHold(threadId: String) {
        viewModelScope.launch {
            val draft = _state.value.draftMessage
            if (draft.isBlank()) {
                _state.value = _state.value.copy(error = "Type your message first")
                return@launch
            }
            _state.value = _state.value.copy(isAnalyzing = true, error = null, gate = SendGate.None)

            val result = analyze(threadId, draft)
            _state.value = _state.value.copy(isAnalyzing = false, verdict = result.verdict)

            val verdict = result.verdict
            when {
                verdict == null -> _state.value = _state.value.copy(
                    gate = SendGate.Unchecked(result.error ?: "Could not reach the analyser")
                )
                verdict.verdict == Verdict.HOLD_OFF -> _state.value = _state.value.copy(
                    gate = SendGate.Held(
                        verdict = verdict,
                        holdUntilMillis = System.currentTimeMillis() + HOLD_DURATION_MILLIS
                    )
                )
                else -> deliver(threadId)
            }
        }
    }

    /** Override the gate. Always permitted; the countdown is friction, not a lock. */
    fun sendAnyway(threadId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(gate = SendGate.None)
            deliver(threadId)
        }
    }

    /** Back out of sending. The draft is kept so nothing the user wrote is lost. */
    fun dismissGate() {
        _state.value = _state.value.copy(gate = SendGate.None)
    }

    fun updateDraft(text: String) {
        _state.value = _state.value.copy(draftMessage = text)
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }

    private suspend fun analyze(threadId: String, draft: String): HoldOffApi.AnalyzeResult {
        val transcript = _state.value.messages.map {
            (if (it.isOutgoing) "You: " else "Them: ") + it.body
        }
        return HoldOffApi.analyzeDraft(
            threadId = threadId,
            recentMessages = transcript,
            draft = draft,
            attachmentStyle = HoldOffApi.getAttachmentStyle(getApplication())
        )
    }

    private suspend fun deliver(threadId: String) {
        val context = getApplication<Application>()
        val draft = _state.value.draftMessage
        val address = _state.value.address

        if (address.isBlank()) {
            _state.value = _state.value.copy(error = "No number for this conversation")
            return
        }
        if (!DefaultSmsRole.isDefault(context)) {
            _state.value = _state.value.copy(
                error = "Make HoldOff your default messaging app to send from here"
            )
            return
        }

        _state.value = _state.value.copy(isSending = true)
        val sent = SmsSender.send(context, address, draft)
        if (sent.ok) {
            _state.value = _state.value.copy(
                isSending = false, draftMessage = "", verdict = null, gate = SendGate.None
            )
            loadThread(threadId, _state.value.contactName)
        } else {
            _state.value = _state.value.copy(isSending = false, error = sent.error)
        }
    }

    private companion object {
        /**
         * Unvalidated. Long enough to break the impulse, short enough that a user waits it out
         * rather than uninstalls. Needs real usage data and should become a user setting.
         */
        const val HOLD_DURATION_MILLIS = 10 * 60 * 1000L
    }
}
