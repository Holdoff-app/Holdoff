package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.ui.theme.*

/**
 * Relationship Insights — pattern tracking, attachment analysis,
 * and per-contact behavioral data. Tied to real conversations.
 *
 * \u26A0\uFE0F Disclaimer: Not therapy. Not diagnosis. Not a substitute for professional care.
 */
@Composable
fun InsightsScreen(
    onBack: () -> Unit,
    isPremium: Boolean = false
) {
    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("Insights", fontWeight = FontWeight.Bold, color = OnDarkText) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = SoftLavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MidnightNavy)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding)
                .verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Disclaimer
            Card(
                colors = CardDefaults.cardColors(containerColor = VelvetPurple.copy(alpha = 0.15f)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    "\u26A0\uFE0F HoldOff is not therapy, not a diagnosis, and not a substitute for professional care. These insights are pattern observations from your real conversations.",
                    color = OnDarkTextMuted,
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(14.dp),
                    fontStyle = FontStyle.Italic
                )
            }

            Spacer(Modifier.height(24.dp))

            // Your Patterns section
            Text("Your Patterns", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
            Spacer(Modifier.height(4.dp))
            Text("Based on your real conversations", color = OnDarkTextMuted, fontSize = 13.sp)
            Spacer(Modifier.height(20.dp))

            // Response patterns card
            InsightCard(
                title = "Response Timing",
                emoji = "\u23F1\uFE0F",
                description = "How quickly you respond vs. how quickly they respond. Patterns in reply speed reveal emotional states."
            )
            Spacer(Modifier.height(12.dp))

            InsightCard(
                title = "Attachment Pattern",
                emoji = "\uD83E\uDDE0",
                description = "Your observed attachment behaviors across conversations — anxious spikes, avoidant pullbacks, secure moments."
            )
            Spacer(Modifier.height(12.dp))

            InsightCard(
                title = "Emotional Trends",
                emoji = "\uD83D\uDCC8",
                description = "Mood trajectory over time. Sadie tracks tone shifts, escalation patterns, and de-escalation moments."
            )
            Spacer(Modifier.height(12.dp))

            InsightCard(
                title = "Communication Health",
                emoji = "\uD83D\uDCAC",
                description = "Message balance, initiation patterns, conversation depth vs. surface-level exchanges."
            )

            Spacer(Modifier.height(32.dp))

            // Per-contact insights placeholder
            Text("Per-Contact Insights", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
            Spacer(Modifier.height(8.dp))
            Text(
                "Sadie learns patterns specific to each conversation. As you use HoldOff, insights will appear here for each contact.",
                color = OnDarkTextMuted,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp
            )
            Spacer(Modifier.height(20.dp))

            // Empty state
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Brush.verticalGradient(listOf(SurfaceVariant, DeepPurple.copy(alpha = 0.5f))))
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("\uD83D\uDD2E", fontSize = 48.sp)
                    Spacer(Modifier.height(12.dp))
                    Text("Patterns building\u2026", color = OnDarkText, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Use HoldOff with your real messages and Sadie will start surfacing insights here.",
                        color = OnDarkTextMuted,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            // Settings prompt
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("\u2699\uFE0F Customize in Settings", color = OnDarkText, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Adjust your launch-condition categories, pattern tracking preferences, and feedback frequency in Settings.",
                        color = OnDarkTextMuted,
                        fontSize = 12.sp,
                        lineHeight = 18.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun InsightCard(title: String, emoji: String, description: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                modifier = Modifier.size(44.dp).clip(CircleShape)
                    .background(VelvetPurple.copy(alpha = 0.3f)),
                contentAlignment = Alignment.Center
            ) {
                Text(emoji, fontSize = 20.sp)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Bold, color = OnDarkText, fontSize = 15.sp)
                Spacer(Modifier.height(4.dp))
                Text(description, color = OnDarkTextMuted, fontSize = 13.sp, lineHeight = 18.sp)
            }
        }
    }
}
