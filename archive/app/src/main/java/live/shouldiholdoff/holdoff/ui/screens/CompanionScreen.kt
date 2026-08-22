package live.shouldiholdoff.holdoff.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import live.shouldiholdoff.holdoff.domain.models.CompanionMessage
import live.shouldiholdoff.holdoff.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanionScreen(
    messages: List<CompanionMessage>,
    isPremium: Boolean,
    isLoading: Boolean,
    onSendMessage: (String) -> Unit,
    onStoryClick: () -> Unit,
    onUpgrade: () -> Unit
) {
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()
    var inputText by remember { mutableStateOf("") }
    var showDisclaimer by remember { mutableStateOf(messages.isEmpty()) }

    // Auto-scroll to bottom on new message
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Column {
                    Text("Sadie", style = MaterialTheme.typography.headlineMedium, color = StarGlow)
                    Text(
                        "Your empathetic AI companion",
                        style = MaterialTheme.typography.bodySmall,
                        color = SoftLavender.copy(alpha = 0.7f)
                    )
                }
            },
            actions = {
                if (isPremium) {
                    TextButton(onClick = onStoryClick) {
                        Text("✨ Your Story", color = StarGlow)
                    }
                } else {
                    TextButton(onClick = onUpgrade) {
                        Text("Upgrade 💜", color = MoonlitViolet)
                    }
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepSpace)
        )

        // Disclaimer banner
        if (showDisclaimer) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                colors = CardDefaults.cardColors(containerColor = TwilightPurple),
                shape = RoundedCornerShape(10.dp)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        "⚠️ Important",
                        style = MaterialTheme.typography.labelMedium,
                        color = WarnAmber
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "Sadie is not a therapist, not a diagnosis tool, and not a substitute for professional mental health care. If you're in crisis, please contact a professional.",
                        style = MaterialTheme.typography.bodySmall,
                        color = SoftLavender.copy(alpha = 0.8f)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    TextButton(onClick = { showDisclaimer = false }) {
                        Text("Got it", color = StarGlow)
                    }
                }
            }
        }

        // Message list
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 16.dp),
            state = listState,
            contentPadding = PaddingValues(vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (messages.isEmpty()) {
                item {
                    WelcomeMessage()
                }
            }
            items(messages, key = { it.id }) { msg ->
                MessageBubble(message = msg)
            }
            if (isLoading) {
                item {
                    TypingIndicator()
                }
            }
        }

        // Input bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                modifier = Modifier.weight(1f),
                placeholder = {
                    Text(
                        "Talk to Sadie...",
                        color = SoftLavender.copy(alpha = 0.4f)
                    )
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = NightBloom,
                    unfocusedBorderColor = TwilightPurple,
                    focusedContainerColor = DuskPurple.copy(alpha = 0.5f),
                    unfocusedContainerColor = DuskPurple.copy(alpha = 0.3f),
                    cursorColor = MoonlitViolet,
                    focusedTextColor = StarlightWhite,
                    unfocusedTextColor = StarlightWhite
                ),
                shape = RoundedCornerShape(24.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = {
                    if (inputText.isNotBlank()) {
                        onSendMessage(inputText.trim())
                        inputText = ""
                    }
                }),
                maxLines = 4
            )

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(
                onClick = {
                    if (inputText.isNotBlank()) {
                        onSendMessage(inputText.trim())
                        inputText = ""
                    }
                },
                enabled = inputText.isNotBlank() && !isLoading
            ) {
                Icon(
                    imageVector = Icons.Default.Send,
                    contentDescription = "Send",
                    tint = if (inputText.isNotBlank()) MoonlitViolet else TwilightPurple
                )
            }
        }
    }
}

@Composable
fun MessageBubble(message: CompanionMessage) {
    val isUser = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        if (!isUser) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .align(Alignment.Bottom),
                contentAlignment = Alignment.Center
            ) {
                Text("🌙", style = MaterialTheme.typography.bodySmall)
            }
            Spacer(modifier = Modifier.width(6.dp))
        }

        Card(
            modifier = Modifier.widthIn(max = 280.dp),
            shape = RoundedCornerShape(
                topStart = if (isUser) 16.dp else 4.dp,
                topEnd = if (isUser) 4.dp else 16.dp,
                bottomStart = 16.dp,
                bottomEnd = 16.dp
            ),
            colors = CardDefaults.cardColors(
                containerColor = if (isUser) NightBloom else DuskPurple
            )
        ) {
            Text(
                text = message.content,
                modifier = Modifier.padding(12.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = StarlightWhite
            )
        }
    }
}

@Composable
fun WelcomeMessage() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("🌙", style = MaterialTheme.typography.displayLarge)
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            "Hi, I'm Sadie",
            style = MaterialTheme.typography.headlineMedium,
            color = StarlightWhite
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            "I'm here to help you pause, reflect, and understand your patterns in love and communication.",
            style = MaterialTheme.typography.bodyMedium,
            color = SoftLavender.copy(alpha = 0.7f),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
    }
}

@Composable
fun TypingIndicator() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("🌙 ", style = MaterialTheme.typography.bodySmall)
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = DuskPurple)
        ) {
            Text(
                "Sadie is typing...",
                modifier = Modifier.padding(10.dp),
                style = MaterialTheme.typography.bodySmall,
                color = SoftLavender.copy(alpha = 0.6f)
            )
        }
    }
}
