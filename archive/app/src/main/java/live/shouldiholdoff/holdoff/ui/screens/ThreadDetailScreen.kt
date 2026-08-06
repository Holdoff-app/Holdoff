package live.shouldiholdoff.holdoff.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import live.shouldiholdoff.holdoff.domain.models.SMSThread
import live.shouldiholdoff.holdoff.ui.components.SadieCompanion
import live.shouldiholdoff.holdoff.ui.components.VerdictBadge
import live.shouldiholdoff.holdoff.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ThreadDetailScreen(
    thread: SMSThread,
    isAnalyzing: Boolean,
    onBack: () -> Unit,
    onAskSadie: () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            TopAppBar(
                title = { Text(thread.contactName, color = StarlightWhite) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = StarGlow)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepSpace)
            )

            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 16.dp),
                contentPadding = PaddingValues(vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Verdict card
                item {
                    VerdictCard(thread = thread, isAnalyzing = isAnalyzing)
                }

                // Insight card
                if (thread.relationshipInsight.isNotEmpty()) {
                    item {
                        InsightCard(insight = thread.relationshipInsight)
                    }
                }

                // Last message preview
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = DuskPurple.copy(alpha = 0.6f)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                "Last Message",
                                style = MaterialTheme.typography.labelMedium,
                                color = MoonlitViolet
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                thread.lastMessage,
                                style = MaterialTheme.typography.bodyMedium,
                                color = StarlightWhite
                            )
                        }
                    }
                }

                // Ask Sadie CTA
                item {
                    Button(
                        onClick = onAskSadie,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = NightBloom)
                    ) {
                        Text("💜 Talk to Sadie About This")
                    }
                }
            }
        }

        SadieCompanion(
            message = when (thread.verdict) {
                "hold_off"  -> "Take a pause. Your feelings are valid — and so is the wait. 💜"
                "reach_out" -> "This feels like a good moment. Go gently. 🌙"
                "wait"      -> "A little more time might make this clearer. ✨"
                else        -> ""
            },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 80.dp)
        )
    }
}

@Composable
fun VerdictCard(thread: SMSThread, isAnalyzing: Boolean) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = TwilightPurple),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "Should You Reach Out?",
                style = MaterialTheme.typography.titleMedium,
                color = SoftLavender,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(12.dp))

            if (isAnalyzing) {
                CircularProgressIndicator(color = MoonlitViolet, modifier = Modifier.size(36.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Sadie is reading the patterns...",
                    style = MaterialTheme.typography.bodySmall,
                    color = SoftLavender.copy(alpha = 0.6f)
                )
            } else {
                VerdictBadge(verdict = thread.verdict)
                if (thread.verdictScore > 0f) {
                    Spacer(modifier = Modifier.height(10.dp))
                    LinearProgressIndicator(
                        progress = { thread.verdictScore },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp),
                        color = when (thread.verdict) {
                            "hold_off"  -> HoldRed
                            "reach_out" -> GoGreen
                            else        -> WarnAmber
                        },
                        trackColor = DuskPurple
                    )
                }
            }
        }
    }
}

@Composable
fun InsightCard(insight: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = RomanticBlue.copy(alpha = 0.4f)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "🔍 Relationship Insight",
                style = MaterialTheme.typography.labelMedium,
                color = AzureGlow
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                insight,
                style = MaterialTheme.typography.bodyMedium,
                color = StarlightWhite.copy(alpha = 0.9f)
            )
        }
    }
}
