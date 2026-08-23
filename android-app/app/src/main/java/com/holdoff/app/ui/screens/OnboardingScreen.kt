package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.data.prefs.ConsentManager
import com.holdoff.app.ui.components.SadieAvatar
import com.holdoff.app.ui.components.SadieSize
import com.holdoff.app.ui.theme.*
import kotlinx.coroutines.launch

private data class OnboardPage(val emoji: String, val title: String, val subtitle: String)

private val introPages = listOf(
    OnboardPage("\uD83D\uDC9C", "Hi, I'm Sadie.", "I'm not here to tell you what to do. I'm here to help you see what's actually happening \u2014 before you send that message."),
    OnboardPage("\uD83E\uDDE0", "Pattern Recognition.", "I read your conversations and learn your attachment patterns, response speeds, and emotional cues. No self-reporting needed."),
    OnboardPage("\uD83D\uDED1", "The Verdict.", "Hold Off or Reach Out \u2014 based on real behavioral signals, not a coin flip. I'll explain my reasoning every time."),
    OnboardPage("\u2728", "Your companion.", "Sadie is always here. AI versions of real people in your story are available in the premium experience.")
)

// Total pages = intro pages + age gate + privacy consent + setup mode
private const val PAGE_AGE = 4
private const val PAGE_PRIVACY = 5
private const val PAGE_MODE = 6
private const val PAGE_COUNT = 7

/**
 * Onboarding — intro carousel, then three required steps before the app unlocks:
 *   1. 13+ age confirmation (required)
 *   2. Plain-words privacy disclosure + explicit, revocable consent (required)
 *   3. Setup mode: Full setup vs Limited manual-share mode (required choice)
 *
 * No SMS permissions and no default-messenger role are requested here.
 * Full-setup permissions are requested later, only during explicit setup.
 */
@Composable
fun OnboardingScreen(onFinish: () -> Unit) {
    val context = LocalContext.current
    val pagerState = rememberPagerState(pageCount = { PAGE_COUNT })
    val scope = rememberCoroutineScope()

    var ageConfirmed by remember { mutableStateOf(false) }
    var consentGiven by remember { mutableStateOf(false) }
    var setupMode by remember { mutableStateOf<String?>(null) }

    val isLast = pagerState.currentPage == PAGE_COUNT - 1
    val canFinish = ageConfirmed && consentGiven && setupMode != null

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(MidnightNavy, DeepPurple)))
    ) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { i ->
            when (i) {
                in 0..3 -> IntroPage(introPages[i])
                PAGE_AGE -> AgeGatePage(ageConfirmed) { ageConfirmed = it }
                PAGE_PRIVACY -> PrivacyConsentPage(consentGiven) { consentGiven = it }
                PAGE_MODE -> SetupModePage(setupMode) { setupMode = it }
            }
        }

        // Page dots
        Row(
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 140.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(PAGE_COUNT) { i ->
                Box(
                    modifier = Modifier
                        .size(if (pagerState.currentPage == i) 12.dp else 8.dp)
                        .clip(CircleShape)
                        .background(if (pagerState.currentPage == i) GlowPurple else DividerColor)
                )
            }
        }

        // Bottom controls
        Column(
            modifier = Modifier.align(Alignment.BottomCenter).padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Button(
                onClick = {
                    if (!isLast) {
                        scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
                    } else if (canFinish) {
                        ConsentManager.setAgeConfirmed(context, true)
                        ConsentManager.recordConsentAndFinish(context, setupMode!!)
                        onFinish()
                    }
                },
                enabled = !isLast || canFinish,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = VelvetPurple,
                    disabledContainerColor = SurfaceVariant
                )
            ) {
                Text(
                    if (!isLast) "Next" else "Get Started",
                    fontWeight = FontWeight.Bold,
                    color = if (!isLast || canFinish) OnDarkText else OnDarkTextMuted
                )
            }
            if (isLast && !canFinish) {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Please confirm your age, accept the privacy terms, and choose a setup mode.",
                    color = OnDarkTextMuted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
            }
            if (pagerState.currentPage < PAGE_AGE) {
                TextButton(onClick = {
                    scope.launch { pagerState.animateScrollToPage(PAGE_AGE) }
                }) { Text("Skip intro", color = OnDarkTextMuted) }
            }
        }
    }
}

@Composable
private fun IntroPage(p: OnboardPage) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        SadieAvatar(size = SadieSize.LARGE)
        Spacer(Modifier.height(32.dp))
        Text(p.emoji, fontSize = 48.sp)
        Spacer(Modifier.height(16.dp))
        Text(p.title, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center, color = OnDarkText)
        Spacer(Modifier.height(12.dp))
        Text(p.subtitle, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center, color = OnDarkTextMuted)
    }
}

@Composable
private fun AgeGatePage(confirmed: Boolean, onChange: (Boolean) -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp).verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("\uD83D\uDD1E", fontSize = 48.sp)
        Spacer(Modifier.height(16.dp))
        Text(
            "Before we start",
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
            color = OnDarkText
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "HoldOff is designed for people 13 and older. We don't knowingly collect data from children under 13.",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = OnDarkTextMuted
        )
        Spacer(Modifier.height(24.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(SurfaceVariant)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = confirmed,
                onCheckedChange = onChange,
                colors = CheckboxDefaults.colors(checkedColor = GlowPurple)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                "I confirm that I am 13 years of age or older.",
                color = OnDarkText,
                fontWeight = FontWeight.Medium
            )
        }
        Spacer(Modifier.height(96.dp))
    }
}

@Composable
private fun PrivacyConsentPage(consent: Boolean, onChange: (Boolean) -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp).verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("\uD83D\uDD12", fontSize = 48.sp)
        Spacer(Modifier.height(16.dp))
        Text(
            "Your privacy, in plain words",
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
            color = OnDarkText
        )
        Spacer(Modifier.height(16.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(SurfaceVariant)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            PrivacyPoint("On your device", "Your messages stay on your phone. Pattern tracking and drafts are stored locally.")
            PrivacyPoint("When you ask Sadie", "Only when you request a Verdict or Interpretation is the relevant message text sent \u2014 over an encrypted connection \u2014 to api.smsholdoff.com for analysis. It is never sold or used for advertising.")
            PrivacyPoint("Not therapy", "Sadie offers reflection, not medical or mental-health care. HoldOff is not therapy, diagnosis, or a substitute for professional help. In a crisis, please contact local emergency services or a crisis line.")
            PrivacyPoint("You're in control", "You can revoke this consent anytime in Settings. Revoking stops all message processing and returns you to this onboarding.")
        }
        Spacer(Modifier.height(20.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, GlowPurple, RoundedCornerShape(12.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = consent,
                onCheckedChange = onChange,
                colors = CheckboxDefaults.colors(checkedColor = GlowPurple)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                "I understand and agree to this processing. I know I can revoke it anytime.",
                color = OnDarkText,
                fontWeight = FontWeight.Medium
            )
        }
        Spacer(Modifier.height(96.dp))
    }
}

@Composable
private fun PrivacyPoint(title: String, body: String) {
    Column {
        Text(title, color = SoftLavender, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        Text(body, color = OnDarkTextMuted, fontSize = 13.sp)
    }
}

@Composable
private fun SetupModePage(selected: String?, onSelect: (String) -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp).verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("\u2699\uFE0F", fontSize = 48.sp)
        Spacer(Modifier.height(16.dp))
        Text(
            "How should HoldOff work?",
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
            color = OnDarkText
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "You can change this later in Settings. We never ask for SMS or default-messenger permissions during onboarding.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = OnDarkTextMuted
        )
        Spacer(Modifier.height(24.dp))
        ModeCard(
            title = "Full setup",
            body = "Sync your SMS threads and contacts so Sadie can see patterns automatically. Permissions are requested step-by-step later, only when you choose to enable them.",
            selected = selected == ConsentManager.MODE_FULL,
            onClick = { onSelect(ConsentManager.MODE_FULL) }
        )
        Spacer(Modifier.height(12.dp))
        ModeCard(
            title = "Limited mode (manual share)",
            body = "Paste or share messages into HoldOff by hand. No SMS or contact permissions needed \u2014 everything works, just manually.",
            selected = selected == ConsentManager.MODE_MANUAL,
            onClick = { onSelect(ConsentManager.MODE_MANUAL) }
        )
        Spacer(Modifier.height(96.dp))
    }
}

@Composable
private fun ModeCard(title: String, body: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = if (selected) RoyalPurple else SurfaceVariant,
        border = if (selected) androidx.compose.foundation.BorderStroke(2.dp, GlowPurple) else null
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(title, color = OnDarkText, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(body, color = OnDarkTextMuted, fontSize = 13.sp)
        }
    }
}
