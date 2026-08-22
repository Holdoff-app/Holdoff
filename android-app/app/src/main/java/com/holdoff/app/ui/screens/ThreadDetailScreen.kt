package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.holdoff.app.data.model.Message
import com.holdoff.app.ui.components.VerdictBadge
import com.holdoff.app.ui.theme.*
import com.holdoff.app.viewmodel.ThreadViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** One SMS thread — messages + draft + 'Analyze' button. */
@Composable
fun ThreadDetailScreen(
    threadId: String,
    onVerdictClick: () -> Unit,
    onBack: () -> Unit,
    vm: ThreadViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    val listState = rememberLazyListState()

    LaunchedEffect(threadId) { vm.loadThread(threadId, "Contact") }
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.size - 1)
    }

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(state.contactName, fontWeight = FontWeight.Bold, color = OnDarkText)
                        state.verdict?.let { VerdictBadge(it.verdict) }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = SoftLavender)
                    }
                },
                actions = {
                    Button(
                        onClick = { vm.analyzeThread(threadId); onVerdictClick() },
                        colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                        modifier = Modifier.padding(end = 8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) { Text("Analyze", fontSize = 12.sp) }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MidnightNavy)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(state.messages) { MessageBubble(it) }
            }
            Surface(color = DeepPurple) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = state.draftMessage,
                        onValueChange = vm::updateDraft,
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Draft a message\u2026", color = OnDarkTextMuted) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GlowPurple,
                            unfocusedBorderColor = DividerColor,
                            focusedTextColor = OnDarkText,
                            unfocusedTextColor = OnDarkText
                        ),
                        maxLines = 4
                    )
                    IconButton(
                        onClick = { vm.analyzeThread(threadId); onVerdictClick() },
                        colors = IconButtonDefaults.iconButtonColors(containerColor = VelvetPurple)
                    ) {
                        Icon(Icons.Default.Psychology, "Ask Sadie", tint = OnDarkText)
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(m: Message) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (m.isOutgoing) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(RoundedCornerShape(
                    topStart = 16.dp, topEnd = 16.dp,
                    bottomStart = if (m.isOutgoing) 16.dp else 4.dp,
                    bottomEnd = if (m.isOutgoing) 4.dp else 16.dp
                ))
                .background(
                    if (m.isOutgoing) Brush.horizontalGradient(listOf(VelvetPurple, GlowPurple))
                    else Brush.horizontalGradient(listOf(SurfaceVariant, RoyalPurple))
                )
                .padding(12.dp)
        ) {
            Column {
                Text(m.body, color = OnDarkText, fontSize = 14.sp)
                Spacer(Modifier.height(4.dp))
                Text(
                    SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(m.timestamp)),
                    color = OnDarkTextMuted, fontSize = 10.sp,
                    modifier = Modifier.align(Alignment.End)
                )
            }
        }
    }
}
