package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.holdoff.app.ui.components.SadieAvatar
import com.holdoff.app.ui.components.SadieSize
import com.holdoff.app.ui.theme.*
import com.holdoff.app.viewmodel.ChatMessage
import com.holdoff.app.viewmodel.CompanionViewModel

/** Sadie & Dan — your AI companions with selectable attachment styles. */
@Composable
fun CompanionScreen(
    onBack: () -> Unit,
    onUpgradeClick: () -> Unit,
    isPremium: Boolean,
    vm: CompanionViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    val listState = rememberLazyListState()

    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.size - 1)
    }

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        SadieAvatar(size = SadieSize.SMALL, isThinking = state.isTyping)
                        Column {
                            Text(
                                when (state.activeCompanion) {
                                    "dan" -> "Dan \uD83D\uDC99"
                                    else -> "Sadie \uD83D\uDC9C"
                                },
                                fontWeight = FontWeight.Bold, color = OnDarkText
                            )
                            Text(
                                if (state.isTyping) "typing\u2026"
                                else state.activeStyleLabel,
                                fontSize = 12.sp, color = OnDarkTextMuted
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = SoftLavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepPurple)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // Soul selector — Sadie & Dan
            Row(
                modifier = Modifier.fillMaxWidth().background(SurfaceVariant).padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("sadie" to "Sadie \uD83D\uDC9C", "dan" to "Dan \uD83D\uDC99").forEach { (id, label) ->
                    FilterChip(
                        selected = state.activeCompanion == id,
                        onClick = {
                            if (id == "dan" && !isPremium) onUpgradeClick()
                            else vm.switchCompanion(id)
                        },
                        label = { Text(label, fontSize = 13.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = if (id == "dan") RoyalPurple else VelvetPurple,
                            selectedLabelColor = OnDarkText
                        )
                    )
                }
            }

            // Attachment style picker
            if (isPremium) {
                Column(
                    modifier = Modifier.fillMaxWidth()
                        .background(DeepPurple.copy(alpha = 0.5f))
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Text(
                        "Attachment state \u00B7 how ${if (state.activeCompanion == "dan") "Dan" else "Sadie"} shows up",
                        fontSize = 11.sp, color = OnDarkTextMuted
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        val styles = listOf(
                            "secure" to "Secure",
                            "anxious" to "Anxious",
                            "dismissive_avoidant" to "Dismissive",
                            "fearful_avoidant" to "Fearful"
                        )
                        val coreStyle = if (state.activeCompanion == "dan") "dismissive_avoidant" else "fearful_avoidant"
                        styles.forEach { (key, label) ->
                            FilterChip(
                                selected = state.activeStyle == key,
                                onClick = { vm.switchStyle(key) },
                                label = {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(label, fontSize = 11.sp)
                                        if (key == coreStyle) {
                                            Text("core", fontSize = 9.sp, color = GlowPurple, fontStyle = FontStyle.Italic)
                                        }
                                    }
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = GlowPurple.copy(alpha = 0.3f),
                                    selectedLabelColor = OnDarkText,
                                    labelColor = OnDarkTextMuted
                                ),
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.messages, key = { it.id }) { CompanionChatBubble(it) }
                if (state.isTyping) {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            SadieAvatar(size = SadieSize.SMALL, isThinking = true)
                            Box(modifier = Modifier.clip(RoundedCornerShape(16.dp)).background(SurfaceVariant).padding(12.dp)) {
                                Text("\u2026", color = OnDarkTextMuted)
                            }
                        }
                    }
                }
            }

            Surface(color = DeepPurple) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = state.inputText,
                        onValueChange = vm::updateInput,
                        modifier = Modifier.weight(1f),
                        placeholder = {
                            Text(
                                "Talk to ${if (state.activeCompanion == "dan") "Dan" else "Sadie"}\u2026",
                                color = OnDarkTextMuted
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GlowPurple,
                            unfocusedBorderColor = DividerColor,
                            focusedTextColor = OnDarkText,
                            unfocusedTextColor = OnDarkText
                        ),
                        maxLines = 5
                    )
                    IconButton(
                        onClick = { vm.sendMessage(state.inputText) },
                        enabled = state.inputText.isNotBlank(),
                        colors = IconButtonDefaults.iconButtonColors(containerColor = VelvetPurple)
                    ) { Icon(Icons.AutoMirrored.Filled.Send, "Send", tint = OnDarkText) }
                }
            }
        }
    }
}

@Composable
private fun CompanionChatBubble(m: ChatMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (m.isFromCompanion) Arrangement.Start else Arrangement.End,
        verticalAlignment = Alignment.Bottom
    ) {
        if (m.isFromCompanion) {
            SadieAvatar(size = SadieSize.SMALL)
            Spacer(Modifier.width(8.dp))
        }
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(RoundedCornerShape(
                    topStart = 16.dp, topEnd = 16.dp,
                    bottomStart = if (m.isFromCompanion) 4.dp else 16.dp,
                    bottomEnd = if (m.isFromCompanion) 16.dp else 4.dp
                ))
                .background(
                    if (m.isFromCompanion) Brush.horizontalGradient(listOf(SurfaceVariant, RoyalPurple))
                    else Brush.horizontalGradient(listOf(VelvetPurple, GlowPurple))
                )
                .padding(14.dp)
        ) {
            Text(m.text, color = OnDarkText, fontSize = 14.sp, lineHeight = 20.sp)
        }
    }
}
