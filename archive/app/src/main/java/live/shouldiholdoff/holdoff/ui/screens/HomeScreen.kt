package live.shouldiholdoff.holdoff.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import live.shouldiholdoff.holdoff.domain.models.SMSThread
import live.shouldiholdoff.holdoff.ui.components.SadieCompanion
import live.shouldiholdoff.holdoff.ui.components.VerdictBadge
import live.shouldiholdoff.holdoff.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    threads: List<SMSThread>,
    isLoading: Boolean,
    onThreadClick: (SMSThread) -> Unit,
    onAskSadie: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = 8.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "HoldOff",
                            style = MaterialTheme.typography.headlineMedium,
                            color = StarGlow
                        )
                        Text(
                            "Your conversations, with clarity",
                            style = MaterialTheme.typography.bodySmall,
                            color = SoftLavender.copy(alpha = 0.7f)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DeepSpace
                )
            )

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MoonlitViolet)
                }
            } else if (threads.isEmpty()) {
                EmptyThreadsState(onAskSadie = onAskSadie)
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    items(threads, key = { it.threadId }) { thread ->
                        ThreadRow(thread = thread, onClick = { onThreadClick(thread) })
                        HorizontalDivider(
                            color = TwilightPurple.copy(alpha = 0.3f),
                            thickness = 0.5.dp
                        )
                    }
                }
            }
        }

        // Sadie companion sticker — bottom right
        SadieCompanion(
            message = if (threads.any { it.verdict == "hold_off" })
                "I'm noticing some patterns worth pausing on 💜" else "",
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 80.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ThreadRow(thread: SMSThread, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = DuskPurple.copy(alpha = 0.6f)),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar placeholder
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .padding(end = 0.dp),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    modifier = Modifier.size(46.dp),
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = TwilightPurple
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = thread.contactName.firstOrNull()?.toString() ?: "?",
                            style = MaterialTheme.typography.titleMedium,
                            color = StarGlow
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = thread.contactName,
                        style = MaterialTheme.typography.titleMedium,
                        color = StarlightWhite
                    )
                    Text(
                        text = formatTime(thread.lastMessageTime),
                        style = MaterialTheme.typography.bodySmall,
                        color = SoftLavender.copy(alpha = 0.6f)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = thread.lastMessage,
                    style = MaterialTheme.typography.bodySmall,
                    color = SoftLavender.copy(alpha = 0.8f),
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
                if (thread.verdict != "pending") {
                    Spacer(modifier = Modifier.height(6.dp))
                    VerdictBadge(verdict = thread.verdict)
                }
            }

            if (thread.unreadCount > 0) {
                Badge(containerColor = NightBloom) {
                    Text(thread.unreadCount.toString(), color = StarlightWhite)
                }
            }
        }
    }
}

@Composable
fun EmptyThreadsState(onAskSadie: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("🌙", style = MaterialTheme.typography.displayLarge)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            "No conversations yet",
            style = MaterialTheme.typography.headlineMedium,
            color = StarlightWhite
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Grant SMS permission to see your conversations and get relationship insights from Sadie.",
            style = MaterialTheme.typography.bodyMedium,
            color = SoftLavender.copy(alpha = 0.7f),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = onAskSadie,
            colors = ButtonDefaults.buttonColors(containerColor = NightBloom)
        ) {
            Text("Talk to Sadie Instead")
        }
    }
}

private fun formatTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    return when {
        diff < 60_000      -> "now"
        diff < 3_600_000   -> "${diff / 60_000}m"
        diff < 86_400_000  -> "${diff / 3_600_000}h"
        else               -> SimpleDateFormat("M/d", Locale.US).format(Date(timestamp))
    }
}
