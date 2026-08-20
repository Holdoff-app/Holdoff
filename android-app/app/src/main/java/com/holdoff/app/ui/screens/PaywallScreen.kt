package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.ui.theme.*

/** Subscribe Now — Monthly / Yearly / Lifetime / Gift. */
@Composable
fun PaywallScreen(onSubscribed: () -> Unit, onBack: () -> Unit) {
    var selectedPlan by remember { mutableStateOf("monthly") }

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("Subscribe Now", fontWeight = FontWeight.Bold, color = OnDarkText) },
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
            Text("\u2728", fontSize = 48.sp)
            Spacer(Modifier.height(8.dp))
            Text("HoldOff Premium", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
            Spacer(Modifier.height(4.dp))
            Text("Everything Sadie sees. Everything you need.", color = OnDarkTextMuted, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))

            val features = listOf(
                "\uD83D\uDED1" to "Unlimited verdict analyses",
                "\uD83E\uDDE0" to "Full pattern history & insights",
                "\uD83D\uDCAC" to "Sadie's suggested responses",
                "\uD83D\uDD2E" to "Attachment style deep-dives",
                "\uD83D\uDCD6" to "Full premium story experience",
                "\uD83E\uDD1D" to "AI companion personalities",
                "\uD83C\uDF81" to "Gift HoldOff to someone you love"
            )
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    features.forEach { (emoji, label) ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(emoji, fontSize = 18.sp)
                            Text(label, color = OnDarkText)
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PlanCard(
                    modifier = Modifier.weight(1f),
                    label = "Monthly", price = "$7.99/mo", badge = null,
                    selected = selectedPlan == "monthly",
                    onClick = { selectedPlan = "monthly" }
                )
                PlanCard(
                    modifier = Modifier.weight(1f),
                    label = "Yearly", price = "$59.99/yr", badge = "Save 37%",
                    selected = selectedPlan == "yearly",
                    onClick = { selectedPlan = "yearly" }
                )
            }
            Spacer(Modifier.height(12.dp))
            PlanCard(
                modifier = Modifier.fillMaxWidth(),
                label = "Lifetime Access", price = "$149 one-time", badge = "Best Value",
                selected = selectedPlan == "lifetime",
                onClick = { selectedPlan = "lifetime" }
            )

            Spacer(Modifier.height(24.dp))
            Button(
                onClick = onSubscribed,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                shape = RoundedCornerShape(16.dp)
            ) { Text("Start Free Trial \u00b7 7 Days Free", fontWeight = FontWeight.Bold, fontSize = 16.sp) }

            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = { /* TODO: gift flow */ },
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) { Text("\uD83C\uDF81  Gift HoldOff", color = OnDarkText) }

            Spacer(Modifier.height(8.dp))
            Text(
                "\"I made it because I needed it \u2014 honestly, because I was bugging him. But maybe it'll help someone else too.\"\n\u2014 Danny, the muse behind HoldOff",
                color = OnDarkTextMuted, fontSize = 12.sp, fontStyle = FontStyle.Italic, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
            Text(
                "Cancel anytime. Free trial converts to paid after 7 days. Manage subscription in your Google Play account.",
                color = OnDarkTextMuted, fontSize = 11.sp, textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun PlanCard(
    modifier: Modifier = Modifier,
    label: String,
    price: String,
    badge: String?,
    selected: Boolean,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = if (selected) VelvetPurple.copy(alpha = 0.3f) else SurfaceVariant
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (badge != null) {
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(8.dp))
                        .background(GlowPurple).padding(horizontal = 8.dp, vertical = 2.dp)
                ) { Text(badge, color = OnDarkText, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                Spacer(Modifier.height(4.dp))
            }
            Text(label, color = OnDarkText, fontWeight = FontWeight.SemiBold)
            Text(price, color = GlowPurple, fontWeight = FontWeight.Bold)
        }
    }
}
