package com.holdoff.app.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.R
import com.holdoff.app.data.model.Verdict
import com.holdoff.app.data.model.VerdictResult
import com.holdoff.app.ui.components.SadieAvatar
import com.holdoff.app.ui.components.SadieSize
import com.holdoff.app.ui.components.VerdictBadge
import com.holdoff.app.ui.theme.*

/**
 * The Hold Off / Send It / Proceed with Care result.
 *
 * Rendered both in-app and inside ProcessTextActivity, so it takes its data as
 * parameters rather than reaching for a ViewModel. [onUseRewrite] is non-null
 * only when the caller can actually write text back into the host app.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerdictScreen(
    verdict: VerdictResult?,
    isAnalyzing: Boolean,
    error: String?,
    onBack: () -> Unit,
    onRetry: () -> Unit = {},
    onUpgradeClick: () -> Unit = {},
    onUseRewrite: ((String) -> Unit)? = null,
    onSendAnyway: (() -> Unit)? = null,
    isPremium: Boolean = false
) {
    val clipboard = LocalClipboardManager.current
    var showRewrite by remember { mutableStateOf(false) }
    var showSendConfirm by remember { mutableStateOf(false) }

    val infinite = rememberInfiniteTransition(label = "pulse")
    val scale by infinite.animateFloat(
        initialValue = 1f, targetValue = 1.12f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
        label = "scale"
    )

    Scaffold(
        containerColor = MidnightNavy,
        topBar = {
            TopAppBar(
                title = { Text("The Verdict", fontWeight = FontWeight.Bold, color = OnDarkText) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = SoftLavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MidnightNavy)
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize().padding(padding)
                .background(Brush.verticalGradient(listOf(MidnightNavy, DeepPurple)))
        ) {
            when {
                error != null -> Column(
                    Modifier.fillMaxSize().padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("Couldn't read that one", color = OnDarkText, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text(error, color = OnDarkTextMuted, fontSize = 13.sp, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(24.dp))
                    Button(
                        onClick = onRetry,
                        colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple)
                    ) { Text("Try again") }
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = onBack) { Text("Go back", color = SoftLavender) }
                }

                isAnalyzing || verdict == null -> Column(
                    Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(Modifier.scale(scale)) { SadieAvatar(size = SadieSize.LARGE, isThinking = true) }
                    Spacer(Modifier.height(24.dp))
                    Text("Reading it…", color = OnDarkText, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text("Sadie is looking at your draft", color = OnDarkTextMuted)
                    Spacer(Modifier.height(32.dp))
                    CircularProgressIndicator(color = GlowPurple)
                }

                else -> {
                    val (emoji, headline, bgColors) = when (verdict.verdict) {
                        Verdict.HOLD_OFF  -> Triple("🛑", "Hold Off.",          listOf(DeepPurple, RomanticBlue))
                        Verdict.REACH_OUT -> Triple("💚", "Send It.",           listOf(DeepPurple, Color(0xFF0D2B0D)))
                        Verdict.MAYBE     -> Triple("🤔", "Proceed with Care.", listOf(DeepPurple, Color(0xFF2B1F0D)))
                    }

                    Column(
                        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        if (verdict.isCrisis) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF3A1010)),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Column(Modifier.padding(18.dp)) {
                                    Text(
                                        "You don't have to sit with this alone.",
                                        color = OnDarkText, fontWeight = FontWeight.Bold
                                    )
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        stringResource(R.string.crisis_resources),
                                        color = OnDarkText, fontSize = 13.sp, lineHeight = 19.sp
                                    )
                                }
                            }
                            Spacer(Modifier.height(20.dp))
                        }

                        Spacer(Modifier.height(8.dp))
                        Box(
                            modifier = Modifier.size(140.dp).clip(RoundedCornerShape(32.dp))
                                .background(Brush.radialGradient(bgColors)),
                            contentAlignment = Alignment.Center
                        ) { Text(emoji, fontSize = 64.sp) }
                        Spacer(Modifier.height(20.dp))
                        Text(headline, fontSize = 36.sp, fontWeight = FontWeight.Bold, color = OnDarkText)
                        Spacer(Modifier.height(8.dp))
                        VerdictBadge(verdict.verdict)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Confidence: ${(verdict.confidence * 100).toInt()}%",
                            color = OnDarkTextMuted, fontSize = 13.sp
                        )

                        Spacer(Modifier.height(24.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(20.dp)) {
                                Text("💬 What Sadie sees:", fontWeight = FontWeight.SemiBold, color = GlowPurple)
                                Spacer(Modifier.height(8.dp))
                                Text(verdict.reasoning, color = OnDarkText, lineHeight = 22.sp)
                            }
                        }

                        if (verdict.patternInsights.isNotEmpty()) {
                            Spacer(Modifier.height(16.dp))
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = RoyalPurple.copy(alpha = 0.4f)),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Column(modifier = Modifier.padding(20.dp)) {
                                    Text("🧠 Patterns detected:", fontWeight = FontWeight.SemiBold, color = SoftLavender)
                                    Spacer(Modifier.height(8.dp))
                                    verdict.patternInsights.forEach {
                                        Row(
                                            verticalAlignment = Alignment.Top,
                                            modifier = Modifier.padding(vertical = 4.dp)
                                        ) {
                                            Text("•  ", color = GlowPurple)
                                            Text(it, color = OnDarkText)
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(Modifier.height(28.dp))
                        Text(
                            "What do you want to do?",
                            color = SoftLavender, fontWeight = FontWeight.SemiBold, fontSize = 16.sp
                        )
                        Spacer(Modifier.height(12.dp))

                        Button(
                            onClick = onBack,
                            colors = ButtonDefaults.buttonColors(containerColor = RomanticBlue),
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text("🛑  Hold Off — Don't Send", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        }

                        Spacer(Modifier.height(10.dp))

                        val rewrite = verdict.suggestedResponse
                        if (rewrite != null && isPremium) {
                            OutlinedButton(
                                onClick = { showRewrite = !showRewrite },
                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = GlowPurple),
                                border = BorderStroke(1.dp, Brush.linearGradient(listOf(GlowPurple, SoftLavender)))
                            ) {
                                Text("✏️  Rewrite It — Sadie's Version", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                            }

                            if (showRewrite) {
                                Spacer(Modifier.height(8.dp))
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = VelvetPurple.copy(alpha = 0.3f)),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Column(Modifier.padding(16.dp)) {
                                        Text(
                                            "Sadie's rewrite:",
                                            color = GlowPurple, fontWeight = FontWeight.Medium, fontSize = 13.sp
                                        )
                                        Spacer(Modifier.height(8.dp))
                                        Text(rewrite, color = OnDarkText, fontStyle = FontStyle.Italic, lineHeight = 22.sp)
                                        Spacer(Modifier.height(12.dp))
                                        if (onUseRewrite != null) {
                                            Button(
                                                onClick = { onUseRewrite(rewrite) },
                                                colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple),
                                                modifier = Modifier.fillMaxWidth()
                                            ) { Text("Use this instead") }
                                        } else {
                                            TextButton(onClick = { clipboard.setText(AnnotatedString(rewrite)) }) {
                                                Text("📋 Copy to clipboard", color = SoftLavender)
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            OutlinedButton(
                                onClick = onUpgradeClick,
                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = GlowPurple)
                            ) {
                                Text("✨ Unlock Rewrite — Subscribe", fontSize = 15.sp)
                            }
                        }

                        Spacer(Modifier.height(10.dp))

                        val confirmSend = onSendAnyway ?: onBack
                        if (verdict.verdict == Verdict.REACH_OUT) {
                            Button(
                                onClick = confirmSend,
                                colors = ButtonDefaults.buttonColors(containerColor = ReachOutGreen),
                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Text("💚  Send It — You're Good", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                            }
                        } else {
                            OutlinedButton(
                                onClick = { showSendConfirm = !showSendConfirm },
                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = HoldOffRed)
                            ) {
                                Text("⚠️  Send Anyway", fontSize = 15.sp)
                            }
                            if (showSendConfirm) {
                                Spacer(Modifier.height(8.dp))
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF2B1010)),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Column(
                                        Modifier.padding(16.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text("Are you sure?", color = HoldOffRed, fontWeight = FontWeight.Bold)
                                        Spacer(Modifier.height(4.dp))
                                        Text(
                                            "Sadie thinks you should wait. You can always come back to this.",
                                            color = OnDarkTextMuted, textAlign = TextAlign.Center, fontSize = 13.sp
                                        )
                                        Spacer(Modifier.height(12.dp))
                                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                            OutlinedButton(onClick = { showSendConfirm = false }) {
                                                Text("Wait", color = SoftLavender)
                                            }
                                            Button(
                                                onClick = confirmSend,
                                                colors = ButtonDefaults.buttonColors(containerColor = HoldOffRed)
                                            ) { Text("Send It") }
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(Modifier.height(24.dp))
                        Text(
                            stringResource(R.string.mental_health_disclaimer),
                            color = OnDarkTextMuted, fontSize = 11.sp,
                            textAlign = TextAlign.Center, lineHeight = 16.sp
                        )
                        Spacer(Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}
