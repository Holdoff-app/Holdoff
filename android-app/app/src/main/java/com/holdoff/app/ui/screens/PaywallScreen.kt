package com.holdoff.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.ui.theme.*

/**
 * HoldOff Premium — a preview of what's planned, not a checkout.
 *
 * There is no billing in this build (no Play Billing, no Stripe), so nothing here can be bought
 * and nothing here may read as an offer. [onSubscribed] is kept because callers pass it and it
 * will be needed the day purchasing is real.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun PaywallScreen(onSubscribed: () -> Unit, onBack: () -> Unit) {
    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("HoldOff Premium", fontWeight = FontWeight.Bold, color = OnDarkText) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.Close, "Close", tint = SoftLavender)
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
            Text("✨", fontSize = 48.sp)
            Spacer(Modifier.height(8.dp))
            Text("HoldOff Premium", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
            Spacer(Modifier.height(4.dp))
            Text(
                "Not built yet. Here's what it's meant to be.",
                color = OnDarkTextMuted, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(24.dp))

            val features = listOf(
                "🛑" to "Unlimited verdict analyses",
                "🧠" to "Full pattern history & insights",
                "💬" to "Sadie's suggested responses",
                "🔮" to "Attachment style deep-dives",
                "📖" to "Full premium story experience",
                "🤝" to "AI companion personalities",
                "🎁" to "Gift HoldOff to someone you love"
            )
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "What premium is planned to include",
                        color = OnDarkText, fontWeight = FontWeight.SemiBold, fontSize = 15.sp
                    )
                    Text(
                        "None of this is switched on yet.",
                        color = OnDarkTextMuted, fontSize = 12.sp
                    )
                    features.forEach { (emoji, label) ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(emoji, fontSize = 18.sp)
                            Text(label, color = OnDarkText)
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Planned plans",
                        color = OnDarkText, fontWeight = FontWeight.SemiBold, fontSize = 15.sp
                    )
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        PlannedPlan(modifier = Modifier.weight(1f), label = "Monthly")
                        PlannedPlan(modifier = Modifier.weight(1f), label = "Yearly")
                        PlannedPlan(modifier = Modifier.weight(1f), label = "Lifetime")
                    }
                    Text(
                        "Prices aren't set. When they are, you'll see the real number before anything is asked of you.",
                        color = OnDarkTextMuted, fontSize = 12.sp, lineHeight = 17.sp
                    )
                }
            }

            Spacer(Modifier.height(24.dp))
            Button(
                onClick = {},
                enabled = false,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    disabledContainerColor = VelvetPurple.copy(alpha = 0.35f),
                    disabledContentColor = OnDarkTextMuted
                ),
                shape = RoundedCornerShape(16.dp)
            ) { Text("Premium isn't available yet", fontWeight = FontWeight.Bold, fontSize = 16.sp) }

            Spacer(Modifier.height(8.dp))
            Text(
                "There's no way to buy HoldOff in this build, so nothing here can charge you. Everything you have now stays free while we finish it.",
                color = OnDarkTextMuted, fontSize = 12.sp, lineHeight = 17.sp, textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) { Text("Keep using HoldOff", color = OnDarkText) }

            Spacer(Modifier.height(16.dp))
            Text(
                "\"I made it because I needed it — honestly, because I was bugging him. But maybe it'll help someone else too.\"\n— Danny, the muse behind HoldOff",
                color = OnDarkTextMuted, fontSize = 12.sp, fontStyle = FontStyle.Italic, textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun PlannedPlan(modifier: Modifier = Modifier, label: String) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MidnightNavy),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(vertical = 16.dp, horizontal = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, color = OnDarkText, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text("Price TBD", color = OnDarkTextMuted, fontSize = 12.sp)
        }
    }
}
