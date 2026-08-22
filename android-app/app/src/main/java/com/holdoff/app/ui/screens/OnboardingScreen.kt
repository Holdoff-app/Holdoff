package com.holdoff.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.holdoff.app.ui.components.SadieAvatar
import com.holdoff.app.ui.components.SadieSize
import com.holdoff.app.ui.theme.*
import kotlinx.coroutines.launch

private data class OnboardPage(val emoji: String, val title: String, val subtitle: String)

private val pages = listOf(
    OnboardPage("\uD83D\uDC9C", "Hi, I'm Sadie.", "I'm not here to tell you what to do. I'm here to help you see what's actually happening \u2014 before you send that message."),
    OnboardPage("\uD83E\uDDE0", "Pattern Recognition.", "I read your conversations and learn your attachment patterns, response speeds, and emotional cues. No self-reporting needed."),
    OnboardPage("\uD83D\uDED1", "The Verdict.", "Hold Off or Reach Out \u2014 based on real behavioral signals, not a coin flip. I'll explain my reasoning every time."),
    OnboardPage("\u2728", "Your companion.", "Sadie is always here. AI versions of real people in your story are available in the premium experience.")
)

@Composable
fun OnboardingScreen(onFinish: () -> Unit) {
    val pagerState = rememberPagerState(pageCount = { pages.size })
    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(MidnightNavy, DeepPurple)))
    ) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { i ->
            val p = pages[i]
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

        Row(
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 140.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(pages.size) { i ->
                Box(
                    modifier = Modifier
                        .size(if (pagerState.currentPage == i) 12.dp else 8.dp)
                        .clip(CircleShape)
                        .background(if (pagerState.currentPage == i) GlowPurple else DividerColor)
                )
            }
        }

        Column(
            modifier = Modifier.align(Alignment.BottomCenter).padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Button(
                onClick = {
                    if (pagerState.currentPage < pages.size - 1)
                        scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
                    else onFinish()
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VelvetPurple)
            ) {
                Text(
                    if (pagerState.currentPage < pages.size - 1) "Next" else "Get Started",
                    fontWeight = FontWeight.Bold
                )
            }
            if (pagerState.currentPage < pages.size - 1) {
                TextButton(onClick = onFinish) { Text("Skip", color = OnDarkTextMuted) }
            }
        }
    }
}
