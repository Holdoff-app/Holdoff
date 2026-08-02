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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.data.prefs.AppPrefs
import com.holdoff.app.ui.theme.*

/**
 * Insights - the counts HoldOff actually keeps about this user, plus general
 * information about texting patterns that is never presented as being about them.
 *
 * Nothing here is inferred from the content of anyone's conversations, because
 * nothing in the app computes that.
 */
// isPremium is deliberately unused: everything on this screen is either the user's own
// counters or general reading, and none of it is worth putting behind a paywall.
@Suppress("UNUSED_PARAMETER")
@Composable
fun InsightsScreen(
    onBack: () -> Unit,
    isPremium: Boolean = false
) {
    val ctx = LocalContext.current
    val verdictCount = remember { AppPrefs.verdictCount(ctx) }
    val holdCount = remember { AppPrefs.holdCount(ctx) }
    val daysActive = remember { AppPrefs.daysActive(ctx) }

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
                    "\u26A0\uFE0F HoldOff is not therapy, not a diagnosis, and not a substitute for professional care.",
                    color = OnDarkTextMuted,
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(14.dp),
                    fontStyle = FontStyle.Italic
                )
            }

            Spacer(Modifier.height(24.dp))

            if (verdictCount == 0) {
                // Nothing has been analysed yet, so there is nothing true to show.
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Brush.verticalGradient(listOf(SurfaceVariant, DeepPurple.copy(alpha = 0.5f))))
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("\uD83C\uDF19", fontSize = 48.sp)
                        Spacer(Modifier.height(12.dp))
                        Text("Nothing to show yet", color = OnDarkText, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Once you have run a few messages through the pause, your counts will show up here. HoldOff only shows numbers it actually kept - it will never guess at them.",
                            color = OnDarkTextMuted,
                            fontSize = 13.sp,
                            lineHeight = 20.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else {
                Text("Your Numbers", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
                Spacer(Modifier.height(4.dp))
                Text("Counted on this phone, from your own use of the app", color = OnDarkTextMuted, fontSize = 13.sp)
                Spacer(Modifier.height(20.dp))

                StatRow(
                    value = verdictCount.toString(),
                    label = if (verdictCount == 1) "message checked" else "messages checked",
                    detail = "Drafts you have run through HoldOff."
                )
                Spacer(Modifier.height(12.dp))
                StatRow(
                    value = holdCount.toString(),
                    label = if (holdCount == 1) "time you held off" else "times you held off",
                    detail = "Times you decided to wait instead of sending."
                )
                Spacer(Modifier.height(12.dp))
                StatRow(
                    value = daysActive.toString(),
                    label = if (daysActive == 1) "day with HoldOff" else "days with HoldOff",
                    detail = "Counted from the first message you checked."
                )

                Spacer(Modifier.height(16.dp))
                Text(
                    "These counts are the only thing on this screen measured from your own use. Everything below is general reading, not a read on you.",
                    color = OnDarkTextMuted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(Modifier.height(32.dp))

            // General reading. Not tied to this user's data, and labelled that way on purpose.
            Text("Worth Knowing", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
            Spacer(Modifier.height(4.dp))
            Text(
                "General notes on how people text when they are activated. This is background reading, not a read on you.",
                color = OnDarkTextMuted,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))

            InsightCard(
                title = "The anxious pull",
                emoji = "\uD83C\uDF0A",
                description = "Waiting for a reply can feel unbearable, so the messages stack up - a follow-up, then an explanation, then an apology for the follow-up. The urge to send usually peaks and then drops on its own."
            )
            Spacer(Modifier.height(12.dp))

            InsightCard(
                title = "The avoidant pull",
                emoji = "\uD83D\uDEAA",
                description = "The other direction is going quiet: closing the app, leaving it on read, deciding it is easier to say nothing. The distance often gets read as coldness even when it is just overwhelm."
            )
            Spacer(Modifier.height(12.dp))

            InsightCard(
                title = "Why waiting works",
                emoji = "\u23F3",
                description = "A strong feeling and a good decision rarely arrive at the same moment. Putting time between the two is the whole idea behind the pause."
            )

            Spacer(Modifier.height(24.dp))

            // Settings prompt
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("\u2699\uFE0F In Settings", color = OnDarkText, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "You can set how long the pause lasts — 1, 5, 10 or 30 minutes.",
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
private fun StatRow(value: String, label: String, detail: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(value, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = GlowPurple)
            Column(modifier = Modifier.weight(1f)) {
                Text(label, fontWeight = FontWeight.SemiBold, color = OnDarkText, fontSize = 15.sp)
                Spacer(Modifier.height(2.dp))
                Text(detail, color = OnDarkTextMuted, fontSize = 12.sp, lineHeight = 17.sp)
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
