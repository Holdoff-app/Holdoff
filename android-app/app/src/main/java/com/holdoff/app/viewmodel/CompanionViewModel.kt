package com.holdoff.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.holdoff.app.data.network.HoldOffApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.UUID

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val text: String,
    val isFromCompanion: Boolean,
    val timestamp: Long = System.currentTimeMillis()
)

data class CompanionUiState(
    val messages: List<ChatMessage> = emptyList(),
    val activeCompanion: String = "sadie",   // "sadie" | "dan"
    val activeStyle: String = "fearful_avoidant",
    val activeStyleLabel: String = "fearful avoidant · core",
    val isTyping: Boolean = false,
    val inputText: String = "",
    val errorMessage: String? = null
)

private val STYLE_LABELS = mapOf(
    "secure" to "Secure",
    "anxious" to "Anxious-preoccupied",
    "dismissive_avoidant" to "Dismissive-avoidant",
    "fearful_avoidant" to "Fearful-avoidant"
)

private val QUIZ_TO_COMPANION_STYLE = mapOf(
    "ANX" to "anxious",
    "AVO" to "dismissive_avoidant",
    "FA"  to "fearful_avoidant",
    "SEC" to "secure"
)

class CompanionViewModel(application: Application) : AndroidViewModel(application) {

    private val ctx = application.applicationContext

    /**
     * The user's own attachment style, from the quiz. Null until they take it.
     *
     * Distinct from [CompanionUiState.activeStyle], which is how the *companion* shows up.
     * These were the same value before, so the companion's persona was being sent to the model
     * as a description of the user.
     */
    private val userStyle: String? = QUIZ_TO_COMPANION_STYLE[HoldOffApi.getAttachmentStyle(ctx)]

    private val _state = MutableStateFlow(
        CompanionUiState(
            activeStyle = coreStyle("sadie"),
            activeStyleLabel = styleLabel(coreStyle("sadie"), "sadie"),
            messages = listOf(
                ChatMessage(
                    text = "Hey love. I\u2019m Sadie. \uD83D\uDC9C  I see patterns in your conversations that you might be missing. What\u2019s going on?",
                    isFromCompanion = true
                )
            )
        )
    )
    val state: StateFlow<CompanionUiState> = _state

    private fun coreStyle(companion: String) =
        if (companion == "dan") "dismissive_avoidant" else "fearful_avoidant"

    private fun styleLabel(style: String, companion: String): String {
        val label = STYLE_LABELS[style] ?: style
        val isCore = style == coreStyle(companion)
        return if (isCore) "$label \u00B7 core" else label
    }

    fun sendMessage(text: String) {
        if (text.isBlank()) return
        val userMsg = ChatMessage(text = text, isFromCompanion = false)
        _state.value = _state.value.copy(
            messages = _state.value.messages + userMsg,
            inputText = "",
            isTyping = true,
            errorMessage = null
        )

        viewModelScope.launch {
            val soulName = if (_state.value.activeCompanion == "dan") "Dan" else "Sadie"

            val history = _state.value.messages
                .filter { it.id != userMsg.id }
                .map { msg -> Pair(if (msg.isFromCompanion) "assistant" else "user", msg.text) }

            val result = HoldOffApi.companionChat(
                ctx = ctx,
                soulName = soulName,
                message = text,
                history = history,
                attachmentStyle = userStyle
            )

            // A failure must never be dressed up as something the companion said. Showing
            // "lost my train of thought" made a dead backend look like a working chat.
            _state.value = if (result.reply != null) {
                _state.value.copy(
                    messages = _state.value.messages + ChatMessage(
                        text = result.reply,
                        isFromCompanion = true
                    ),
                    isTyping = false
                )
            } else {
                _state.value.copy(
                    isTyping = false,
                    errorMessage = result.error ?: "Could not reach $soulName"
                )
            }
        }
    }

    fun updateInput(text: String) { _state.value = _state.value.copy(inputText = text) }

    fun clearError() { _state.value = _state.value.copy(errorMessage = null) }

    /** Re-send the last thing the user said, after a failure. */
    fun retryLast() {
        val last = _state.value.messages.lastOrNull { !it.isFromCompanion } ?: return
        _state.value = _state.value.copy(
            messages = _state.value.messages.filterNot { it.id == last.id },
            errorMessage = null
        )
        sendMessage(last.text)
    }

    fun switchCompanion(id: String) {
        val style = coreStyle(id)
        val greeting = when (id) {
            "dan"  -> "What\u2019s going on. I\u2019m listening."
            else   -> "Hey love. I\u2019m Sadie. \uD83D\uDC9C  I see patterns in your conversations that you might be missing. What\u2019s going on?"
        }
        _state.value = CompanionUiState(
            activeCompanion = id,
            activeStyle = style,
            activeStyleLabel = styleLabel(style, id),
            messages = listOf(ChatMessage(text = greeting, isFromCompanion = true))
        )
    }

    fun switchStyle(styleKey: String) {
        val companion = _state.value.activeCompanion
        _state.value = _state.value.copy(
            activeStyle = styleKey,
            activeStyleLabel = styleLabel(styleKey, companion)
        )
    }
}
