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
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.holdoff.app.data.model.Verdict
import com.holdoff.app.ui.components.SadieAvatar
import com.holdoff.app.ui.components.SadieSize
import com.holdoff.app.ui.components.VerdictBadge
import com.holdoff.app.ui.theme.*
import com.holdoff.app.viewmodel.ThreadViewModel

/** The Hold Off / Reach Out / Maybe verdict screen with action buttons. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerdictScreen(
    threadId: String,
    onBack: () -> Unit,
    onUpgradeClick: () -> Unit,
    onTrustedContactsClick: () -> Unit = {},
    isPremium: Boolean = false,
    vm: ThreadViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    val clipboard = LocalClipboardManager.current
    var showRewrite by remember { mutableStateOf(false) }
    var showSendConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(threadId) { if (state.verdict == null) vm.analyzeThread(threadId) }

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
            if (state.isAnalyzing || state.verdict == null) {
                Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Box(Modifier.scale(scale)) { SadieAvatar(size = SadieSize.LARGE, isThinking = true) }
                    Spacer(Modifier.height(24.dp))
                    Text("Reading the patterns\u2026", color = OnDarkText, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text("Sadie is analyzing your conversation", color = OnDarkTextMuted)
                    Spacer(Modifier.height(32.dp))
                    CircularProgressIndicator(color = GlowPurple)
                }
            } else {
                val verdict = state.verdict!!
                val (emoji, headline, bgColors) = when (verdict.verdict) {
                    Verdict.HOLD_OFF  -> Triple("\uD83D\uDED1", "Hold Off.",            listOf(DeepPurple, RomanticBlue))
                    Verdict.REACH_OUT -> Triple("\uD83D\uDC9A", "Reach Out.",           listOf(DeepPurple, Color(0xFF0D2B0D)))
                    Verdict.MAYBE     -> Triple("\uD83E\uDD14", "Proceed with Care.",   listOf(DeepPurple, Color(0xFF2B1F0D)))
                }

                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Spacer(Modifier.height(16.dp))
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
                    Text("Confidence: ${(verdict.confidence * 100).toInt()}%", color = OnDarkTextMuted, fontSize = 13.sp)

                    // ── Analysis Card ──
                    Spacer(Modifier.height(24.dp))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SurfaceVariant),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Text("\uD83D\uDCAC What Sadie sees:", fontWeight = FontWeight.SemiBold, color = GlowPurple)
                            Spacer(Modifier.height(8.dp))
                            Text(verdict.reasoning, color = OnDarkText, lineHeight = 22.sp)
                        }
                    }

                    // ── Pattern Insights ──
                    if (verdict.patternInsights.isNotEmpty()) {
                        Spacer(Modifier.height(16.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = RoyalPurple.copy(alpha = 0.4f)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(20.dp)) {
                                Text("\uD83E\uDDE0 Patterns detected:", fontWeight = FontWeight.SemiBold, color = SoftLavender)
                                Spacer(Modifier.height(8.dp))
                                verdict.patternInsights.forEach {
                                    Row(verticalAlignment = Alignment.Top, modifier = Modifier.padding(vertical = 4.dp)) {
                                        Text("\u2022  ", color = GlowPurple)
                                        Text(it, color = OnDarkText)
                                    }
                                }
                            }
                        }
                    }

                    // ══════════════════════════════════════════
                    // ── ACTION BUTTONS: Hold / Rewrite / Send ──
                    // ══════════════════════════════════════════
                    Spacer(Modifier.height(28.dp))
                    Text("What do you want to do?", color = SoftLavender, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    Spacer(Modifier.height(12.dp))

                    // HOLD button
                    Button(
                        onClick = onBack,
                        colors = ButtonDefaults.buttonColors(containerColor = RomanticBlue),
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text("\uD83D\uDED1  Hold Off — Don't Send", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    }

                    Spacer(Modifier.height(10.dp))

                    // REWRITE button (premium or show upgrade)
                    if (verdict.suggestedResponse != null || isPremium) {
                        OutlinedButton(
                            onClick = { showRewrite = !showRewrite },
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = GlowPurple),
                            border = BorderStroke(1.dp, Brush.linearGradient(listOf(GlowPurple, SoftLavender)))
                        ) {
                            Text("\u270F\uFE0F  Rewrite It — Sadie's Version", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        }

                        if (showRewrite && verdict.suggestedResponse != null) {
                            Spacer(Modifier.height(8.dp))
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = VelvetPurple.copy(alpha = 0.3f)),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Column(Modifier.padding(16.dp)) {
                                    Text("Sadie's rewrite:", color = GlowPurple, fontWeight = FontWeight.Medium, fontSize = 13.sp)
                                    Spacer(Modifier.height(8.dp))
                                    Text(verdict.suggestedResponse, color = OnDarkText, fontStyle = FontStyle.Italic, lineHeight = 22.sp)
                                    Spacer(Modifier.height(12.dp))
                                    TextButton(
                                        onClick = { clipboard.setText(AnnotatedString(verdict.suggestedResponse)) }
                                    ) {
                                        Text("\uD83D\uDCCB Copy to clipboard", color = SoftLavender)
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
                            Text("\u2728 Unlock Rewrite — Subscribe Now", fontSize = 15.sp)
                        }
                    }

                    Spacer(Modifier.height(10.dp))

                    // SEND ANYWAY button
                    if (verdict.verdict == Verdict.REACH_OUT) {
                        Button(
                            onClick = onBack,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text("\uD83D\uDC9A  Send It — You're Good", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        }
                    } else {
                        OutlinedButton(
                            onClick = { showSendConfirm = !showSendConfirm },
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444))
                        ) {
                            Text("\u26A0\uFE0F  Send Anyway", fontSize = 15.sp)
                        }
                        if (showSendConfirm) {
                            Spacer(Modifier.height(8.dp))
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF2B1010)),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("Are you sure?", color = Color(0xFFEF4444), fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.height(4.dp))
                                    Text("Sadie thinks you should wait. You can always come back to this.", color = OnDarkTextMuted, textAlign = TextAlign.Center, fontSize = 13.sp)
                                    Spacer(Modifier.height(12.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        OutlinedButton(onClick = { showSendConfirm = false }) {
                                            Text("Wait", color = SoftLavender)
                                        }
                                        Button(
                                            onClick = onBack,
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                                        ) { Text("Send It") }
                                    }
                                }
                            }
                        }
                    }

                    // ── Trusted Contact Option ──
                    Spacer(Modifier.height(20.dp))
                    OutlinedButton(
                        onClick = onTrustedContactsClick,
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = SoftLavender)
                    ) {
                        Text("\uD83D\uDC65  Send to Trusted Contact Instead", fontSize = 14.sp)
                    }

                    // ── Disclaimer ──
                    Spacer(Modifier.height(24.dp))
                    Text(
                        "\u26A0\uFE0F HoldOff is not therapy, not a diagnosis, and not a substitute for professional mental health care.",
                        color = OnDarkTextMuted, fontSize = 11.sp, textAlign = TextAlign.Center, lineHeight = 16.sp
                    )
                    Spacer(Modifier.height(16.dp))
                }
            }
        }
    }
}
