package com.holdoff.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.holdoff.app.data.model.VerdictResult
import com.holdoff.app.data.network.HoldOffApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class DraftUiState(
    val draft: String = "",
    val isAnalyzing: Boolean = false,
    val verdict: VerdictResult? = null,
    val error: String? = null
)

/**
 * Holds the one draft the user is currently deciding about. The draft lives in
 * memory for the length of the decision and is never written to disk.
 */
class DraftViewModel : ViewModel() {

    private val _state = MutableStateFlow(DraftUiState())
    val state: StateFlow<DraftUiState> = _state

    fun updateDraft(text: String) {
        _state.value = _state.value.copy(draft = text, error = null)
    }

    fun analyze() {
        val draft = _state.value.draft.trim()
        if (draft.isEmpty() || _state.value.isAnalyzing) return

        viewModelScope.launch {
            _state.value = _state.value.copy(isAnalyzing = true, error = null, verdict = null)
            HoldOffApi.analyzeDraft(draft)
                .onSuccess { _state.value = _state.value.copy(isAnalyzing = false, verdict = it) }
                .onFailure {
                    _state.value = _state.value.copy(
                        isAnalyzing = false,
                        error = it.message ?: "Something went wrong. Try again."
                    )
                }
        }
    }

    /** Used by ProcessTextActivity, which arrives with the draft already in hand. */
    fun analyze(text: String) {
        _state.value = _state.value.copy(draft = text)
        analyze()
    }

    fun clear() {
        _state.value = DraftUiState()
    }
}
