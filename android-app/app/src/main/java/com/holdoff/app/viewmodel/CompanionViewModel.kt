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

    private val savedStyle: String = run {
        val quizResult = HoldOffApi.getAttachmentStyle(ctx)
        QUIZ_TO_COMPANION_STYLE[quizResult] ?: "fearful_avoidant"
    }

    private val _state = MutableStateFlow(
        CompanionUiState(
            activeStyle = savedStyle,
            activeStyleLabel = STYLE_LABELS[savedStyle]?.let {
                if (savedStyle == "fearful_avoidant") "$it · core" else it
            } ?: "fearful avoidant · core",
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
                attachmentStyle = _state.value.activeStyle
            )

            if (result.reply != null) {
                _state.value = _state.value.copy(
                    messages = _state.value.messages + ChatMessage(
                        text = result.reply,
                        isFromCompanion = true
                    ),
                    isTyping = false
                )
            } else {
                val fallback = when (soulName) {
                    "Dan"  -> "Something got in the way. Try again?"
                    else   -> "Lost my train of thought \u2014 try again?"
                }
                _state.value = _state.value.copy(
                    messages = _state.value.messages + ChatMessage(
                        text = fallback,
                        isFromCompanion = true
                    ),
                    isTyping = false,
                    errorMessage = result.error
                )
            }
        }
    }

    fun updateInput(text: String) { _state.value = _state.value.copy(inputText = text) }

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
