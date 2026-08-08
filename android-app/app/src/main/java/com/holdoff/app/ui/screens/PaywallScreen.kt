package com.holdoff.app.ui.screens

import android.app.Activity
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.data.billing.BillingManager
import com.holdoff.app.data.billing.Plan
import com.holdoff.app.ui.theme.*

/** HoldOff Premium, priced and charged by Google Play. */
@Composable
fun PaywallScreen(
    onSubscribed: () -> Unit,
    onBack: () -> Unit,
    onPremiumChanged: (Boolean) -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity

    val billing = remember {
        BillingManager(context, onPremiumChanged)
    }
    DisposableEffect(billing) {
        billing.start()
        onDispose { billing.dispose() }
    }

    val state by billing.state.collectAsState()
    var selected by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(state.plans) {
        if (selected == null) selected = state.plans.firstOrNull()?.productId
    }
    LaunchedEffect(state.isPremium) {
        if (state.isPremium) onSubscribed()
    }

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
                "Everything Sadie sees. Everything you need.",
                color = OnDarkTextMuted, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(24.dp))

            val features = listOf(
                "✏️" to "Sadie's rewrite of your draft",
                "🧠" to "Attachment style deep-dives",
                "📖" to "The full premium story experience",
                "🤝" to "AI companion personalities"
            )
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    features.forEach { (emoji, label) ->
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(emoji, fontSize = 18.sp)
                            Text(label, color = OnDarkText)
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))

            when {
                state.isLoading -> CircularProgressIndicator(color = GlowPurple)

                state.plans.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        state.error ?: "Plans aren't available right now.",
                        color = OnDarkTextMuted, textAlign = TextAlign.Center, fontSize = 14.sp
                    )
                    Spacer(Modifier.height(12.dp))
                    TextButton(onClick = { billing.start() }) { Text("Try again", color = SoftLavender) }
                }

                else -> {
                    state.plans.forEach { plan ->
                        PlanCard(
                            plan = plan,
                            selected = selected == plan.productId,
                            onClick = { selected = plan.productId }
                        )
                        Spacer(Modifier.height(12.dp))
                    }

                    state.error?.let {
                        Text(it, color = ErrorRed, fontSize = 13.sp, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(8.dp))
                    }

                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = {
                            val plan = state.plans.firstOrNull { it.productId == selected }
                            if (activity != null && plan != null) billing.launchPurchase(activity, plan)
                        },
                        enabled = selected != null && activity != null,
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                        shape = RoundedCornerShape(16.dp)
                    ) { Text("Continue", fontWeight = FontWeight.Bold, fontSize = 16.sp) }
                }
            }

            Spacer(Modifier.height(16.dp))
            Text(
                "\"I made it because I needed it — honestly, because I was bugging him. " +
                    "But maybe it'll help someone else too.\"\n— Danny, the muse behind HoldOff",
                color = OnDarkTextMuted, fontSize = 12.sp,
                fontStyle = FontStyle.Italic, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
            Text(
                "Billed through Google Play. Subscriptions renew until cancelled and can be " +
                    "managed or cancelled any time in your Google Play account.",
                color = OnDarkTextMuted, fontSize = 11.sp, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun PlanCard(plan: Plan, selected: Boolean, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) VelvetPurple.copy(alpha = 0.3f) else SurfaceVariant
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(plan.label, color = OnDarkText, fontWeight = FontWeight.SemiBold)
                plan.badge?.let {
                    Spacer(Modifier.height(4.dp))
                    Box(
                        modifier = Modifier.clip(RoundedCornerShape(8.dp))
                            .background(GlowPurple).padding(horizontal = 8.dp, vertical = 2.dp)
                    ) { Text(it, color = OnDarkText, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                }
            }
            Text(plan.formattedPrice, color = GlowPurple, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }
    }
}
