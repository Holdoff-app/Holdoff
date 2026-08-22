package com.holdoff.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.holdoff.app.data.network.HoldOffApi
import com.holdoff.app.ui.theme.*
import kotlinx.coroutines.launch

/**
 * Subscribe Now — Monthly / Yearly / Lifetime.
 *
 * Fix applied: the "Start Free Trial" button now:
 *   1. Calls POST /api/checkout/start with the selected tier to get a Stripe URL.
 *   2. Opens that URL in a Chrome Custom Tab (in-app browser, no app switch).
 *   3. When the user returns from the browser (app resumes), re-checks
 *      /api/auth/me to see if the payment went through.
 *   4. If premium, calls onPremiumChanged(true) and onSubscribed() to unlock.
 *
 * Plan → tier mapping (matches backend config/plans.js):
 *   "monthly"  → "app_monthly"  ($14.99/mo)
 *   "yearly"   → "app_annual"   ($99.99/yr)
 *   "lifetime" → "lifetime"     ($149 once)
 */
@Composable
fun PaywallScreen(
    onSubscribed: () -> Unit,
    onBack: () -> Unit,
    onPremiumChanged: (Boolean) -> Unit = {}
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current

    var selectedPlan by remember { mutableStateOf("monthly") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    // Track whether the user left to the browser for Stripe checkout.
    // When true, the next ON_RESUME fires a premium status re-check.
    var pendingCheckoutReturn by remember { mutableStateOf(false) }

    // Observe lifecycle so we know when the app resumes after Stripe checkout.
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && pendingCheckoutReturn) {
                pendingCheckoutReturn = false
                scope.launch {
                    isLoading = true
                    val isPremium = HoldOffApi.checkPremiumStatus(ctx)
                    isLoading = false
                    if (isPremium) {
                        onPremiumChanged(true)
                        onSubscribed()
                    } else {
                        // Payment either didn't complete or webhook hasn't fired yet.
                        // Surface a friendly message — don't treat this as an error.
                        errorMsg = "Payment not confirmed yet. Give it a moment and try again, or restore access from your profile."
                    }
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Map the selected plan label to the backend tier ID.
    fun selectedTier(): String = when (selectedPlan) {
        "yearly"   -> "app_annual"
        "lifetime" -> "lifetime"
        else       -> "app_monthly"
    }

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
                    label = "Monthly", price = "$14.99/mo", badge = null,
                    selected = selectedPlan == "monthly",
                    onClick = { selectedPlan = "monthly" }
                )
                PlanCard(
                    modifier = Modifier.weight(1f),
                    label = "Yearly", price = "$99.99/yr", badge = "Save 44%",
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

            // Error message (e.g. payment not yet confirmed on return)
            errorMsg?.let {
                Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(12.dp))
            }

            // Primary CTA — launches Stripe checkout in a Custom Tab
            Button(
                onClick = {
                    scope.launch {
                        isLoading = true
                        errorMsg = null
                        val result = HoldOffApi.startCheckout(ctx, selectedTier())
                        isLoading = false
                        if (result.ok && result.url != null) {
                            // Mark that we're heading to the browser so ON_RESUME knows to check
                            pendingCheckoutReturn = true
                            // Open Stripe in a Chrome Custom Tab — stays in-app context,
                            // no full app switch, back button returns user here automatically.
                            val customTab = CustomTabsIntent.Builder().build()
                            customTab.launchUrl(ctx, Uri.parse(result.url))
                        } else {
                            errorMsg = result.error ?: "Could not start checkout. Try again."
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                shape = RoundedCornerShape(16.dp),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = OnDarkText, strokeWidth = 2.dp)
                } else {
                    Text("Start Free Trial \u00b7 7 Days Free", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

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
