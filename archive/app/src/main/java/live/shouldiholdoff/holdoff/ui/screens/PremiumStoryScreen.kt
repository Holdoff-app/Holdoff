package live.shouldiholdoff.holdoff.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import live.shouldiholdoff.holdoff.ui.theme.*

/**
 * PremiumStoryScreen — Stacy's real story, then a "put on my shoes" CTA.
 * Gated behind a Pro subscription or trial.
 */
@Composable
fun PremiumStoryScreen(
    onBack: () -> Unit,
    onUpgrade: () -> Unit,
    isPremium: Boolean
) {
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            SmallTopAppBar(
                title = { Text("The Story", color = StarGlow) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = StarGlow)
                    }
                },
                colors = TopAppBarDefaults.smallTopAppBarColors(containerColor = DeepSpace)
            )
        },
        containerColor = DeepSpace
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
            Text(
                "Stacy's Story",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = StarGlow
            )

            Spacer(Modifier.height(16.dp))

            StoryParagraph(
                "I used to text at 3am. Not because I was reckless — because I was terrified. " +
                "Every unanswered message felt like proof that I was too much, not enough, or already losing him."
            )
            StoryParagraph(
                "I would reread every word I sent, searching for the thing that made him go quiet. " +
                "I would draft responses to messages he hadn't even sent yet. " +
                "I built entire stories out of a read receipt and silence."
            )
            StoryParagraph(
                "The night I built the first version of HoldOff, I had written eight drafts to someone " +
                "who hadn't replied in four hours. I needed something to hold me still long enough to " +
                "see what I was doing. So I built it."
            )
            StoryParagraph(
                "What I learned wasn't that I was broken. It was that I was operating on patterns " +
                "I hadn't chosen — patterns from places and people long before him. " +
                "Understanding them didn't erase them. But it gave me a half-second pause. " +
                "And that half-second changed everything."
            )

            Spacer(Modifier.height(24.dp))

            if (isPremium) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = TwilightPurple)
                ) {
                    Column(
                        Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            "Put on her shoes.",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = StarGlow,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "You know this story because it's yours too. HoldOff was built for exactly this moment — " +
                            "the one where you almost send something you'll spend tomorrow regretting.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = SoftLavender,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MoonlitViolet.copy(alpha = 0.2f))
                ) {
                    Column(
                        Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("✨ Pro Feature", color = StarGlow, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Unlock the full story experience and personalized companion.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = SoftLavender,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = onUpgrade, shape = RoundedCornerShape(10.dp)) {
                            Text("Upgrade to Pro →", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Text(
                "HoldOff is a tool, not therapy, not diagnosis, not a substitute for professional care.",
                style = MaterialTheme.typography.bodySmall,
                color = SoftLavender.copy(alpha = 0.4f),
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun StoryParagraph(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyLarge,
        color = SoftLavender,
        modifier = Modifier.padding(bottom = 16.dp),
        lineHeight = MaterialTheme.typography.bodyLarge.lineHeight
    )
}
